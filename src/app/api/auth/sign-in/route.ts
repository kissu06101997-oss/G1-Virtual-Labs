import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  attachSessionCookies,
  checkAuthRateLimit,
  clearAuthRateLimit,
  createAuthSession,
  recordAuditEvent,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { query } from "@/lib/db";
import type { Locale, PrincipalRole } from "@/lib/types";

const signInSchema = z.object({
  email: z.string().trim().max(200).refine(value =>
    z.email().safeParse(value).success || /^[a-z][a-z0-9_.-]{2,47}$/i.test(value)),
  password: z.string().min(8).max(128),
  requestedRole: z
    .enum([
      "student",
      "teacher",
      "school_admin",
      "district_admin",
      "state_admin",
      "content_editor",
      "content_reviewer",
      "creator",
    ])
    .optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "STATE_CONFLICT", "Invalid JSON body.");
  }

  const parsed = signInSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "STATE_CONFLICT", "Enter an account email or creator username and password.");
  }

  const email = parsed.data.email.trim().toLowerCase();
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const rateKey = `${email}:${clientIp}`;

  if (!checkAuthRateLimit(rateKey)) {
    return apiError(429, "RATE_LIMITED", "Too many sign-in attempts. Wait before trying again.");
  }

  const userRes = await query<{
    principal_id: string;
    email: string;
    display_name: string;
    password_hash: string;
    password_salt: string;
    is_synthetic: boolean;
    enabled: boolean;
    preferred_locale: Locale;
  }>(
    `SELECT
       p.principal_id,
       c.email,
       c.display_name,
       c.password_hash,
       c.password_salt,
       c.is_synthetic,
       p.enabled,
       p.preferred_locale
     FROM principal_credential c
     JOIN principal p ON p.principal_id = c.principal_id
     WHERE LOWER(c.email) = $1
     LIMIT 1`,
    [email]
  );

  const user = userRes.rows[0];
  if (!user || !user.enabled || !verifyPassword(parsed.data.password, user.password_salt, user.password_hash)) {
    return apiError(401, "NOT_AUTHORIZED", "Invalid account credentials or account disabled.");
  }

  const allowSynthetic = process.env.ALLOW_LOCAL_SYNTHETIC_FIXTURES === "true";
  if (user.is_synthetic && !allowSynthetic) {
    return apiError(403, "NOT_AUTHORIZED", "Synthetic QA accounts are disabled in this environment.");
  }

  const roleRes = await query<{
    role: PrincipalRole;
    school_id: string | null;
    district_id: string | null;
  }>(
    `SELECT role, school_id, district_id
     FROM role_grant
     WHERE principal_id = $1
       AND revoked_at IS NULL
       AND ($2::text IS NULL OR role::text = $2)
     ORDER BY grant_id ASC
     LIMIT 1`,
    [user.principal_id, parsed.data.requestedRole ?? null]
  );

  const grant = roleRes.rows[0];
  if (!grant) {
    return apiError(403, "NOT_AUTHORIZED", "Account has no active authorized role grant.");
  }

  if (grant.role === "student") {
    const learnerRes = await query<{ active: boolean }>(
      `SELECT active FROM school_learner
       WHERE principal_id = $1 AND school_id = $2
       LIMIT 1`,
      [user.principal_id, grant.school_id]
    );
    if (!learnerRes.rows[0]?.active) {
      return apiError(
        403,
        "NOT_AUTHORIZED",
        "Student enrollment is currently disabled by your school administrator."
      );
    }
  }

  clearAuthRateLimit(rateKey);
  const session = await createAuthSession(
    user.principal_id,
    grant.role,
    grant.school_id,
    grant.district_id
  );

  await recordAuditEvent({
    schoolId: grant.school_id,
    actionType: "auth.sign_in",
    actorId: user.principal_id,
    subjectKey: `${user.principal_id}:${grant.role}`,
    retentionClass: "operational_short",
  });

  const redirectTo =
    grant.role === "student"
      ? "/student"
      : grant.role === "teacher"
        ? "/teacher"
        : grant.role === "content_editor" || grant.role === "content_reviewer"
          ? "/content"
          : grant.role === "creator" ? "/creator" : "/admin";

  const response = NextResponse.json(
    {
      authenticated: true,
      role: grant.role,
      displayName: user.display_name,
      preferredLocale: user.preferred_locale,
      redirectTo,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

  attachSessionCookies(
    response,
    session.rawToken,
    session.csrfToken,
    user.preferred_locale,
    session.expiresAt
  );
  return response;
}
