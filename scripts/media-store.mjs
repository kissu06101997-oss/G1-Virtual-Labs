import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const origin = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
const port = Number(process.env.G1_MEDIA_PORT || 3002);
const root = path.resolve(process.env.G1_MEDIA_DIR || ".data/media");
const secret = process.env.SESSION_SECRET || "";
if (secret.length < 32 || !["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) {
  throw new Error("The local media store requires a local APP_ORIGIN and SESSION_SECRET.");
}

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const active = new Set();

function verify(ticket, id) {
  const [body, signature, extra] = (ticket || "").split(".");
  if (!body || !signature || extra) return null;
  const expected = crypto.createHmac("sha256", secret).update("g1-media:" + body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  const grant = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  return grant.id === id && grant.expires > Date.now() && Number.isSafeInteger(grant.bytes) && grant.bytes > 0 ? grant : null;
}

await fs.mkdir(root, { recursive: true });
const server = http.createServer(async (req, res) => {
  function reply(code, extra) {
    res.writeHead(code, extra);
    res.end();
  }

  if (req.headers.origin !== origin) return reply(403);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Expose-Headers", "Upload-Offset");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    return reply(204, {
      "Access-Control-Allow-Methods": "HEAD, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Upload-Offset",
      "Access-Control-Max-Age": "600",
    });
  }

  try {
    const url = new URL(req.url, origin);
    const id = url.pathname.slice(1);
    if (!uuid.test(id)) return reply(404);
    const grant = verify(url.searchParams.get("ticket"), id);
    if (!grant) return reply(403);

    const partial = path.join(root, id + ".part");
    const finalized = path.join(root, id + ".blob");
    if (await fs.stat(finalized).catch(() => null) ||
        await fs.stat(path.join(root, id + ".canceled")).catch(() => null)) return reply(409);
    const size = (await fs.stat(partial).catch(() => null))?.size ?? 0;
    if (req.method === "HEAD") return reply(200, { "Upload-Offset": String(size) });
    if (req.method !== "PUT") return reply(405);

    const offset = Number(req.headers["upload-offset"]);
    const length = Number(req.headers["content-length"]);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length <= 0 ||
        length > grant.bytes - offset || req.headers["content-type"] !== "application/octet-stream") return reply(400);
    if (offset !== size || active.has(id)) return reply(409, { "Upload-Offset": String(size) });
    active.add(id);
    try {
      await pipeline(req, createWriteStream(partial, { flags: "a", mode: 0o600 }));
      reply(204, { "Upload-Offset": String(size + length) });
    } finally {
      active.delete(id);
    }
  } catch (error) {
    if (!res.destroyed && !res.headersSent) reply(error.code === "ENOSPC" ? 507 : 500);
    else if (!res.destroyed) res.destroy();
  }
});
server.listen(port, "127.0.0.1", () => console.log("[g1-media] Local upload store ready on http://127.0.0.1:" + port));
