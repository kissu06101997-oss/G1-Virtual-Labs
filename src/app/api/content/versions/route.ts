import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getCurrentSession, recordAuditEvent, verifyCsrf } from "@/lib/auth";
import { canonicalJson, newUuid, sha256Hex } from "@/lib/crypto";
import { getApCorpusSummary } from "@/lib/catalog";
import { query, withTransaction } from "@/lib/db";
import type { ExperimentDefinition } from "@/lib/types";

export async function GET() {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (auth.role !== "content_editor" && auth.role !== "content_reviewer" && auth.role !== "state_admin") {
    return apiError(403, "NOT_AUTHORIZED", "Content editorial or reviewer role required.");
  }

  const [versionsRes, reviewsRes, modelsRes] = await Promise.all([
    query<{
      experiment_id: string;
      content_version: string;
      subject: string;
      manifest_digest: string;
      abi: string;
      definition: ExperimentDefinition;
      published_at: Date | null;
      retired_at: Date | null;
    }>(
      `SELECT experiment_id, content_version, subject::text, manifest_digest, abi, definition, published_at, retired_at
       FROM experiment_version
       ORDER BY experiment_id ASC, content_version DESC`
    ),
    query<{
      review_id: string;
      experiment_id: string;
      content_version: string;
      editor_principal_id: string;
      editor_name: string;
      reviewer_principal_id: string | null;
      reviewer_name: string | null;
      status: string;
      checklist: Record<string, boolean>;
      notes: string | null;
      submitted_at: Date;
      reviewed_at: Date | null;
    }>(
      `SELECT
         er.review_id,
         er.experiment_id,
         er.content_version,
         er.editor_principal_id,
         ed.display_name AS editor_name,
         er.reviewer_principal_id,
         rv.display_name AS reviewer_name,
         er.status,
         er.checklist,
         er.notes,
         er.submitted_at,
         er.reviewed_at
       FROM editorial_review er
       JOIN principal_credential ed ON ed.principal_id = er.editor_principal_id
       LEFT JOIN principal_credential rv ON rv.principal_id = er.reviewer_principal_id
       ORDER BY er.submitted_at DESC`
    ),
    query<{
      model_id: string;
      version: string;
      subject: string;
      profile: Record<string, unknown>;
      model_digest: string;
    }>(`SELECT model_id, version, subject::text, profile, model_digest FROM model_version ORDER BY subject, model_id`),
  ]);

  return NextResponse.json({
    role: auth.role,
    principalId: auth.principalId,
    apCorpusSummary: getApCorpusSummary(),
    versions: versionsRes.rows.map((v) => ({
      experimentId: v.experiment_id,
      contentVersion: v.content_version,
      subject: v.subject,
      manifestSha256: v.manifest_digest,
      engineAbi: v.abi,
      publicationStatus: v.definition.publicationStatus,
      title: v.definition.title,
      grade: v.definition.grade,
      publishedAt: v.published_at ? v.published_at.toISOString() : null,
      retiredAt: v.retired_at ? v.retired_at.toISOString() : null,
    })),
    reviews: reviewsRes.rows.map((r) => ({
      reviewId: r.review_id,
      experimentId: r.experiment_id,
      contentVersion: r.content_version,
      editorPrincipalId: r.editor_principal_id,
      editorName: r.editor_name,
      reviewerPrincipalId: r.reviewer_principal_id,
      reviewerName: r.reviewer_name,
      status: r.status,
      checklist: r.checklist,
      notes: r.notes,
      submittedAt: r.submitted_at.toISOString(),
      reviewedAt: r.reviewed_at ? r.reviewed_at.toISOString() : null,
    })),
    scienceModels: modelsRes.rows.map((m) => ({
      modelId: m.model_id,
      version: m.version,
      subject: m.subject,
      modelDigest: m.model_digest,
      profile: m.profile,
    })),
  });
}

const createDraftSchema = z
  .object({
    experimentId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/),
    baseVersion: z.string().min(1).max(128),
    newContentVersion: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/),
    notes: z.string().min(4).max(500),
    checklist: z.object({
      editionVerified: z.boolean(),
      bilingualChecked: z.boolean(),
      safetyReviewed: z.boolean(),
      modelBounded: z.boolean(),
      rightsCleared: z.boolean(),
    }),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (!verifyCsrf(req, auth)) return apiError(400, "NOT_AUTHORIZED", "Invalid CSRF token.");
  if (auth.role !== "content_editor") {
    return apiError(403, "NOT_AUTHORIZED", "Only a content editor can propose a new draft version.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "STATE_CONFLICT", "Invalid JSON payload.");
  }
  const parsed = createDraftSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "ACTION_UNSUPPORTED", "Draft version payload failed validation.");
  }
  const input = parsed.data;
  if (input.experimentId.startsWith("creator-")) {
    return apiError(403, "NOT_AUTHORIZED", "Creator versions must be revised through the Creator Workspace.");
  }

  const out = await withTransaction(async (client) => {
    const baseRes = await client.query<{
      subject: string;
      abi: string;
      definition: ExperimentDefinition;
    }>(
      `SELECT subject::text, abi, definition FROM experiment_version WHERE experiment_id = $1 AND content_version = $2`,
      [input.experimentId, input.baseVersion]
    );
    const base = baseRes.rows[0];
    if (!base) {
      return { status: 404, error: "Base experiment version not found." };
    }

    const exists = await client.query(
      `SELECT 1 FROM experiment_version WHERE experiment_id = $1 AND content_version = $2`,
      [input.experimentId, input.newContentVersion]
    );
    if (exists.rows.length > 0) {
      return { status: 409, error: `Version '${input.newContentVersion}' already exists.` };
    }

    const newDef: ExperimentDefinition = {
      ...base.definition,
      contentVersion: input.newContentVersion,
      publicationStatus: "review_pending",
    };
    const manifestDigest = sha256Hex(canonicalJson(newDef));

    await client.query(
      `INSERT INTO experiment_version
        (experiment_id, content_version, subject, manifest_digest, abi, definition, published_at)
       VALUES ($1, $2, $3::lab_subject, $4, $5, $6::jsonb, NULL)`,
      [input.experimentId, input.newContentVersion, base.subject, manifestDigest, base.abi, JSON.stringify(newDef)]
    );

    const reviewId = newUuid();
    await client.query(
      `INSERT INTO editorial_review
        (review_id, experiment_id, content_version, editor_principal_id, status, checklist, notes)
       VALUES ($1, $2, $3, $4, 'submitted', $5::jsonb, $6)`,
      [reviewId, input.experimentId, input.newContentVersion, auth.principalId, JSON.stringify(input.checklist), input.notes]
    );

    await recordAuditEvent(
      {
        schoolId: null,
        actionType: "content.version_submitted",
        actorId: auth.principalId,
        subjectKey: `${input.experimentId}@${input.newContentVersion}`,
      },
      client
    );

    return {
      status: 201,
      body: {
        reviewId,
        experimentId: input.experimentId,
        contentVersion: input.newContentVersion,
        manifestSha256: manifestDigest,
        status: "submitted",
      },
    };
  });

  if ("error" in out && out.error) {
    return apiError(out.status, out.status === 409 ? "STATE_CONFLICT" : "NOT_FOUND", out.error);
  }
  return NextResponse.json(out.body, { status: out.status });
}
