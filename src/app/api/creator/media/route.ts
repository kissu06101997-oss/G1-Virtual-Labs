import { NextRequest, NextResponse } from "next/server";
import { rename, rm, stat, writeFile } from "node:fs/promises";
import { z } from "zod";
import { apiError, extractIdempotencyKey, getCurrentSession, verifyCsrf } from "@/lib/auth";
import { newUuid } from "@/lib/crypto";
import { query, withTransaction } from "@/lib/db";
import { localMediaEnabled, localUploadUrl, mediaPath, validateMedia } from "@/lib/local-media";
import { blobMediaEnabled, startBlobUpload, blobUploadTicket, cancelBlobUpload, InvalidHostedMedia, verifyBlobUpload, type BlobUpload } from "@/lib/blob-media";

export const maxDuration = 180;

const extensions = {
  "image/png": ["png"], "image/jpeg": ["jpg", "jpeg"], "image/webp": ["webp"],
  "video/mp4": ["mp4"], "video/webm": ["webm"],
};
type MediaType = keyof typeof extensions;

const inputSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("prepare"), filename: z.string().trim().min(1).max(240),
    type: z.enum(["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"]),
    bytes: z.number().int().positive().max(5 * 1024 ** 4) }),
  z.object({ operation: z.literal("resume"), id: z.uuid() }),
  z.object({ operation: z.literal("finish"), id: z.uuid() }),
  z.object({ operation: z.literal("part"), id: z.uuid(), partNumber: z.number().int().min(1).max(9000), etag: z.string().min(1).max(150).regex(/^[a-zA-Z0-9"-]+$/) }),
  z.object({ operation: z.literal("cancel"), id: z.uuid() }),
]);

export async function POST(req: NextRequest) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  if (auth.role !== "creator") return apiError(403, "NOT_AUTHORIZED", "Creator role required.");
  if (!verifyCsrf(req, auth) || !extractIdempotencyKey(req)) return apiError(400, "NOT_AUTHORIZED", "Missing request authorization headers.");
  const hosted = blobMediaEnabled();
  if (!hosted && !localMediaEnabled()) return apiError(503, "STATE_CONFLICT", "No upload storage is configured.");

  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(422, "ACTION_UNSUPPORTED", "Invalid upload request.");
  const input = parsed.data;
  if (input.operation === "prepare") {
    const extension = input.filename.split(".").at(-1)?.toLowerCase() || "";
    if (/[\\/\u0000-\u001f\u007f]/.test(input.filename) || !extensions[input.type].includes(extension)) {
      return apiError(422, "ACTION_UNSUPPORTED", "The filename or extension does not match the requested media type.");
    }
    const id = newUuid();
    const cloud = hosted ? await startBlobUpload(id, extension, input.bytes) : null;
    await query(`INSERT INTO creator_media(asset_id, owner_principal_id, filename, media_type, expected_bytes, blob_upload)
      VALUES($1, $2, $3, $4, $5, $6)`, [id, auth.principalId, input.filename, input.type, input.bytes, cloud && JSON.stringify(cloud)]);
    if (cloud) return NextResponse.json({ id, hosted: await blobUploadTicket(cloud, input.type, input.bytes) });
    return NextResponse.json({ id, uploadUrl: localUploadUrl(id, input.bytes) });
  }

  return withTransaction(async client => {
    const { rows: [asset] } = await client.query<{ status: string; expected_bytes: string; media_type: MediaType; blob_upload: BlobUpload | null }>(
      "SELECT status, expected_bytes, media_type, blob_upload FROM creator_media WHERE asset_id = $1 AND owner_principal_id = $2 FOR UPDATE",
      [input.id, auth.principalId],
    );
    if (!asset) return apiError(404, "NOT_FOUND", "Media asset not found.");
    if (input.operation === "finish" && asset.status === "ready") return NextResponse.json({ id: input.id, status: "ready" });
    if (input.operation === "cancel" && asset.status === "canceled") return NextResponse.json({ id: input.id, status: "canceled" });
    if (asset.status !== "uploading") return apiError(409, "STATE_CONFLICT", "Upload is no longer open.");
    const bytes = Number(asset.expected_bytes);
    const cloud = asset.blob_upload;
    if (cloud) {
      if (!hosted) return apiError(503, "STATE_CONFLICT", "Hosted media storage is unavailable.");
      const partCount = Math.ceil(bytes / cloud.partSize);
      if (input.operation === "resume") return NextResponse.json({ id: input.id, hosted: await blobUploadTicket(cloud, asset.media_type, bytes) });
      if (input.operation === "part") {
        if (input.partNumber > partCount || input.partNumber > cloud.parts.length + 1) {
          return apiError(409, "STATE_CONFLICT", "Upload parts must be confirmed in sequence.");
        }
        cloud.parts[input.partNumber - 1] = { partNumber: input.partNumber, etag: input.etag };
        await client.query("UPDATE creator_media SET blob_upload = $2 WHERE asset_id = $1", [input.id, JSON.stringify(cloud)]);
        return NextResponse.json({ id: input.id, partNumber: input.partNumber });
      }
      if (input.operation === "cancel") {
        await cancelBlobUpload(cloud);
        await client.query("UPDATE creator_media SET status = 'canceled' WHERE asset_id = $1", [input.id]);
        return NextResponse.json({ id: input.id, status: "canceled" });
      }
      if (cloud.parts.length !== partCount) return apiError(409, "STATE_CONFLICT", "Upload is incomplete. Resume it first.");
      try {
        const verified = await verifyBlobUpload(cloud, asset.media_type, bytes);
        await client.query("UPDATE creator_media SET status = 'ready', sha256 = $2, blob_url = $3, blob_upload = NULL WHERE asset_id = $1",
          [input.id, verified.sha256, verified.url]);
        return NextResponse.json({ id: input.id, status: "ready" });
      } catch (error) {
        if (!(error instanceof InvalidHostedMedia)) return apiError(503, "STATE_CONFLICT", "Hosted media verification is temporarily unavailable. Resume to retry.");
        await cancelBlobUpload(cloud);
        await client.query("UPDATE creator_media SET status = 'failed' WHERE asset_id = $1", [input.id]);
        return apiError(422, "ACTION_UNSUPPORTED", error.message);
      }
    }
    if (!localMediaEnabled()) return apiError(503, "STATE_CONFLICT", "This media was uploaded to local storage.");
    if (input.operation === "part") return apiError(422, "ACTION_UNSUPPORTED", "This media uses local storage.");
    if (input.operation === "resume") return NextResponse.json({ id: input.id, uploadUrl: localUploadUrl(input.id, bytes) });
    const partial = mediaPath(input.id, ".part");
    const stored = mediaPath(input.id, ".blob");
    if (input.operation === "cancel") {
      await writeFile(mediaPath(input.id, ".canceled"), "");
      await rm(partial, { force: true });
      await client.query("UPDATE creator_media SET status = 'canceled' WHERE asset_id = $1", [input.id]);
      return NextResponse.json({ id: input.id, status: "canceled" });
    }
    const alreadyStored = Boolean(await stat(stored).catch(() => null));
    const file = alreadyStored ? stored : partial;
    if ((await stat(file).catch(() => null))?.size !== bytes) return apiError(409, "STATE_CONFLICT", "Upload is incomplete. Resume it first.");
    let hash: string;
    try { hash = await validateMedia(file, asset.media_type, bytes); }
    catch (error) {
      const missingProbe = (error as NodeJS.ErrnoException).code === "ENOENT";
      if (missingProbe) return apiError(503, "STATE_CONFLICT", "FFprobe is required to verify local uploads.");
      await client.query("UPDATE creator_media SET status = 'failed' WHERE asset_id = $1", [input.id]);
      return apiError(422, "ACTION_UNSUPPORTED", error instanceof Error && !("cmd" in error) ? error.message : "Media verification failed.");
    }
    if (!alreadyStored) await rename(partial, stored);
    await client.query("UPDATE creator_media SET status = 'ready', sha256 = $2 WHERE asset_id = $1", [input.id, hash]);
    return NextResponse.json({ id: input.id, status: "ready" });
  });
}
