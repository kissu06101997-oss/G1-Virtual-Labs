import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from "pg";

declare global {
  var __g1PgPool: Pool | undefined;
}

const LOCAL_PGLITE_FALLBACK_URL =
  "postgres://postgres:postgres@127.0.0.1:54329/g1_virtua_labs";

export interface ResolvedDatabaseConfig {
  connectionString: string;
  isLocalHost: boolean;
  isLocalPglite: boolean;
  useSsl: boolean;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  allowExitOnIdle: boolean;
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

export function resolveDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env
): ResolvedDatabaseConfig {
  const isVercel = env.VERCEL === "1" || env.VERCEL === "true";
  const isProduction = env.NODE_ENV === "production" || isVercel;

  const configuredUrl =
    env.DATABASE_URL?.trim() ||
    env.POSTGRES_URL?.trim() ||
    env.POSTGRES_PRISMA_URL?.trim() ||
    env.DATABASE_URL_UNPOOLED?.trim() ||
    env.POSTGRES_URL_NON_POOLING?.trim() ||
    "";

  if (!configuredUrl) {
    if (isProduction) {
      throw new Error(
        "[g1-pg] Database configuration missing: set DATABASE_URL (or POSTGRES_URL) in server environment variables. Refusing to fall back to localhost in production."
      );
    }
  }

  const connectionString = configuredUrl || LOCAL_PGLITE_FALLBACK_URL;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error(
      "[g1-pg] Invalid database connection string format in DATABASE_URL / POSTGRES_URL."
    );
  }

  const isLocalHost = isLocalHostname(parsedUrl.hostname);

  if (isVercel && isLocalHost) {
    throw new Error(
      "[g1-pg] Invalid Vercel database configuration: connection string points to localhost, which is unreachable from Vercel serverless functions."
    );
  }

  const isLocalPglite = isLocalHost && parsedUrl.port === "54329";
  const useSsl = !isLocalHost;
  if (useSsl) parsedUrl.searchParams.set("sslmode", "verify-full");

  const envMax = env.PG_POOL_MAX ? Number(env.PG_POOL_MAX) : NaN;
  const defaultMax = isLocalPglite ? 1 : isVercel ? 5 : 10;
  const max = Number.isInteger(envMax) && envMax > 0 ? envMax : defaultMax;

  return {
    connectionString: useSsl ? parsedUrl.toString() : connectionString,
    isLocalHost,
    isLocalPglite,
    useSsl,
    max,
    idleTimeoutMillis: isLocalPglite ? 250 : isVercel ? 10_000 : 30_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: isVercel,
  };
}

export function getPool(): Pool {
  if (!globalThis.__g1PgPool) {
    const cfg = resolveDatabaseConfig(process.env);
    const poolConfig: PoolConfig = {
      connectionString: cfg.connectionString,
      max: cfg.max,
      idleTimeoutMillis: cfg.idleTimeoutMillis,
      connectionTimeoutMillis: cfg.connectionTimeoutMillis,
      allowExitOnIdle: cfg.allowExitOnIdle,
      ...(cfg.useSsl ? { ssl: { rejectUnauthorized: true } } : {}),
    };

    globalThis.__g1PgPool = new Pool(poolConfig);

    globalThis.__g1PgPool.on("error", (err) => {
      console.error("[g1-pg] Unexpected idle pool error:", err.message);
    });
  }
  return globalThis.__g1PgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors after connection failure
    }
    throw err;
  } finally {
    client.release();
  }
}
