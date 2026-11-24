import { NextRequest, NextResponse } from "next/server";
import { open, stat, type FileHandle } from "node:fs/promises";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { localMediaEnabled, mediaPath } from "@/lib/local-media";
import { blobMediaEnabled, fetchPrivateBlob } from "@/lib/blob-media";

function streamFileRange(file: FileHandle, start: number, end: number) {
  let position = start;
  let finished = false;
  let closing: Promise<void> | undefined;
  const close = () => closing ??= file.close();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) return;
      try {
        const buffer = new Uint8Array(Math.min(64 * 1024, end - position + 1));
        const { bytesRead } = await file.read(buffer, 0, buffer.length, position);
        if (finished) return;
        if (!bytesRead) throw new Error("Media object ended unexpectedly.");
        position += bytesRead;
        controller.enqueue(buffer.subarray(0, bytesRead));
        if (position > end) {
          finished = true;
          controller.close();
          await close();
        }
      } catch (error) {
        if (!finished) {
          finished = true;
          controller.error(error);
        }
        await close().catch(() => undefined);
      }
    },
    async cancel() {
      finished = true;
      await close();
    },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success || (!localMediaEnabled() && !blobMediaEnabled())) return new NextResponse(null, { status: 404 });
  const auth = await getCurrentSession();
  const { rows: [item] } = await query<{ media_type: string; blob_url: string | null }>(
    `SELECT media_type, blob_url FROM creator_media cm WHERE cm.asset_id = $1 AND cm.status = 'ready' AND (
       cm.owner_principal_id = $2 OR EXISTS (
         SELECT 1 FROM learning_version lv JOIN experiment_version ev USING (experiment_id, content_version)
         WHERE (lv.content->>'videoId' = cm.asset_id::text OR lv.content->>'thumbnailId' = cm.asset_id::text)
           AND ((ev.published_at IS NOT NULL AND ev.retired_at IS NULL) OR ($3::boolean AND EXISTS (
             SELECT 1 FROM editorial_review er WHERE er.experiment_id = lv.experiment_id
               AND er.content_version = lv.content_version AND er.status IN ('submitted','approved','rework')
           )))
       )
     )`, [id, auth?.role === "creator" ? auth.principalId : null, auth?.role === "content_reviewer"],
  );
  if (!item) return new NextResponse(null, { status: 404 });
  if (item.blob_url) {
    if (!blobMediaEnabled()) return new NextResponse(null, { status: 503 });
    const range = req.headers.get("range");
    const response = await fetchPrivateBlob(item.blob_url, range ? { Range: range } : undefined, req.signal)
      .catch(() => null);
    if (!response) return new NextResponse(null, { status: 503 });
    const headers = new Headers({ "Content-Type": item.media_type, "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" });
    const contentRange = response.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);
    if (!response.ok) {
      await response.body?.cancel();
      return new NextResponse(null, { status: response.status === 416 ? 416 : response.status === 404 ? 404 : 503, headers });
    }
    const length = response.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    return new NextResponse(response.body, { status: response.status, headers });
  }
  if (!localMediaEnabled()) return new NextResponse(null, { status: 404 });
  const file = mediaPath(id, ".blob");
  const info = await stat(file).catch(() => null);
  if (!info) return new NextResponse(null, { status: 404 });

  const headers = new Headers({ "Content-Type": item.media_type, "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" });
  const range = req.headers.get("range");
  const parsed = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (!parsed || (!parsed[1] && !parsed[2]))) {
    headers.set("Content-Range", "bytes */" + info.size);
    return new NextResponse(null, { status: 416, headers });
  }
  const start = parsed ? (parsed[1] ? Number(parsed[1]) : Math.max(0, info.size - Number(parsed[2]))) : 0;
  const end = parsed?.[1] && parsed[2] ? Math.min(info.size - 1, Number(parsed[2])) : info.size - 1;
  if (start >= info.size || start > end) {
    headers.set("Content-Range", "bytes */" + info.size);
    return new NextResponse(null, { status: 416, headers });
  }
  headers.set("Content-Length", String(end - start + 1));
  if (parsed) headers.set("Content-Range", "bytes " + start + "-" + end + "/" + info.size);
  const handle = await open(file, "r").catch(() => null);
  if (!handle) return new NextResponse(null, { status: 404 });
  return new NextResponse(streamFileRange(handle, start, end), { status: parsed ? 206 : 200, headers });
}
