import { describe, expect, it } from "vitest";
import { resolveDatabaseConfig } from "@/lib/db";

describe("resolveDatabaseConfig", () => {
  it("refuses localhost fallback in production when no DB env var is set", () => {
    expect(() =>
      resolveDatabaseConfig({ NODE_ENV: "production" } as NodeJS.ProcessEnv)
    ).toThrow(/Database configuration missing/i);
  });

  it("refuses localhost fallback on Vercel when no DB env var is set", () => {
    expect(() =>
      resolveDatabaseConfig({ NODE_ENV: "development", VERCEL: "1" } as NodeJS.ProcessEnv)
    ).toThrow(/Database configuration missing/i);
  });

  it("rejects localhost DATABASE_URL when running on Vercel", () => {
    expect(() =>
      resolveDatabaseConfig({
        NODE_ENV: "production",
        VERCEL: "1",
        DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:54329/g1_virtua_labs",
      } as NodeJS.ProcessEnv)
    ).toThrow(/points to localhost/i);
  });

  it("supports POSTGRES_URL and enables SSL + serverless pool limits on Vercel", () => {
    const cfg = resolveDatabaseConfig({
      NODE_ENV: "production",
      VERCEL: "1",
      POSTGRES_URL: "postgresql://neondb_owner:secret@ep-demo-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    } as NodeJS.ProcessEnv);

    expect(cfg.isLocalHost).toBe(false);
    expect(cfg.isLocalPglite).toBe(false);
    expect(cfg.useSsl).toBe(true);
    expect(new URL(cfg.connectionString).searchParams.get("sslmode")).toBe("verify-full");
    expect(cfg.max).toBe(5);
    expect(cfg.allowExitOnIdle).toBe(true);
  });

  it("allows local PGlite fallback in non-Vercel local development", () => {
    const cfg = resolveDatabaseConfig({
      NODE_ENV: "development",
    } as NodeJS.ProcessEnv);

    expect(cfg.isLocalHost).toBe(true);
    expect(cfg.isLocalPglite).toBe(true);
    expect(cfg.useSsl).toBe(false);
    expect(cfg.max).toBe(1);
    expect(cfg.allowExitOnIdle).toBe(false);
  });
});
