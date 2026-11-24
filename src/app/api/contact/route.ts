import { NextResponse } from "next/server";
import { CONTACT_RATE_SECONDS, parseContactInquiry, readContactBody, recordContactInquiry, takeContactRateSlot } from "@/lib/contact-inquiries";

function reply(status: number, code: string, fields?: string[]) {
  return NextResponse.json({ code, fields }, {
    status,
    headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": String(CONTACT_RATE_SECONDS) } : {}) },
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const previewOrigins = process.env.VERCEL_ENV === "preview"
    ? [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean).map(host => `https://${host}`)
    : [];
  const allowedOrigin = process.env.APP_ORIGIN ||
    (process.env.VERCEL === "1" ? undefined : "http://127.0.0.1:3000");
  if ((!allowedOrigin || origin !== new URL(allowedOrigin).origin) && !previewOrigins.some(allowed => origin === allowed)) {
    return reply(403, "origin");
  }
  const mediaType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") return reply(415, "invalid");

  try {
    if (!await takeContactRateSlot(request.headers)) return reply(429, "limited");
    let body: unknown;
    try {
      body = await readContactBody(request);
    } catch {
      return reply(400, "invalid");
    }
    const parsed = parseContactInquiry(body);
    if (!parsed.success) {
      return reply(400, "invalid", [...new Set(parsed.error.issues.map(issue => String(issue.path[0] ?? "")))]);
    }
    if (!await takeContactRateSlot(request.headers, parsed.data.email)) return reply(429, "limited");
    const result = await recordContactInquiry(parsed.data);
    return reply(result === "recorded" ? 201 : 200, result);
  } catch {
    console.error("[contact] Could not record inquiry.");
    return reply(503, "unavailable");
  }
}
