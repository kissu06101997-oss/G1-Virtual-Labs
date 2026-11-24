import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const host = process.env.G1_PG_HOST || "127.0.0.1";
const port = Number(process.env.G1_PG_PORT || 54329);
const dataDir = path.resolve(process.cwd(), process.env.G1_PG_DATA_DIR || ".data/pgdata");

fs.mkdirSync(dataDir, { recursive: true });

console.log(`[g1-db] Starting local PostgreSQL (PGlite) at ${host}:${port} using ${dataDir}`);
const db = await PGlite.create({ dataDir });
// The app pool, migrations and development workers can briefly overlap.
const server = new PGLiteSocketServer({ db, host, port, maxConnections: 8 });

await server.start();
console.log(`[g1-db] Ready — listening on postgres://postgres:postgres@${host}:${port}/g1_virtua_labs`);

async function shutdown(signal) {
  console.log(`[g1-db] Received ${signal}, flushing PostgreSQL storage...`);
  try {
    await server.stop();
    await db.close();
  } catch (err) {
    console.error("[g1-db] Shutdown warning:", err);
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
