import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, extractIdempotencyKey, getCurrentSession, recordAuditEvent, verifyCsrf } from "@/lib/auth";
import { hashPassword, newUuid, randomToken } from "@/lib/crypto";
import { withTransaction } from "@/lib/db";
import { creatorProvisioningMode } from "@/lib/creator-provisioning";

const payload = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_.-]{2,47}$/),
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(14).max(128),
}).strict();

export async function POST(req: NextRequest) {
  const auth = await getCurrentSession();
  if (!auth) return apiError(401, "NOT_AUTHORIZED", "Sign in required.");
  const mode = creatorProvisioningMode(auth);
  if (!mode) return apiError(403, "NOT_AUTHORIZED", "Authorized platform administrator required.");
  if (!verifyCsrf(req, auth) || !extractIdempotencyKey(req)) return apiError(400, "NOT_AUTHORIZED", "Missing request authorization headers.");
  const parsed = payload.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(422, "ACTION_UNSUPPORTED", "Use a username, display name and a password of at least 14 characters.");
  const id = newUuid();
  const salt = randomToken();
  const hash = hashPassword(parsed.data.password, salt);
  try {
    await withTransaction(async client => {
      await client.query("INSERT INTO principal(principal_id, broker_subject, preferred_locale) VALUES($1, $2, 'en-IN')", [id, "creator:" + parsed.data.username]);
      await client.query(`INSERT INTO principal_credential(principal_id,email,display_name,password_hash,password_salt,is_synthetic)
        VALUES($1,$2,$3,$4,$5,$6)`, [id, parsed.data.username, parsed.data.displayName, hash, salt, mode === "synthetic"]);
      await client.query("INSERT INTO role_grant(grant_id,principal_id,role) VALUES($1,$2,'creator')", [newUuid(), id]);
      await recordAuditEvent({ schoolId: null, actionType: "creator.provisioned", actorId: auth.principalId, subjectKey: id }, client);
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return apiError(409, "STATE_CONFLICT", "That username is already in use.");
    throw error;
  }
  return NextResponse.json({ created: true }, { status: 201 });
}
