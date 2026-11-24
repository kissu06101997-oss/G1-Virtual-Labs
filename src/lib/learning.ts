import type { PoolClient } from "pg";
import { query } from "./db";
import type { LearningContent } from "./learning-contract";
import type { AuthContext } from "./types";

export interface LearnerJourneyState {
  completed_stage: number;
  answers: number[] | null;
  score: number | null;
}

export async function getLearningContent(experimentId: string, version: string) {
  const result = await query<{ content: LearningContent }>(
    `SELECT lv.content
     FROM learning_version lv JOIN experiment_version ev USING (experiment_id, content_version)
     WHERE lv.experiment_id = $1 AND lv.content_version = $2 AND ev.published_at IS NOT NULL AND ev.retired_at IS NULL`,
    [experimentId, version],
  );
  return result.rows[0]?.content ?? null;
}

export async function getLearningProgress(auth: AuthContext | null, experimentId: string, version: string) {
  if (auth?.role !== "student" || !auth.schoolId || !auth.learnerId) return null;
  const result = await query<LearnerJourneyState>(
    `SELECT completed_stage, answers, score FROM learning_progress
      WHERE school_id = $1 AND learner_id = $2 AND experiment_id = $3 AND content_version = $4`,
    [auth.schoolId, auth.learnerId, experimentId, version],
  );
  return result.rows[0] ?? null;
}

export async function isExperimentUnlocked(
  client: PoolClient, schoolId: string, learnerId: string, experimentId: string, version: string,
) {
  const result = await client.query<{ unlocked: boolean }>(
    `SELECT NOT EXISTS (
        SELECT 1 FROM learning_version WHERE experiment_id = $3 AND content_version = $4
      ) OR EXISTS (
        SELECT 1 FROM learning_progress
        WHERE school_id = $1 AND learner_id = $2 AND experiment_id = $3 AND content_version = $4
          AND completed_stage = 5
      ) AS unlocked`,
    [schoolId, learnerId, experimentId, version],
  );
  return result.rows[0].unlocked;
}

export async function getGuidedSession(schoolId: string, learnerId: string, experimentId: string, version: string, assignmentId: string | null) {
  const result = await query<{ session_id: string; status: string }>(
    `SELECT ls.session_id, ls.status
     FROM lab_session ls JOIN attempt a USING (school_id, attempt_id)
     WHERE a.school_id = $1 AND a.learner_id = $2 AND a.experiment_id = $3 AND a.content_version = $4
       AND a.mode = 'simulation' AND ls.status IN ('active','paused','submitted')
       AND a.assignment_id IS NOT DISTINCT FROM $5::uuid
     ORDER BY (ls.status IN ('active','paused')) DESC, ls.saved_at DESC LIMIT 1`,
    [schoolId, learnerId, experimentId, version, assignmentId],
  );
  return result.rows[0] ?? null;
}
