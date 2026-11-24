import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, extractIdempotencyKey, getCurrentSession, verifyCsrf } from "@/lib/auth";
import { hmacToken } from "@/lib/crypto";
import { withTransaction } from "@/lib/db";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).refine(name => !/\p{Cc}/u.test(name)),
}).strict();

export async function PUT(req: NextRequest) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (auth.role !== "student" || !auth.schoolId || !auth.learnerId) {
    return apiError(404, "NOT_FOUND", "Student profile not found.");
  }
  const key = extractIdempotencyKey(req);
  if (!key || !verifyCsrf(req, auth)) {
    return apiError(400, "NOT_AUTHORIZED", "Missing request authorization headers.");
  }
  const parsed = profileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(422, "ACTION_UNSUPPORTED", "Enter a display name between 1 and 100 characters.");

  const { displayName } = parsed.data;
  const scope = `student-profile:${auth.schoolId}:${auth.principalId}`;
  const digest = hmacToken(displayName);
  const outcome = await withTransaction(async client => {
    const learner = await client.query(
      `SELECT 1 FROM school_learner
       WHERE school_id = $1 AND learner_id = $2 AND principal_id = $3 AND active = true FOR UPDATE`,
      [auth.schoolId, auth.learnerId, auth.principalId]
    );
    if (!learner.rowCount) return "missing";

    const existing = await client.query<{ request_digest: string }>(
      "SELECT request_digest FROM idempotency_record WHERE scope = $1 AND idempotency_key = $2",
      [scope, key]
    );
    if (existing.rows[0]) return existing.rows[0].request_digest === digest ? "saved" : "mismatch";

    await client.query(
      "UPDATE school_learner SET profile_display_name = $3 WHERE school_id = $1 AND learner_id = $2",
      [auth.schoolId, auth.learnerId, displayName]
    );
    await client.query(
      `INSERT INTO idempotency_record (scope, idempotency_key, request_digest, status_code, response_body)
       VALUES ($1, $2, $3, 204, '{}'::jsonb)`,
      [scope, key, digest]
    );
    return "saved";
  });
  if (outcome === "missing") return apiError(404, "NOT_FOUND", "Student profile not found.");
  if (outcome === "mismatch") return apiError(409, "IDEMPOTENCY_MISMATCH", "This request key was already used.");
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
