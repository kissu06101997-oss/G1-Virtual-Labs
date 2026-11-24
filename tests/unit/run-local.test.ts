import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const launcher = fileURLToPath(new URL("../../scripts/run-local.mjs", import.meta.url));

test.each(["dev", "start"])("local %s launches scripts from a path containing spaces", async (mode) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "g1 launcher test "));
  // Supply a loopback listener so the launcher can run against fixture scripts without a database.
  const listener = createServer((socket) => socket.end());

  try {
    await new Promise<void>((resolve, reject) => {
      listener.once("error", reject);
      listener.listen(0, "127.0.0.1", resolve);
    });
    const address = listener.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");

    const scripts = path.join(cwd, "scripts");
    const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin");
    await mkdir(scripts);
    await mkdir(nextBin, { recursive: true });
    await Promise.all([
      writeFile(path.join(scripts, "db-migrate.mjs"), 'console.log("migration fixture");\n'),
      writeFile(path.join(scripts, "db-seed.mjs"), 'console.log("seed fixture");\n'),
      writeFile(path.join(nextBin, "next"), "console.log(JSON.stringify(process.argv.slice(2)));\n"),
    ]);

    const { stdout, stderr } = await execFileAsync(process.execPath, ["--throw-deprecation", launcher, mode], {
      cwd,
      env: { ...process.env, G1_PG_HOST: "127.0.0.1", G1_PG_PORT: String(address.port) },
      timeout: 10_000,
    });

    expect(stdout.trim().split(/\r?\n/).slice(1)).toEqual([
      "migration fixture",
      "seed fixture",
      JSON.stringify([mode, "--hostname", "127.0.0.1", "--port", "3000"]),
    ]);
    expect(stderr).toBe("");
  } finally {
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    await rm(cwd, { recursive: true, force: true });
  }
}, 15_000);
