import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getCurrentSession, LOCALE_COOKIE_NAME } from "@/lib/auth";
import { query } from "@/lib/db";

const localeSchema = z.object({
  locale: z.enum(["en-IN", "te-IN"]),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "STATE_CONFLICT", "Invalid JSON body.");
  }
  const parsed = localeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "STATE_CONFLICT", "Locale must be en-IN or te-IN.");
  }

  const auth = await getCurrentSession();
  if (auth) {
    await query(`UPDATE principal SET preferred_locale = $1 WHERE principal_id = $2`, [
      parsed.data.locale,
      auth.principalId,
    ]);
  }

  const response = NextResponse.json({ locale: parsed.data.locale });
  response.cookies.set(LOCALE_COOKIE_NAME, parsed.data.locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}
