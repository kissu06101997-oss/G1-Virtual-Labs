import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { hmacToken, newUuid, randomToken, sha256Hex } from "./crypto";
import { query } from "./db";
import type { AuthContext, Locale, PrincipalRole, ReasonCode } from "./types";

export const SESSION_COOKIE_NAME = "g1_session";
export const CSRF_COOKIE_NAME = "g1_csrf";
export const LOCALE_COOKIE_NAME = "g1_locale";

// In-memory sliding-window auth rate limiter (20 attempts / 15 min per key)
// Note: documented for single local node; multi-instance production requires shared Redis/DB store.
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_MAX = 20;
const authAttempts = new Map<string, number[]>();

export function checkAuthRateLimit(key: string): boolean {
  const now = Date.now();
  const prev = (authAttempts.get(key) ?? []).filter((t) => now - t < AUTH_RATE_WINDOW_MS);
  if (prev.length >= AUTH_RATE_MAX) {
    authAttempts.set(key, prev);
    return false;
  }
  prev.push(now);
  authAttempts.set(key, prev);
  return true;
}

export function clearAuthRateLimit(key: string): void {
  authAttempts.delete(key);
}

export function apiError(
  status: number,
  reasonCode: ReasonCode,
  detail: string,
  currentRevision: number | null = null
): NextResponse {
  return NextResponse.json(
    {
      reasonCode,
      currentRevision,
      requestId: newUuid(),
      detail,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return raw === "te-IN" ? "te-IN" : "en-IN";
}

export async function getCurrentSession(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken || rawToken.length < 16) return null;

  const allowSynthetic = process.env.ALLOW_LOCAL_SYNTHETIC_FIXTURES === "true";
  const tokenHash = hmacToken(rawToken);
  const res = await query<{
    principal_id: string;
    email: string;
    display_name: string;
    is_synthetic: boolean;
    preferred_locale: Locale;
    active_role: PrincipalRole;
    active_school_id: string | null;
    school_name: string | null;
    active_district_id: string | null;
    district_name: string | null;
    csrf_token: string;
    learner_id: string | null;
  }>(
    `SELECT
       s.principal_id,
       c.email,
       c.display_name,
       c.is_synthetic,
       p.preferred_locale,
       s.active_role,
       s.active_school_id,
       sc.name AS school_name,
       s.active_district_id,
       d.name AS district_name,
       s.csrf_token,
       sl.learner_id
     FROM auth_session s
     JOIN principal p ON p.principal_id = s.principal_id
     JOIN principal_credential c ON c.principal_id = s.principal_id
     LEFT JOIN school sc ON sc.school_id = s.active_school_id
     LEFT JOIN district d ON d.district_id = COALESCE(s.active_district_id, sc.district_id)
     LEFT JOIN school_learner sl
       ON sl.principal_id = s.principal_id
      AND sl.school_id = s.active_school_id
      AND sl.active = true
     WHERE s.session_token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
       AND p.enabled = true
       AND EXISTS (
         SELECT 1 FROM role_grant rg
         WHERE rg.principal_id = s.principal_id
           AND rg.role = s.active_role
           AND rg.revoked_at IS NULL
           AND COALESCE(rg.school_id, '00000000-0000-0000-0000-000000000000'::uuid) =
               COALESCE(s.active_school_id, '00000000-0000-0000-0000-000000000000'::uuid)
       )
     LIMIT 1`,
    [tokenHash]
  );

  const row = res.rows[0];
  if (!row) return null;

  // W04: Reject synthetic sessions if ALLOW_LOCAL_SYNTHETIC_FIXTURES is not enabled
  if (row.is_synthetic && !allowSynthetic) return null;

  // W04: If active role is student, require an active school_learner record
  if (row.active_role === "student" && !row.learner_id) return null;

  return {
    principalId: row.principal_id,
    email: row.email,
    displayName: row.display_name,
    role: row.active_role,
    schoolId: row.active_school_id,
    schoolName: row.school_name,
    districtId: row.active_district_id,
    districtName: row.district_name,
    learnerId: row.learner_id,
    preferredLocale: row.preferred_locale,
    csrfToken: row.csrf_token,
    isSynthetic: row.is_synthetic,
  };
}

export function verifyCsrf(req: NextRequest, auth: AuthContext): boolean {
  const headerToken = req.headers.get("x-csrf-token");
  if (!headerToken) return false;
  const a = Buffer.from(headerToken, "utf8");
  const b = Buffer.from(auth.csrfToken, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function extractIdempotencyKey(req: NextRequest): string | null {
  const key = req.headers.get("idempotency-key")?.trim();
  if (!key || key.length < 16 || key.length > 128) return null;
  return key;
}

export async function createAuthSession(
  principalId: string,
  role: PrincipalRole,
  schoolId: string | null,
  districtId: string | null
): Promise<{ rawToken: string; csrfToken: string; expiresAt: Date }> {
  const rawToken = randomToken(32);
  const tokenHash = hmacToken(rawToken);
  const csrfToken = randomToken(24);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

  await query(
    `INSERT INTO auth_session
      (session_token_hash, principal_id, active_role, active_school_id, active_district_id, csrf_token, expires_at)
     VALUES ($1, $2, $3::principal_role, $4, $5, $6, $7)`,
    [tokenHash, principalId, role, schoolId, districtId, csrfToken, expiresAt.toISOString()]
  );

  return { rawToken, csrfToken, expiresAt };
}

export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return;
  const tokenHash = hmacToken(rawToken);
  await query(
    `UPDATE auth_session SET revoked_at = now() WHERE session_token_hash = $1`,
    [tokenHash]
  );
}

export function attachSessionCookies(
  response: NextResponse,
  rawToken: string,
  csrfToken: string,
  locale: Locale,
  expiresAt: Date
): void {
  const isSecure =
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true" ||
    (process.env.APP_ORIGIN?.startsWith("https://") ?? false);
  response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    expires: expiresAt,
  });
  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    expires: expiresAt,
  });
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    httpOnly: false,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  const isSecure =
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true" ||
    (process.env.APP_ORIGIN?.startsWith("https://") ?? false);
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(CSRF_COOKIE_NAME, "", {
    httpOnly: false,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 0,
  });
}

export async function recordAuditEvent(
  params: {
    schoolId: string | null;
    actionType: string;
    actorId: string | null;
    subjectKey: string;
    retentionClass?: "attempt_record" | "operational_short";
  },
  client?: PoolClient
): Promise<void> {
  const sql = `INSERT INTO audit_event
    (event_id, school_id, action_type, actor_id, subject_digest, occurred_at, retention_class)
    VALUES ($1, $2, $3, $4, $5, now(), $6)`;
  const values = [
    newUuid(),
    params.schoolId,
    params.actionType,
    params.actorId,
    sha256Hex(params.subjectKey),
    params.retentionClass ?? "operational_short",
  ];
  if (client) {
    await client.query(sql, values);
  } else {
    await query(sql, values);
  }
}
