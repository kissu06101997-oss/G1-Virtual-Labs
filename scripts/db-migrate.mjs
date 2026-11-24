import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
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

function getClientConfig() {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true";

  // Prefer direct/unpooled connection string for DDL migrations when provided by Neon/Vercel
  const configuredUrl =
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    "";

  if (!configuredUrl && isProduction) {
    throw new Error(
      "[db:migrate] Missing DATABASE_URL / DATABASE_URL_UNPOOLED / POSTGRES_URL in production environment."
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

async function run() {
  const client = new Client(getClientConfig());
  await client.connect();
  try {
    const migrationsDir = path.resolve(process.cwd(), "db/migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migration (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const applied = await client.query("SELECT version FROM schema_migration");
    const appliedSet = new Set(applied.rows.map((r) => r.version));

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[db:migrate] Skipping already applied migration: ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`[db:migrate] Applying migration: ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migration(version) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
      console.log(`[db:migrate] Applied: ${file}`);
    }
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("[db:migrate] Failed:", err);
  process.exit(1);
});
