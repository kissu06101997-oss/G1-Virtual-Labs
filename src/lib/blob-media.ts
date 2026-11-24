import { BlobNotFoundError, completeMultipartUpload, createMultipartUpload, del, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";
import { validateMediaSignature, validateProbeReport, type MediaType } from "./local-media";

const access = "private" as const;
const probe = promisify(execFile);

type Part = { partNumber: number; etag: string };
export type BlobUpload = {
  pathname: string;
  uploadId: string;
  key: string;
  partSize: number;
  parts: Part[];
};

export function blobMediaEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function startBlobUpload(id: string, extension: string, bytes: number): Promise<BlobUpload> {
  const pathname = `creator/${id}.${extension}`;
  const partSize = Math.max(8 * 1024 * 1024, Math.ceil(bytes / 9000));
  const upload = await createMultipartUpload(pathname, { access, allowOverwrite: false });
  return { pathname, partSize, ...upload, parts: [] };
}

export async function blobUploadTicket(upload: BlobUpload, type: MediaType, bytes: number) {
  const token = await generateClientTokenFromReadWriteToken({
    pathname: upload.pathname,
    allowedContentTypes: [type],
    maximumSizeInBytes: bytes,
    allowOverwrite: false,
    validUntil: Date.now() + 15 * 60 * 1000,
  });
  return { ...upload, token };
}

export async function objectFromBlob(pathname: string) {
  try {
    return await head(pathname);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

export async function cancelBlobUpload(upload: BlobUpload) {
  const object = await objectFromBlob(upload.pathname);
  if (object) await del(object.url);
}

export function fetchPrivateBlob(url: string, headers?: HeadersInit, signal?: AbortSignal) {
  const source = new URL(url);
  if (source.protocol !== "https:" || !source.hostname.endsWith(".private.blob.vercel-storage.com")) {
    throw new Error("Invalid private media URL");
  }
  // Provider credentials stay in server-side requests and redirects are refused.
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Authorization", `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`);
  return fetch(source, { headers: requestHeaders, redirect: "error", cache: "no-store", signal });
}

export class InvalidHostedMedia extends Error {}

const formats: Record<MediaType, string> = {
  "image/png": "png_pipe",
  "image/jpeg": "jpeg_pipe",
  "image/webp": "webp_pipe",
  "video/mp4": "mov,mp4,m4a,3gp,3g2,mj2",
  "video/webm": "matroska,webm",
};

export async function verifyBlobUpload(upload: BlobUpload, type: MediaType, bytes: number) {
  const object = await objectFromBlob(upload.pathname) ??
    await completeMultipartUpload(upload.pathname, upload.parts, { access, uploadId: upload.uploadId, key: upload.key });

  const metadata = "size" in object ? object : await head(object.url);
  if (metadata.size !== bytes) throw new InvalidHostedMedia("Uploaded size does not match.");
  const signature = await fetchPrivateBlob(object.url, { Range: "bytes=0-15" }, AbortSignal.timeout(15000));
  if (signature.status !== 206) {
    await signature.body?.cancel();
    throw new Error("Could not read private media signature.");
  }
  try {
    validateMediaSignature(Buffer.from(await signature.arrayBuffer()), type);
  } catch {
    throw new InvalidHostedMedia("Media signature does not match.");
  }

  const response = await fetchPrivateBlob(object.url, undefined, AbortSignal.timeout(110000));
  if (!response.ok || !response.body) throw new Error("Could not read private media.");
  const hash = createHash("sha256");
  let read = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      read += chunk.value.byteLength;
      hash.update(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (read !== bytes) throw new Error("Uploaded content is unavailable.");

  const executable = process.platform === "linux" && process.arch === "x64"
    ? path.resolve(process.cwd(), "node_modules/@ffprobe-installer/linux-x64/ffprobe")
    : "ffprobe";
  const { stdout } = await probe(executable, [
    "-v", "error", "-protocol_whitelist", "https,tcp,tls", "-tls_verify", "1", "-format_whitelist", formats[type],
    "-headers", `Authorization: Bearer ${process.env.BLOB_READ_WRITE_TOKEN}\r\n`,
    "-show_entries", "stream=codec_type,codec_name,width,height:format=format_name,duration",
    "-of", "json", object.url,
  ], { timeout: 25000, windowsHide: true }).catch(error => {
    // The probe command includes a server credential. Never log or return the original error.
    if (error.code === "ENOENT" || error.killed) throw new Error("Hosted media probe unavailable.");
    throw new InvalidHostedMedia("Media encoding could not be verified.");
  });
  try {
    validateProbeReport(JSON.parse(stdout), type);
  } catch {
    throw new InvalidHostedMedia("Unsupported media encoding.");
  }
  return { url: object.url, sha256: hash.digest("hex") };
}
