import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { buildExperimentDefinitions } from "./db-seed.mjs";

const { Client } = pg;

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvLocal();

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalJson(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

function getClientConfig() {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true";

  const configuredUrl =
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    "";

  if (!configuredUrl && isProduction) {
    throw new Error(
      "[db:seed:catalog] Missing DATABASE_URL / POSTGRES_URL in production environment."
    );
  }

  const connectionString =
    configuredUrl || "postgres://postgres:postgres@127.0.0.1:54329/g1_virtua_labs";
  const parsed = new URL(connectionString);
  const host = parsed.hostname.toLowerCase();
  const isLocal = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
  if (!isLocal) parsed.searchParams.set("sslmode", "verify-full");

  return {
    connectionString: isLocal ? connectionString : parsed.toString(),
    ...(!isLocal ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}

/**
 * Seeds ONLY authorized public curriculum & laboratory catalogue data.
 * Never creates or modifies student, teacher, school, class, assignment, or attempt records.
 */
export async function seedCatalogOnly() {
  const client = new Client(getClientConfig());
  await client.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO laboratory (subject, scene_family) VALUES
        ('chemistry', 'room-chemistry@1'),
        ('physics', 'room-physics@1'),
        ('biology', 'room-biology@1')
       ON CONFLICT (subject) DO NOTHING`
    );

    await client.query(
      `INSERT INTO curriculum_ref (curriculum_id, source_id, edition, locator, medium) VALUES
        ('AP-CURR-10-CHEM-2.3', 'AP-REF-10-PS', 'Prior official edition; current 2026-27 confirmation pending', 'Activity 2.3, print 38, PDF 49', 'en-IN/te-IN'),
        ('AP-CURR-10-PHYS-9.10', 'AP-REF-10-PS', 'Prior official edition; current 2026-27 confirmation pending', 'Activity 9.10, print 184, PDF 195', 'en-IN/te-IN'),
        ('AP-CURR-09-BIO-5.1', 'AP-REF-09-1', 'Prior official edition; current 2026-27 confirmation pending', 'Activity 5.1, print 2-4, PDF 12-14', 'en-IN/te-IN')
       ON CONFLICT (curriculum_id) DO NOTHING`
    );

    const scienceModelsPath = path.resolve(process.cwd(), "specs/science_models.json");
    const scienceModels = JSON.parse(fs.readFileSync(scienceModelsPath, "utf8"));
    for (const model of scienceModels) {
      const digest = sha256Hex(canonicalJson(model));
      await client.query(
        `INSERT INTO model_version (model_id, version, subject, profile, model_digest, dataset_digest)
         VALUES ($1, $2, $3::lab_subject, $4::jsonb, $5, $6)
         ON CONFLICT (model_id, version) DO NOTHING`,
        [model.modelId, model.version, model.subject, JSON.stringify(model), digest, model.datasetSha256]
      );
    }

    const definitions = buildExperimentDefinitions();
    const currMap = {
      "AP-CHEM-10-2.3": "AP-CURR-10-CHEM-2.3",
      "AP-PHYS-10-9.10": "AP-CURR-10-PHYS-9.10",
      "AP-BIO-09-5.1": "AP-CURR-09-BIO-5.1",
    };

    for (const def of definitions) {
      const manifestDigest = sha256Hex(canonicalJson(def));
      const isPublished =
        def.publicationStatus === "research_fixture" || def.publicationStatus === "approved";

      await client.query(
        `INSERT INTO experiment (experiment_id, subject) VALUES ($1, $2::lab_subject)
         ON CONFLICT (experiment_id) DO NOTHING`,
        [def.experimentId, def.subject]
      );

      await client.query(
        `INSERT INTO experiment_version
          (experiment_id, content_version, subject, manifest_digest, abi, definition, published_at)
         VALUES ($1, $2, $3::lab_subject, $4, 'lab@1', $5::jsonb, $6)
         ON CONFLICT (experiment_id, content_version) DO NOTHING`,
        [
          def.experimentId,
          def.contentVersion,
          def.subject,
          manifestDigest,
          JSON.stringify(def),
          isPublished ? "2026-11-22T09:00:00+05:30" : null,
        ]
      );

      if (currMap[def.experimentId]) {
        await client.query(
          `INSERT INTO experiment_curriculum (experiment_id, content_version, curriculum_id)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [def.experimentId, def.contentVersion, currMap[def.experimentId]]
        );
      }

      for (const mRef of def.scienceModelIds) {
        const [mId, mVer] = mRef.split("@");
        await client.query(
          `INSERT INTO experiment_model (experiment_id, content_version, subject, model_id, model_version)
           VALUES ($1, $2, $3::lab_subject, $4, $5) ON CONFLICT DO NOTHING`,
          [def.experimentId, def.contentVersion, def.subject, mId, mVer]
        );
      }
    }

    await client.query("COMMIT");
    console.log(
      `[db:seed:catalog] Safely seeded ${definitions.length} public experiment definitions and ${scienceModels.length} science models (no student/teacher records modified).`
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  seedCatalogOnly().catch((err) => {
    console.error("[db:seed:catalog] Failed:", err);
    process.exit(1);
  });
}
