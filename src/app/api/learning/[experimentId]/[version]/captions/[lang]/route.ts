import { getLearningContent } from "@/lib/learning";

export async function GET(_: Request, ctx: { params: Promise<{ experimentId: string; version: string; lang: string }> }) {
  const { experimentId, version, lang } = await ctx.params;
  if (lang !== "en" && lang !== "te") return new Response(null, { status: 404 });
  const content = await getLearningContent(experimentId, version);
  const captions = content?.videoId ? content.captions?.[lang] : undefined;
  if (!captions?.trim()) return new Response(null, { status: 404 });
  return new Response(captions, { headers: { "Content-Type": "text/vtt; charset=utf-8",
    "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=60" } });
}
