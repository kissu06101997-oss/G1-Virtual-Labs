import { NextResponse } from "next/server";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";

export async function GET() {
  const [auth, locale] = await Promise.all([getCurrentSession(), getRequestLocale()]);
  if (!auth) {
    return NextResponse.json({ authenticated: false, locale, user: null });
  }
  return NextResponse.json({
    authenticated: true,
    locale,
    user: {
      principalId: auth.principalId,
      email: auth.email,
      displayName: auth.displayName,
      role: auth.role,
      schoolId: auth.schoolId,
      schoolName: auth.schoolName,
      districtId: auth.districtId,
      districtName: auth.districtName,
      learnerId: auth.learnerId,
      preferredLocale: auth.preferredLocale,
      isSynthetic: auth.isSynthetic,
    },
  });
}
