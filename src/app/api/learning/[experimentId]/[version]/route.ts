import { NextRequest, NextResponse } from "next/server";
import { apiError, extractIdempotencyKey, getCurrentSession, verifyCsrf } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { stageSubmission, type LearningContent } from "@/lib/learning-contract";
import type { LearnerJourneyState } from "@/lib/learning";
import type { LabSubject } from "@/lib/types";

const requiredEvents: Record<LabSubject, string[]> = {
  chemistry: ["chem.apparatus.connected", "chem.reagent.verified", "chem.bound.computed"],
  physics: ["phys.optic.mounted", "phys.ray.computed"],
  biology: ["bio.field.selected", "bio.plane.selected", "bio.boundary.annotated"],
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ experimentId: string; version: string }> }) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (auth.role !== "student" || !auth.schoolId || !auth.learnerId) return apiError(403, "NOT_AUTHORIZED", "Student account required.");
  if (!verifyCsrf(req, auth) || !extractIdempotencyKey(req)) return apiError(400, "NOT_AUTHORIZED", "Missing request authorization headers.");

  const parsed = stageSubmission.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(422, "ACTION_UNSUPPORTED", "Submit a valid learning stage and all required answers.");
  const input = parsed.data;
  const { experimentId, version } = await ctx.params;
  const key = [auth.schoolId, auth.learnerId, experimentId, version];

  return withTransaction(async client => {
    const { rows: [published] } = await client.query<{ subject: LabSubject; content: LearningContent }>(
      `SELECT ev.subject, lv.content FROM learning_version lv
       JOIN experiment_version ev USING (experiment_id, content_version)
       WHERE lv.experiment_id = $1 AND lv.content_version = $2 AND ev.published_at IS NOT NULL AND ev.retired_at IS NULL`,
      [experimentId, version],
    );
    if (!published) return apiError(404, "NOT_FOUND", "Published learning version not found.");

    await client.query(`INSERT INTO learning_progress (school_id, learner_id, experiment_id, content_version)
      VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, key);
    const { rows: [current] } = await client.query<LearnerJourneyState>(
      `SELECT completed_stage, score, answers FROM learning_progress
       WHERE school_id = $1 AND learner_id = $2 AND experiment_id = $3 AND content_version = $4 FOR UPDATE`, key,
    );
    if (input.stage > current.completed_stage + 1) return apiError(409, "STATE_CONFLICT", "Complete the preceding stages first.");
    if (input.stage <= current.completed_stage) return NextResponse.json(current);

    if (input.stage === 2) {
      const { rowCount } = await client.query(
        `SELECT ls.session_id FROM lab_session ls
         JOIN attempt a USING (school_id, attempt_id)
         JOIN lab_action la USING (school_id, session_id)
         CROSS JOIN LATERAL jsonb_array_elements_text(la.result->'assessmentEvents') AS event(name)
         WHERE a.school_id = $1 AND a.learner_id = $2 AND a.experiment_id = $3 AND a.content_version = $4
           AND a.mode = 'simulation' AND ls.status IN ('active','paused','submitted')
           AND la.result->>'accepted' = 'true' AND event.name = ANY($5::text[])
         GROUP BY ls.session_id HAVING COUNT(DISTINCT event.name) = cardinality($5::text[]) LIMIT 1`,
        [...key, requiredEvents[published.subject]],
      );
      if (!rowCount) return apiError(409, "STATE_CONFLICT", "Finish the guided apparatus tasks in a saved Simulation session first.");
    }

    const score = input.stage === 5
      ? input.answers.reduce((points, answer, i) => points + Number(answer === published.content.questions[i].correct), 0)
      : null;
    const answers = input.stage === 5 ? input.answers : null;
    const { rows: [updated] } = await client.query<LearnerJourneyState>(
      `UPDATE learning_progress SET completed_stage = $5, updated_at = now(), answers = $6::jsonb, score = $7,
       completed_at = CASE WHEN $5::smallint = 5 THEN now() END
       WHERE school_id = $1 AND learner_id = $2 AND experiment_id = $3 AND content_version = $4
       RETURNING completed_stage, score, answers`,
      [...key, input.stage, answers === null ? null : JSON.stringify(answers), score],
    );
    return NextResponse.json(updated);
  });
}
