import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, extractIdempotencyKey, getCurrentSession, recordAuditEvent, verifyCsrf } from "@/lib/auth";
import { canonicalJson, newUuid, sha256Hex } from "@/lib/crypto";
import { withTransaction } from "@/lib/db";
import { draftSchema, lessonDraftSchema, submissionSchema, trustedLabBindings } from "@/lib/creator-contract";
import type { ExperimentDefinition } from "@/lib/types";

const payload = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("save"), id: z.uuid(), revision: z.number().int().min(0), body: draftSchema }).strict(),
  z.object({ operation: z.literal("submit"), id: z.uuid(), revision: z.number().int().positive() }).strict(),
  z.object({ operation: z.literal("lesson"), lesson: lessonDraftSchema }).strict(),
]);

export async function POST(req: NextRequest) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (auth.role !== "creator") return apiError(403, "NOT_AUTHORIZED", "Creator role required.");
  if (!verifyCsrf(req, auth) || !extractIdempotencyKey(req)) return apiError(400, "NOT_AUTHORIZED", "Missing request authorization headers.");
  const request = payload.safeParse(await req.json().catch(() => null));
  if (!request.success) return apiError(422, "ACTION_UNSUPPORTED", "The draft fields could not be saved.");
  const input = request.data;
  return withTransaction(async client => {
    if (input.operation === "lesson") {
      const lesson = input.lesson;
      const id = [lesson.subject, lesson.grade, lesson.code].join("-");
      const created = await client.query(`INSERT INTO lab_lesson(lesson_id, subject, grade, title_en, title_te, curriculum_order, owner_principal_id)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING lesson_id`,
        [id, lesson.subject, lesson.grade, lesson.titleEn, lesson.titleTe, lesson.order, auth.principalId]);
      if (!created.rowCount) return apiError(409, "STATE_CONFLICT", "This lesson code is already in use for that class and subject.");
      await recordAuditEvent({ schoolId: null, actionType: "creator.lesson_drafted", actorId: auth.principalId, subjectKey: id }, client);
      return NextResponse.json({ id, ...lesson }, { status: 201 });
    }

    const { rows: [draft] } = await client.query<{
      body: unknown; revision: number; review_id: string | null; status: string | null;
    }>(`SELECT d.body, d.revision, d.review_id, er.status FROM creator_draft d
         LEFT JOIN editorial_review er ON er.review_id = d.review_id
         WHERE d.draft_id = $1 AND d.owner_principal_id = $2 FOR UPDATE OF d`, [input.id, auth.principalId]);

    if (input.operation === "save") {
      if (!draft && input.revision === 0) {
        const created = await client.query(`INSERT INTO creator_draft (draft_id, owner_principal_id, body)
          VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING RETURNING revision`, [input.id, auth.principalId, JSON.stringify(input.body)]);
        if (!created.rowCount) return apiError(409, "STATE_CONFLICT", "Draft was already saved. Reopen it before editing.");
        return NextResponse.json({ id: input.id, revision: 1 });
      }
      if (!draft) return apiError(404, "NOT_FOUND", "Draft not found.");
      if (draft.revision !== input.revision || (draft.status && draft.status !== "rework")) {
        return apiError(409, "STATE_CONFLICT", "Draft has changed or is locked for review. Reopen it before editing.");
      }
      const next = await client.query<{ revision: number }>(`UPDATE creator_draft
        SET body = $1::jsonb, revision = revision + 1, updated_at = now() WHERE draft_id = $2 RETURNING revision`,
        [JSON.stringify(input.body), input.id]);
      return NextResponse.json({ id: input.id, revision: next.rows[0].revision });
    }

    if (!draft) return apiError(404, "NOT_FOUND", "Draft not found.");
    if (draft.revision !== input.revision || (draft.status && draft.status !== "rework")) {
      return apiError(409, "STATE_CONFLICT", "Save the latest draft before submitting or reopen it to see review status.");
    }
    const validated = submissionSchema.safeParse(draft.body);
    if (!validated.success) {
      return NextResponse.json({ detail: "Complete the draft before submitting.",
        issues: validated.error.issues.map(issue => issue.path.join(".") + " — " + issue.message) }, { status: 422 });
    }
    const data = validated.data;
    const id = "creator-" + data.slug;
    const version = data.version;
    const binding = trustedLabBindings[data.subject];
    const lesson = await client.query(`SELECT 1 FROM lab_lesson WHERE lesson_id = $1 AND subject = $2 AND grade = $3
      AND (published_at IS NOT NULL OR owner_principal_id = $4)`, [data.lessonId, data.subject, data.grade, auth.principalId]);
    if (!lesson.rowCount) return apiError(422, "ACTION_UNSUPPORTED", "Choose a lesson for the selected class and subject.");
    const mappings = [{ grade: data.grade, lessonId: data.lessonId }, ...(data.additionalLessons ?? [])];
    if (new Set(mappings.map(mapping => mapping.grade)).size !== mappings.length) {
      return apiError(422, "ACTION_UNSUPPORTED", "Choose at most one mapped lesson per class and mark one primary class.");
    }
    const allowedLessons = await client.query<{ lesson_id: string; grade: number }>(
      `SELECT lesson_id, grade FROM lab_lesson WHERE subject = $1 AND lesson_id = ANY($2::text[])
       AND (published_at IS NOT NULL OR owner_principal_id = $3)`,
      [data.subject, mappings.map(mapping => mapping.lessonId), auth.principalId],
    );
    if (!mappings.every(mapping => allowedLessons.rows.some(row => row.lesson_id === mapping.lessonId && row.grade === mapping.grade))) {
      return apiError(422, "ACTION_UNSUPPORTED", "Each additional lesson must match its class and the selected subject.");
    }
    const media = await client.query<{ asset_id: string; media_type: string; sha256: string }>(
      `SELECT asset_id, media_type, sha256 FROM creator_media
       WHERE owner_principal_id = $1 AND status = 'ready' AND asset_id = ANY($2::uuid[]) ORDER BY asset_id`,
      [auth.principalId, [data.learning.thumbnailId, data.learning.videoId].filter(Boolean)],
    );
    if (!media.rows.some(asset => asset.asset_id === data.learning.thumbnailId && asset.media_type.startsWith("image/")) ||
      (data.learning.videoId && !media.rows.some(asset => asset.asset_id === data.learning.videoId && asset.media_type.startsWith("video/")))) {
      return apiError(422, "ACTION_UNSUPPORTED", "Select completed, verified media from your library.");
    }
    const base = await client.query<{ abi: string; definition: ExperimentDefinition; content_version: string; manifest_digest: string }>(
      `SELECT abi, definition, content_version, manifest_digest FROM experiment_version WHERE experiment_id = $1
       AND content_version = '0.1.0-research' AND subject = $2 AND published_at IS NOT NULL AND retired_at IS NULL`,
      [binding.experimentId, data.subject],
    );
    if (!base.rowCount) return apiError(422, "MODEL_UNQUALIFIED", "The reviewed built-in model binding is unavailable.");
    if (data.labManifest && (data.labManifest.engine !== data.subject ||
      data.labManifest.sourceExperimentId !== binding.experimentId || data.labManifest.engineAbi !== base.rows[0].abi ||
      data.labManifest.manifestSha256 !== base.rows[0].manifest_digest)) {
      return apiError(422, "MODEL_UNQUALIFIED", "The uploaded manifest must match the registered lab and its immutable fingerprint.");
    }

    await client.query(`INSERT INTO experiment (experiment_id, subject, creator_principal_id)
      VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [id, data.subject, auth.principalId]);
    const ownership = await client.query(`SELECT 1 FROM experiment WHERE experiment_id = $1 AND subject = $2
      AND creator_principal_id = $3 FOR UPDATE`, [id, data.subject, auth.principalId]);
    if (!ownership.rowCount) return apiError(409, "STATE_CONFLICT", "This experiment slug is reserved.");

    const definition: ExperimentDefinition = {
      ...base.rows[0].definition, experimentId: id, title: data.learning.title.en, grade: data.grade,
      contentVersion: version, publicationStatus: "review_pending",
    };
    const reviewedBinding = data.labManifest ?? {
      engine: data.subject, engineAbi: base.rows[0].abi, sourceExperimentId: binding.experimentId,
      sourceVersion: base.rows[0].content_version, simulationEntry: "guided-player@1", experimentEntry: "inquiry-player@1",
      manifestSha256: base.rows[0].manifest_digest,
    };
    const fingerprint = sha256Hex(canonicalJson({ definition, learning: data.learning, mappings,
      activity: data.activity, keywords: data.keywords, media: media.rows, reviewedBinding }));
    const inserted = await client.query(`INSERT INTO experiment_version(experiment_id,content_version,subject,manifest_digest,abi,definition)
      VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING RETURNING experiment_id`,
      [id, version, data.subject, fingerprint, base.rows[0].abi, JSON.stringify(definition)]);
    if (!inserted.rowCount) return apiError(409, "VERSION_MISMATCH", "This version already exists. Choose a new version number.");
    for (const [index, mapping] of mappings.entries()) {
      await client.query(`INSERT INTO experiment_lesson(experiment_id,content_version,subject,grade,lesson_id,activity_number,is_primary)
        VALUES($1,$2,$3,$4,$5,$6,$7)`, [id, version, data.subject, mapping.grade, mapping.lessonId, data.activity, index === 0]);
    }
    await client.query(`INSERT INTO learning_version(experiment_id,content_version,content) VALUES($1,$2,$3::jsonb)`,
      [id, version, JSON.stringify({ ...data.learning, keywords: data.keywords, reviewedBinding })]);
    await client.query(`INSERT INTO experiment_model (experiment_id,content_version,subject,model_id,model_version)
      SELECT $1,$2,subject,model_id,model_version FROM experiment_model WHERE experiment_id = $3 AND content_version = $4`,
      [id, version, binding.experimentId, base.rows[0].content_version]);
    const reviewId = newUuid();
    await client.query(`INSERT INTO editorial_review(review_id,experiment_id,content_version,editor_principal_id,status,checklist,notes)
      VALUES($1,$2,$3,$4,'submitted',$5::jsonb,$6)`,
      [reviewId,id,version,auth.principalId,JSON.stringify({ rightsCleared: true, modelBounded: true, bilingualChecked: true }), data.notes]);
    await client.query("UPDATE creator_draft SET review_id = $1, updated_at = now() WHERE draft_id = $2", [reviewId, input.id]);
    await recordAuditEvent({ schoolId: null, actionType: "creator.submitted", actorId: auth.principalId, subjectKey: id + "@" + version }, client);
    return NextResponse.json({ reviewId, experimentId: id, contentVersion: version, status: "submitted" }, { status: 201 });
  });
}
