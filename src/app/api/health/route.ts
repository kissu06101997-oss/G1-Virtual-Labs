import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const dbCheck = await query<{ now: Date; experiments: string }>(
      `SELECT now() AS now, (SELECT count(*)::text FROM experiment_version) AS experiments`
    );
    return NextResponse.json({
      status: "ok",
      database: "connected",
      serverTime: dbCheck.rows[0]?.now.toISOString() ?? new Date().toISOString(),
      experimentVersions: Number(dbCheck.rows[0]?.experiments ?? 0),
      engineAbi: "lab@1",
      optionalTutorEnabled: process.env.ENABLE_OPTIONAL_TUTOR === "true",
      localSyntheticMode: process.env.ALLOW_LOCAL_SYNTHETIC_FIXTURES === "true",
    });
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "unreachable" },
      { status: 503 }
    );
  }
}
