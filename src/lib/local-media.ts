import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

export type MediaType = "image/png" | "image/jpeg" | "image/webp" | "video/mp4" | "video/webm";
const run = promisify(execFile);

export function mediaPath(id: string, extension: ".part" | ".blob" | ".canceled") {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) throw new Error("Invalid object ID");
  return path.resolve(process.env.G1_MEDIA_DIR || ".data/media", id + extension);
}

export function localMediaEnabled() {
  let name: string;
  try { name = new URL(process.env.APP_ORIGIN || "http://127.0.0.1:3000").hostname; }
  catch { return false; }
  return !["1", "true"].includes(process.env.VERCEL || "") && process.env.ALLOW_LOCAL_SYNTHETIC_FIXTURES === "true" &&
    ["127.0.0.1", "localhost"].includes(name);
}

export function localUploadUrl(id: string, bytes: number) {
  const secret = process.env.SESSION_SECRET || "";
  if (!localMediaEnabled() || secret.length < 32) throw new Error("Local upload storage is unavailable.");
  const body = Buffer.from(JSON.stringify({ id, bytes, expires: Date.now() + 20 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update("g1-media:" + body).digest("base64url");
  return "http://127.0.0.1:" + Number(process.env.G1_MEDIA_PORT || 3002) + "/" + id + "?ticket=" + body + "." + signature;
}

export async function validateMedia(file: string, type: MediaType, bytes: number) {
  if ((await stat(file)).size !== bytes) throw new Error("Upload is incomplete. Resume it before verifying.");
  const handle = await open(file, "r");
  const head = Buffer.alloc(16);
  try { await handle.read(head, 0, head.length, 0); } finally { await handle.close(); }
  validateMediaSignature(head, type);

  const { stdout } = await run("ffprobe", ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries",
    "stream=codec_type,codec_name,width,height:format=format_name,duration", "-of", "json", file], { timeout: 15000, windowsHide: true });
  validateProbeReport(JSON.parse(stdout), type);

  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export function validateMediaSignature(head: Buffer, type: MediaType) {
  const match = {
    "image/png": head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/jpeg": head.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
    "image/webp": head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP",
    "video/mp4": head.toString("ascii", 4, 8) === "ftyp",
    "video/webm": head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3,
  }[type];
  if (!match) throw new Error("The file signature does not match the selected media type.");
}

export function validateProbeReport(input: unknown, type: MediaType) {
  const report = input as {
    streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number }[];
    format?: { format_name?: string; duration?: string };
  };
  const image = report.streams?.find(stream => stream.codec_type === "video");
  const codec = image?.codec_name || "";
  const supported = {
    "image/png": ["png"], "image/jpeg": ["mjpeg"], "image/webp": ["webp"],
    "video/mp4": ["h264", "av1"], "video/webm": ["vp8", "vp9", "av1"],
  }[type];
  if (!image?.width || !image.height || !supported.includes(codec)) throw new Error("Unsupported image or video encoding.");
  if (type.startsWith("video/")) {
    const duration = Number(report.format?.duration);
    const audio = report.streams?.filter(stream => stream.codec_type === "audio") ?? [];
    const supportedAudio = type === "video/mp4" ? ["aac"] : ["vorbis", "opus"];
    if (!Number.isFinite(duration) || duration <= 0 || audio.some(stream => !supportedAudio.includes(stream.codec_name ?? ""))) {
      throw new Error("Unsupported video duration or audio encoding.");
    }
    if (type === "video/webm" && !report.format?.format_name?.split(",").includes("webm")) throw new Error("A WebM container is required.");
  }
}
