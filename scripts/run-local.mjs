import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";

const mode = process.argv[2] || "dev";
const host = process.env.G1_PG_HOST || "127.0.0.1";
const port = Number(process.env.G1_PG_PORT || 54329);

function checkPort(h, p) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: h, port: p });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(h, p, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkPort(h, p)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function spawnNode(script, args = []) {
  return spawn(process.execPath, [path.resolve(script), ...args], {
    stdio: "inherit",
    shell: false,
  });
}

function runScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawnNode(script);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with ${signal ?? `code ${code}`}`));
    });
  });
}

async function main() {
  let dbChild = null;
  const alreadyUp = await checkPort(host, port);
  if (!alreadyUp) {
    console.log("[run-local] Starting embedded PostgreSQL server...");
    dbChild = spawnNode("scripts/db-server.mjs");
    const ready = await waitForPort(host, port);
    if (!ready) {
      console.error("[run-local] PostgreSQL failed to start within 15s.");
      dbChild.kill();
      process.exit(1);
    }
  } else {
    console.log(`[run-local] Reusing PostgreSQL listening on ${host}:${port}`);
  }

  try {
    await runScript("scripts/db-migrate.mjs");
    await runScript("scripts/db-seed.mjs");
  } catch (error) {
    dbChild?.kill();
    throw error;
  }

  const nextMode = mode === "start" ? "start" : "dev";
  const webChild = spawnNode("node_modules/next/dist/bin/next", [
    nextMode, "--hostname", "127.0.0.1", "--port", "3000",
  ]);

  const cleanup = () => {
    webChild.kill();
    if (dbChild) dbChild.kill();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  webChild.once("error", (error) => {
    console.error("[run-local] Could not start Next.js:", error);
    dbChild?.kill();
    process.exit(1);
  });

  webChild.on("exit", (code) => {
    if (dbChild) dbChild.kill();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[run-local] Error:", err);
  process.exit(1);
});
