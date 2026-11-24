import { GlassBack } from "@/components/GlassBack";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import {
  AdminWorkspaceClient,
  type AggregateAdminData,
  type SchoolAdminData,
} from "@/components/AdminWorkspaceClient";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { query } from "@/lib/db";
import { creatorProvisioningMode } from "@/lib/creator-provisioning";

const SMALL_CELL_THRESHOLD = 5;

function suppress(count: number) {
  if (count > 0 && count < SMALL_CELL_THRESHOLD) {
    return { value: null, suppressed: true, display: `< ${SMALL_CELL_THRESHOLD} (suppressed)` };
  }
  return { value: count, suppressed: false, display: String(count) };
}

export default async function AdminPage() {
  const [auth, locale] = await Promise.all([getCurrentSession(), getRequestLocale()]);
  if (!auth) redirect("/sign-in?next=/admin");

  const allowed = new Set(["school_admin", "district_admin", "state_admin", "operator"]);
  if (!allowed.has(auth.role)) {
    redirect(
      auth.role === "student"
        ? "/student"
        : auth.role === "teacher"
          ? "/teacher"
          : "/content"
    );
  }

  let data: SchoolAdminData | AggregateAdminData;
  const generatedAt = new Date().toISOString();

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
        `SELECT p.principal_id, pc.email, pc.display_name, rg.role::text, p.enabled, sl.grade
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

    data = {
      scope: "school",
      schoolName: auth.schoolName,
      generatedAt,
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
    };
  } else {
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
         s.code AS school_code, s.name AS school_name, d.name AS district_name,
         (SELECT count(*)::text FROM school_learner sl WHERE sl.school_id = s.school_id AND sl.active = true) AS learners,
         (SELECT count(*)::text FROM assignment a WHERE a.school_id = s.school_id) AS assignments,
         (SELECT count(*)::text FROM assessment asm WHERE asm.school_id = s.school_id AND asm.supersedes_id IS NULL) AS submissions
       FROM school s
       JOIN district d ON d.district_id = s.district_id
       ${whereClause}
       ORDER BY d.name, s.name`,
      params
    );

    data = {
      scope: auth.role === "district_admin" ? "district" : "state",
      districtName: auth.districtName,
      generatedAt,
      suppressionThreshold: SMALL_CELL_THRESHOLD,
      note:
        locale === "te-IN"
          ? "సమీకరించిన సింథటిక్ పైలట్ గణాంకాలు మాత్రమే. వ్యక్తిగత విద్యార్థుల గుర్తింపు ఎప్పుడూ బహిర్గతం చేయబడదు."
          : "Aggregated synthetic pilot telemetry only. Individual student identities are never exposed.",
      schools: aggRes.rows.map((r) => ({
        schoolCode: r.school_code,
        schoolName: r.school_name,
        districtName: r.district_name,
        activeLearners: suppress(Number(r.learners)),
        assignmentsPublished: Number(r.assignments),
        submittedAssessments: suppress(Number(r.submissions)),
      })),
    };
  }

  return (
    <>
      <AppHeader variant="admin" locale={locale} auth={auth} />
      {creatorProvisioningMode(auth) && (
        <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-8 lg:px-12">
          <Link className="g1-btn g1-btn-outline" href="/admin/creators">{creatorProvisioningMode(auth) === "synthetic"
            ? (locale === "te-IN" ? "స్థానిక రచయిత ఖాతా సృష్టించండి" : "Create local creator account")
            : (locale === "te-IN" ? "రచయిత ఖాతా సృష్టించండి" : "Create creator account")}</Link>
        </div>
      )}
      <main
        id="main-content"
        data-workspace="admin" className="g1-premium mx-auto w-full max-w-[1440px] flex-1 px-4 py-9 sm:px-8 lg:px-12"
      >
        <GlassBack href="/" label={locale === "te-IN" ? "ముఖపుటకు తిరిగి" : "Back to home"} />
        <AdminWorkspaceClient
          data={data}
          currentPrincipalId={auth.principalId}
          locale={locale}
        />
      </main>

    </>
  );
}
