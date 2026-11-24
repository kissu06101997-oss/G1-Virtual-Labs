import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getCurrentSession, recordAuditEvent, verifyCsrf } from "@/lib/auth";
import { query } from "@/lib/db";

const SMALL_CELL_THRESHOLD = 5;

function suppressSmallCell(count: number): { value: number | null; suppressed: boolean; display: string } {
  if (count > 0 && count < SMALL_CELL_THRESHOLD) {
    return { value: null, suppressed: true, display: `< ${SMALL_CELL_THRESHOLD} (suppressed)` };
  }
  return { value: count, suppressed: false, display: String(count) };
}

export async function GET() {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");

  if (
    auth.role !== "school_admin" &&
    auth.role !== "district_admin" &&
    auth.role !== "state_admin" &&
    auth.role !== "operator"
  ) {
    return apiError(403, "NOT_AUTHORIZED", "Administrative role required.");
  }

  if (auth.role === "school_admin" && auth.schoolId) {
    const [roster, devices, audits] = await Promise.all([
      query<{
        principal_id: string;
        email: string;
        display_name: string;
        role: string;
        enabled: boolean;
        grade: number | null;
      }>(
        `SELECT
           p.principal_id,
           pc.email,
           pc.display_name,
           rg.role::text,
           p.enabled,
           sl.grade
         FROM role_grant rg
         JOIN principal p ON p.principal_id = rg.principal_id
         JOIN principal_credential pc ON pc.principal_id = p.principal_id
         LEFT JOIN school_learner sl ON sl.principal_id = p.principal_id AND sl.school_id = rg.school_id
         WHERE rg.school_id = $1 AND rg.revoked_at IS NULL
         ORDER BY rg.role, pc.display_name`,
        [auth.schoolId]
      ),
      query<{
        device_id: string;
        label: string;
        ram_gb: number;
        gpu_class: string;
        webgl2_supported: boolean;
        network_profile_mbps: string;
      }>(
        `SELECT device_id, label, ram_gb, gpu_class, webgl2_supported, network_profile_mbps::text
         FROM school_device_profile WHERE school_id = $1 ORDER BY ram_gb ASC`,
        [auth.schoolId]
      ),
      query<{
        event_id: string;
        action_type: string;
        occurred_at: Date;
        retention_class: string;
      }>(
        `SELECT event_id, action_type, occurred_at, retention_class
         FROM audit_event WHERE school_id = $1 ORDER BY occurred_at DESC LIMIT 20`,
        [auth.schoolId]
      ),
    ]);

    return NextResponse.json({
      scope: "school",
      schoolName: auth.schoolName,
      roster: roster.rows.map((r) => ({
        principalId: r.principal_id,
        email: r.email,
        displayName: r.display_name,
        role: r.role,
        enabled: r.enabled,
        grade: r.grade,
      })),
      devices: devices.rows.map((d) => ({
        deviceId: d.device_id,
        label: d.label,
        ramGb: d.ram_gb,
        gpuClass: d.gpu_class,
        webgl2Supported: d.webgl2_supported,
        networkProfileMbps: Number(d.network_profile_mbps),
      })),
      auditEvents: audits.rows.map((a) => ({
        eventId: a.event_id,
        actionType: a.action_type,
        occurredAt: a.occurred_at.toISOString(),
        retentionClass: a.retention_class,
      })),
    });
  }

  // District or State aggregate view — strictly aggregated, zero individual learner PII, small-cell suppressed (< 5)!
  const whereClause =
    auth.role === "district_admin" && auth.districtId ? "WHERE s.district_id = $1" : "";
  const params = auth.role === "district_admin" && auth.districtId ? [auth.districtId] : [];

  const aggRes = await query<{
    school_code: string;
    school_name: string;
    district_name: string;
    learners: string;
    assignments: string;
    submissions: string;
  }>(
    `SELECT
       s.code AS school_code,
       s.name AS school_name,
       d.name AS district_name,
       (SELECT count(*)::text FROM school_learner sl WHERE sl.school_id = s.school_id AND sl.active = true) AS learners,
       (SELECT count(*)::text FROM assignment a WHERE a.school_id = s.school_id) AS assignments,
       (SELECT count(*)::text FROM assessment asm WHERE asm.school_id = s.school_id AND asm.supersedes_id IS NULL) AS submissions
     FROM school s
     JOIN district d ON d.district_id = s.district_id
     ${whereClause}
     ORDER BY d.name, s.name`,
    params
  );

  return NextResponse.json({
    scope: auth.role === "district_admin" ? "district" : "state",
    districtName: auth.districtName,
    suppressionThreshold: SMALL_CELL_THRESHOLD,
    note: "Individual learner records are never exposed in district/state views. Counts between 1 and 4 are suppressed.",
    schools: aggRes.rows.map((r) => ({
      schoolCode: r.school_code,
      schoolName: r.school_name,
      districtName: r.district_name,
      activeLearners: suppressSmallCell(Number(r.learners)),
      assignmentsPublished: Number(r.assignments),
      submittedAssessments: suppressSmallCell(Number(r.submissions)),
    })),
  });
}

const togglePrincipalSchema = z
  .object({
    principalId: z.string().uuid(),
    enabled: z.boolean(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (!verifyCsrf(req, auth)) return apiError(400, "NOT_AUTHORIZED", "Invalid CSRF token.");
  if (auth.role !== "school_admin" || !auth.schoolId) {
    return apiError(403, "NOT_AUTHORIZED", "School administrator scope required.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "STATE_CONFLICT", "Invalid JSON payload.");
  }
  const parsed = togglePrincipalSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "ACTION_UNSUPPORTED", "Invalid principal status update.");
  }
  if (parsed.data.principalId === auth.principalId) {
    return apiError(409, "STATE_CONFLICT", "Cannot disable your own active administrator account.");
  }

  // Ensure target principal belongs to this school only!
  const check = await query(
    `SELECT 1 FROM role_grant WHERE school_id = $1 AND principal_id = $2 AND revoked_at IS NULL`,
    [auth.schoolId, parsed.data.principalId]
  );
  if (check.rows.length === 0) {
    return apiError(404, "NOT_FOUND", "Principal not found in your school.");
  }

  await query(`UPDATE principal SET enabled = $1 WHERE principal_id = $2`, [
    parsed.data.enabled,
    parsed.data.principalId,
  ]);

  if (!parsed.data.enabled) {
    await query(
      `UPDATE auth_session SET revoked_at = now() WHERE principal_id = $1 AND revoked_at IS NULL`,
      [parsed.data.principalId]
    );
  }

  await recordAuditEvent({
    schoolId: auth.schoolId,
    actionType: parsed.data.enabled ? "school_admin.principal_enabled" : "school_admin.principal_disabled",
    actorId: auth.principalId,
    subjectKey: parsed.data.principalId,
  });

  return NextResponse.json({ updated: true, principalId: parsed.data.principalId, enabled: parsed.data.enabled });
}
