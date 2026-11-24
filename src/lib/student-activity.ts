import { query } from "./db";
import type { AuthContext, LabMode, LabSubject } from "./types";

export async function listStudentActivity(
  auth: AuthContext | null,
  { limit = 3, offset = 0, text = "", mode = "" } = {},
) {
  if (auth?.role !== "student" || !auth.schoolId || !auth.learnerId) return [];

  const result = await query<{
    session_id: string;
    experiment_id: string;
    mode: LabMode;
    subject: LabSubject;
    revision: string;
    status: "active" | "paused" | "submitted";
    title: string;
    title_te: string | null;
    saved_at: Date;
    completed: number;
    total: number;
  }>(
    `SELECT ls.session_id, a.experiment_id, a.mode, ev.subject, ls.revision::text, ls.status,
        ls.saved_at, ev.definition->>'title' AS title, lv.content->'title'->>'te' AS title_te,
        CASE WHEN jsonb_typeof(ls.state->'completedSteps') = 'array'
          THEN jsonb_array_length(ls.state->'completedSteps') ELSE 0 END AS completed,
        COALESCE((ls.state->>'totalSteps')::int, 0) AS total
     FROM lab_session ls
     JOIN attempt a USING (school_id, attempt_id)
     JOIN experiment_version ev USING (experiment_id, content_version)
     LEFT JOIN learning_version lv USING (experiment_id, content_version)
     WHERE a.school_id = $1 AND a.learner_id = $2
       AND ls.status IN ('active', 'paused', 'submitted')
       AND ($3 = '' OR strpos(lower(ev.definition->>'title'), lower($3)) > 0
         OR strpos(lower(a.experiment_id), lower($3)) > 0 OR strpos(lv.content->'title'->>'te', $3) > 0)
       AND ($4 = '' OR a.mode::text = $4)
     ORDER BY ls.saved_at DESC, ls.session_id DESC
     LIMIT $5 OFFSET $6`,
    [auth.schoolId, auth.learnerId, text, mode, limit, offset],
  );
  return result.rows;
}

export type StudentActivity = Awaited<ReturnType<typeof listStudentActivity>>[number];
