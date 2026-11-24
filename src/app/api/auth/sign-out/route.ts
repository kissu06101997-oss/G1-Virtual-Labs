import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  clearSessionCookies,
  getCurrentSession,
  recordAuditEvent,
  revokeCurrentSession,
  verifyCsrf,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await getCurrentSession();
  if (auth && !verifyCsrf(req, auth)) {
    return apiError(400, "NOT_AUTHORIZED", "Invalid CSRF token.");
  }

  if (auth) {
    await revokeCurrentSession();
    await recordAuditEvent({
      schoolId: auth.schoolId,
      actionType: "auth.sign_out",
      actorId: auth.principalId,
      subjectKey: auth.principalId,
    });
  }

  const response = NextResponse.json({ signedOut: true });
  clearSessionCookies(response);
  return response;
}
