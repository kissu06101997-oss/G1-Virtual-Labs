import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";

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

const databaseUrl =
  process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:54329/g1_virtua_labs";

async function reset() {
  const host = new URL(databaseUrl).hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host) ||
      ["1", "true"].includes(process.env.VERCEL) || process.env.ALLOW_LOCAL_SYNTHETIC_FIXTURES !== "true") {
    throw new Error("Reset requires an explicitly enabled local synthetic database.");
  }
  // The reset, migration and seed must use the same verified loopback database.
  process.env.DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL_UNPOOLED = databaseUrl;
  process.env.POSTGRES_URL_NON_POOLING = databaseUrl;
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    console.log("[db:reset] Dropping and recreating public schema...");
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  } finally {
    await client.end();
  }

  const migrate = spawnSync(process.execPath, [path.resolve("scripts/db-migrate.mjs")], { stdio: "inherit" });
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);

  const seed = spawnSync(process.execPath, [path.resolve("scripts/db-seed.mjs")], { stdio: "inherit" });
  if (seed.status !== 0) process.exit(seed.status ?? 1);
  console.log("[db:reset] Local synthetic database reset complete.");
}

reset().catch((err) => {
  console.error("[db:reset] Failed:", err);
  process.exit(1);
});
