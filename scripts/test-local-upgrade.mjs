import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

function availablePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(error => error ? reject(error) : resolve(port));
    });
  });
}

const ports = new Set();
while (ports.size < 3) ports.add(await availablePort());
const [dbPort, webPort, mediaPort] = ports;

const base = path.resolve(".data", "qa");
await mkdir(base, { recursive: true });
const root = await mkdtemp(path.join(base, "upgrade-"));
const origin = "http://127.0.0.1:" + webPort;
const database = "postgres://postgres:postgres@127.0.0.1:" + dbPort + "/g1_virtua_labs";
const environment = {
  ...process.env,
  VERCEL: "0", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
  SESSION_SECRET: randomBytes(32).toString("hex"), ALLOW_LOCAL_SYNTHETIC_FIXTURES: "true",
  ENABLE_OPTIONAL_TUTOR: "false", APP_ORIGIN: origin,
  DATABASE_URL: database, DATABASE_URL_UNPOOLED: database, POSTGRES_URL_NON_POOLING: database,
  G1_PG_HOST: "127.0.0.1", G1_PG_PORT: String(dbPort), G1_PG_DATA_DIR: path.join(root, "postgres"),
  PG_POOL_MAX: "1", G1_MEDIA_PORT: String(mediaPort), G1_MEDIA_DIR: path.join(root, "media"),
  G1_TEST_ORIGIN: origin, G1_ISOLATED_UPGRADE_QA: "true",
  G1_UPGRADE_SCREENSHOTS: process.env.G1_UPGRADE_SCREENSHOTS || path.join(root, "screenshots"),
};

const children = [];
function start(file, ...args) {
  const child = spawn(process.execPath, [file, ...args], { env: environment, stdio: "inherit", shell: false });
  children.push(child);
  return child;
}

function run(file, ...args) {
  return new Promise((resolve, reject) => {
    const child = start(file, ...args);
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(file + " exited with " + (signal ?? code))));
  });
}

async function until(description, check) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await setTimeout(200);
  }
  throw new Error("Timed out waiting for " + description);
}

async function listening(port) {
  return new Promise(resolve => {
    const connection = net.createConnection({ host: "127.0.0.1", port });
    connection.once("connect", () => { connection.end(); resolve(true); });
    connection.once("error", () => resolve(false));
  });
}

console.log("[g1-upgrade-qa] Isolated synthetic services on " + origin);
console.log("[g1-upgrade-qa] Screenshots: " + environment.G1_UPGRADE_SCREENSHOTS);
try {
  start("scripts/db-server.mjs");
  await until("embedded PostgreSQL", () => listening(dbPort));
  await run("scripts/db-migrate.mjs");
  await run("scripts/db-seed.mjs");
  await run("node_modules/next/dist/bin/next", "build");
  start("scripts/media-store.mjs");
  start("node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(webPort));
  await until("the website", async () => {
    try { return (await fetch(origin + "/api/health")).ok; } catch { return false; }
  });
  const health = await (await fetch(origin + "/api/health")).json();
  if (!health.localSyntheticMode) throw new Error("Refusing to test a non-synthetic server.");
  await run("node_modules/playwright/cli.js", "test", ...process.argv.slice(2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const child of children) if (child.exitCode === null) child.kill();
}
