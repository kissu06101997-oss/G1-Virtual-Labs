import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/auth";
import { listCatalogExperiments } from "@/lib/catalog";
import { resolveEducationStage } from "@/lib/education-stages";
import type { LabSubject } from "@/lib/types";

const VALID_SUBJECTS = new Set<LabSubject>(["chemistry", "physics", "biology"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const labIdParam = searchParams.get("labId") ?? searchParams.get("subject");
  const gradeParam = searchParams.get("grade") ?? searchParams.get("stage");
  const q = searchParams.get("q") ?? undefined;
  const includeMetadata = searchParams.get("meta") === "1";

  let subject: LabSubject | undefined;
  if (labIdParam) {
    if (!VALID_SUBJECTS.has(labIdParam as LabSubject)) {
      return apiError(400, "STATE_CONFLICT", "Invalid labId; expected chemistry, physics, or biology.");
    }
    subject = labIdParam as LabSubject;
  }

  let grade: number | undefined;
  if (gradeParam) {
    const resolved = resolveEducationStage(gradeParam);
    if (!resolved) {
      return apiError(
        400,
        "STATE_CONFLICT",
        "Invalid grade or stage; expected 6–12 or class-6..intermediate-2."
      );
    }
    grade = resolved.grade;
  }

  const rows = await listCatalogExperiments({ subject, grade, q });

  // Strict OpenAPI / ExperimentDefinition items when meta is not requested
  const items = includeMetadata
    ? rows
    : rows.map((row) => {
        const { manifestSha256: _m, engineAbi: _a, publishedAt: _p, retiredAt: _r, ...definition } = row;
        return definition;
      });

  return NextResponse.json({
    items,
    nextCursor: null,
  });
}
