import fs from "node:fs";
import path from "node:path";
import { query } from "./db";
import type { CatalogItem, ExperimentDefinition, LabSubject } from "./types";

export async function listCatalogExperiments(filters?: {
  subject?: LabSubject;
  grade?: number;
  q?: string;
  includeDrafts?: boolean;
}): Promise<CatalogItem[]> {
  const where: string[] = ["ev.retired_at IS NULL", "(ev.experiment_id NOT LIKE 'creator-%' OR ev.published_at IS NOT NULL)"];
  const params: unknown[] = [];

  if (filters?.subject) {
    params.push(filters.subject);
    where.push(`ev.subject = $${params.length}::lab_subject`);
  }

  if (filters?.grade && Number.isInteger(filters.grade)) {
    params.push(filters.grade);
    where.push(`(ev.definition->>'grade')::int = $${params.length}`);
  }

  if (filters?.q && filters.q.trim().length > 0) {
    params.push(`%${filters.q.trim().toLowerCase()}%`);
    where.push(
      `(LOWER(ev.experiment_id) LIKE $${params.length} OR LOWER(ev.definition->>'title') LIKE $${params.length} OR LOWER(ev.definition::text) LIKE $${params.length})`
    );
  }

  const sql = `
    SELECT * FROM (
      SELECT DISTINCT ON (ev.experiment_id)
        ev.experiment_id,
        ev.content_version,
        ev.subject,
        ev.manifest_digest,
        ev.abi,
        ev.definition,
        ev.published_at,
        ev.retired_at
      FROM experiment_version ev
      WHERE ${where.join(" AND ")}
      ORDER BY
        ev.experiment_id,
        (ev.published_at IS NOT NULL) DESC,
        ev.published_at DESC NULLS LAST,
        ev.content_version DESC
    ) latest
    ORDER BY
      CASE WHEN latest.published_at IS NOT NULL THEN 0 ELSE 1 END,
      CASE latest.subject WHEN 'chemistry' THEN 1 WHEN 'physics' THEN 2 ELSE 3 END,
      latest.experiment_id ASC
  `;

  const res = await query<{
    experiment_id: string;
    content_version: string;
    subject: LabSubject;
    manifest_digest: string;
    abi: string;
    definition: ExperimentDefinition;
    published_at: Date | null;
    retired_at: Date | null;
  }>(sql, params);

  return res.rows.map((row) => ({
    ...row.definition,
    manifestSha256: row.manifest_digest,
    engineAbi: row.abi,
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    retiredAt: row.retired_at ? row.retired_at.toISOString() : null,
  }));
}

export async function getExperimentById(
  experimentId: string,
  contentVersion?: string
): Promise<CatalogItem | null> {
  const params: unknown[] = [experimentId];
  let versionClause = "";
  if (contentVersion) {
    params.push(contentVersion);
    versionClause = ` AND ev.content_version = $2`;
  }

  const res = await query<{
    manifest_digest: string;
    abi: string;
    definition: ExperimentDefinition;
    published_at: Date | null;
    retired_at: Date | null;
  }>(
    `SELECT ev.manifest_digest, ev.abi, ev.definition, ev.published_at, ev.retired_at
     FROM experiment_version ev
     WHERE ev.experiment_id = $1${versionClause}
     ORDER BY (ev.retired_at IS NULL) DESC, ev.published_at DESC NULLS LAST, ev.content_version DESC
     LIMIT 1`,
    params
  );

  const row = res.rows[0];
  if (!row) return null;

  return {
    ...row.definition,
    manifestSha256: row.manifest_digest,
    engineAbi: row.abi,
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    retiredAt: row.retired_at ? row.retired_at.toISOString() : null,
  };
}

// Normalizes literal "null" strings found in the REA CSV research corpus (Independent Audit finding!)
export function normalizeResearchNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

export interface ApCorpusSummary {
  totalCandidates: number;
  bySubject: Record<LabSubject, number>;
  currentEditionCount: number;
  priorEditionCount: number;
  sourceFilePresent: boolean;
}

let cachedCorpusSummary: ApCorpusSummary | null = null;

export function getApCorpusSummary(): ApCorpusSummary {
  if (cachedCorpusSummary) return cachedCorpusSummary;

  const csvPath = path.resolve(
    process.cwd(),
    "project-brief/AI_Virtual_Labs_Labster_REA_Research_2026-11/data/ap_experiment_catalog.csv"
  );

  if (!fs.existsSync(csvPath)) {
    return {
      totalCandidates: 340,
      bySubject: { chemistry: 120, physics: 130, biology: 90 },
      currentEditionCount: 126,
      priorEditionCount: 214,
      sourceFilePresent: false,
    };
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const dataLines = lines.slice(1);
  let chemistry = 0;
  let physics = 0;
  let biology = 0;
  let currentEdition = 0;
  let priorEdition = 0;

  for (const line of dataLines) {
    const lower = line.toLowerCase();
    if (lower.includes(",chemistry,") || lower.includes('"chemistry"')) chemistry++;
    else if (lower.includes(",physics,") || lower.includes('"physics"')) physics++;
    else if (lower.includes(",biology,") || lower.includes('"biology"')) biology++;

    if (lower.includes("2026-27") || lower.includes("2026–27") || lower.includes("current")) {
      currentEdition++;
    } else {
      priorEdition++;
    }
  }

  cachedCorpusSummary = {
    totalCandidates: dataLines.length,
    bySubject: { chemistry, physics, biology },
    currentEditionCount: currentEdition,
    priorEditionCount: priorEdition,
    sourceFilePresent: true,
  };
  return cachedCorpusSummary;
}
