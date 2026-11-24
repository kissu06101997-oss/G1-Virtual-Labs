import { NextResponse } from "next/server";
import { apiError, getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (auth.role !== "teacher" && auth.role !== "school_admin") {
    return apiError(403, "NOT_AUTHORIZED", "Teacher or school admin role required.");
  }
  if (!auth.schoolId) {
    return apiError(403, "NOT_AUTHORIZED", "School context missing.");
  }

  const sql =
    auth.role === "teacher"
      ? `SELECT
           cl.class_id,
           cl.label,
           cl.grade,
           (SELECT count(*)::text FROM enrollment e WHERE e.school_id = cl.school_id AND e.class_id = cl.class_id AND e.withdrawn_at IS NULL) AS enrolled_learners,
           (SELECT count(*)::text FROM assignment a WHERE a.school_id = cl.school_id AND a.class_id = cl.class_id) AS assigned_practicals,
           (SELECT count(*)::text FROM assessment asm JOIN attempt att ON att.school_id = asm.school_id AND att.attempt_id = asm.attempt_id WHERE asm.school_id = cl.school_id AND att.class_id = cl.class_id AND asm.supersedes_id IS NULL) AS submitted_assessments
         FROM classroom cl
         JOIN class_teacher ct ON ct.school_id = cl.school_id AND ct.class_id = cl.class_id
         WHERE cl.school_id = $1 AND ct.principal_id = $2
         ORDER BY cl.grade DESC, cl.label ASC`
      : `SELECT
           cl.class_id,
           cl.label,
           cl.grade,
           (SELECT count(*)::text FROM enrollment e WHERE e.school_id = cl.school_id AND e.class_id = cl.class_id AND e.withdrawn_at IS NULL) AS enrolled_learners,
           (SELECT count(*)::text FROM assignment a WHERE a.school_id = cl.school_id AND a.class_id = cl.class_id) AS assigned_practicals,
           (SELECT count(*)::text FROM assessment asm JOIN attempt att ON att.school_id = asm.school_id AND att.attempt_id = asm.attempt_id WHERE asm.school_id = cl.school_id AND att.class_id = cl.class_id AND asm.supersedes_id IS NULL) AS submitted_assessments
         FROM classroom cl
         WHERE cl.school_id = $1
         ORDER BY cl.grade DESC, cl.label ASC`;

  const res = await query<{
    class_id: string;
    label: string;
    grade: number;
    enrolled_learners: string;
    assigned_practicals: string;
    submitted_assessments: string;
  }>(sql, auth.role === "teacher" ? [auth.schoolId, auth.principalId] : [auth.schoolId]);

  return NextResponse.json({
    schoolId: auth.schoolId,
    schoolName: auth.schoolName,
    classes: res.rows.map((r) => ({
      classId: r.class_id,
      label: r.label,
      grade: r.grade,
      enrolledLearners: Number(r.enrolled_learners),
      assignedPracticals: Number(r.assigned_practicals),
      submittedAssessments: Number(r.submitted_assessments),
    })),
  });
}
