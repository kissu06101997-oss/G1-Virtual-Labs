import { isIP } from "node:net";
import { z } from "zod";
import { CONTACT, CONTACT_LIMITS, INQUIRY_CATEGORIES, VISITOR_TYPES } from "./contact";
import { canonicalJson, hmacToken, newUuid, sha256Hex } from "./crypto";
import { query } from "./db";

const controlCharacters = /[\x00-\x1f\x7f]/;
const messageControls = /[\x00-\x08\x0b-\x1f\x7f]/;
const singleLine = (min: number, max: number) =>
  z.string().max(max).refine(value => !controlCharacters.test(value)).trim().min(min);
const contactInquirySchema = z.strictObject({
  name: singleLine(1, CONTACT_LIMITS.name),
  email: singleLine(1, CONTACT_LIMITS.email).pipe(z.email()).transform(value => value.toLowerCase()),
  phone: singleLine(0, CONTACT_LIMITS.phone).refine(value => !value || /^[+0-9(). -]+$/.test(value)),
  institution: singleLine(0, CONTACT_LIMITS.institution),
  visitor: z.enum(Object.keys(VISITOR_TYPES) as (keyof typeof VISITOR_TYPES)[]),
  category: z.enum(Object.keys(INQUIRY_CATEGORIES) as (keyof typeof INQUIRY_CATEGORIES)[]),
  subject: singleLine(1, CONTACT_LIMITS.subject),
  message: z.string().max(CONTACT_LIMITS.message)
    .transform(value => value.replace(/\r\n?/g, "\n"))
    .refine(value => !messageControls.test(value)).pipe(z.string().trim().min(1)),
  consent: z.literal(true),
  website: z.literal(""),
});

export type ContactInquiry = Omit<z.infer<typeof contactInquirySchema>, "website">;

export const parseContactInquiry = (value: unknown) => contactInquirySchema.safeParse(value);
export const CONTACT_RATE_SECONDS = 900;
const WINDOW_MS = CONTACT_RATE_SECONDS * 1000;
const MAX_BYTES = 24 * 1024;

export async function readContactBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (!request.body || declaredLength > MAX_BYTES) throw new Error("Invalid body size");
  const stream = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await stream.read();
      if (done) return JSON.parse(body + decoder.decode());
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("Invalid body size");
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    await stream.cancel().catch(() => undefined);
    stream.releaseLock();
  }
}

export async function takeContactRateSlot(headers: Headers, email?: string) {
  // Only the hosting platform can supply a trusted IP. Direct servers share a source bucket.
  const forwarded = process.env.VERCEL === "1" ? headers.get("x-vercel-forwarded-for")?.trim() : undefined;
  const ip = forwarded && isIP(forwarded) ? forwarded : null;
  const bucket = email ? `email:${email}` : ip ? `ip:${ip}` : "direct";
  const limit = email ? 5 : ip ? 12 : 80;
  const window = Math.floor(Date.now() / WINDOW_MS);
  const result = await query<{ attempts: number }>(`
    INSERT INTO contact_rate_window (limiter_key, window_start, attempts)
      VALUES ($1, $2, 1)
    ON CONFLICT (limiter_key, window_start) DO UPDATE
      SET attempts = contact_rate_window.attempts + 1
      WHERE contact_rate_window.attempts < $3
    RETURNING attempts
  `, [hmacToken("contact-rate:" + bucket), window, limit]);
  if (!email && result.rows[0]?.attempts === 1) {
    await query("DELETE FROM contact_rate_window WHERE window_start < $1", [window - 96]);
  }
  return Boolean(result.rows.length);
}

export async function recordContactInquiry({ website, ...details }: z.infer<typeof contactInquirySchema>) {
  if (website !== "") throw new Error("Invalid honeypot");
  const inquiryId = newUuid();
  const synthetic = process.env.ALLOW_LOCAL_SYNTHETIC_FIXTURES === "true";
  const key = synthetic ? "" : process.env.CONTACT_RESEND_API_KEY?.trim();
  const sender = process.env.CONTACT_EMAIL_FROM?.trim();
  const notify = Boolean(key && sender && !controlCharacters.test(sender));
  const { rows } = await query<{ inquiry_id: string }>(`
    INSERT INTO contact_inquiry (inquiry_id, fingerprint, details, notification_status)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (fingerprint) DO NOTHING
    RETURNING inquiry_id
  `, [inquiryId, sha256Hex(canonicalJson(details)), JSON.stringify(details), notify ? "pending" : "disabled"]);
  if (!rows.length) return "duplicate";
  if (!notify) return "recorded";

  let status = "failed";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "contact/" + inquiryId,
      },
      body: JSON.stringify({
        from: sender,
        to: [CONTACT.email],
        subject: "New G1 Virtual Labs inquiry",
        text: `A new inquiry was recorded. Sign in to the private Contact inquiries inbox to read it.\n\nReference: ${inquiryId}`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) status = "accepted";
    await response.body?.cancel();
  } catch {
    // The private inbox retains the saved inquiry even if the provider is unavailable.
  }
  await query("UPDATE contact_inquiry SET notification_status = $2 WHERE inquiry_id = $1", [inquiryId, status])
    .catch(() => console.error("[contact] Could not update notification status."));
  return "recorded";
}
