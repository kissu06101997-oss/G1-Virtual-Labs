export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export function generateIdempotencyKey(prefix = "g1"): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`.slice(0, 64);
}

export async function apiFetch<T = unknown>(
  url: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    idempotencyKey?: string;
    csrfToken?: string;
  }
): Promise<{ ok: boolean; status: number; data: T; networkError?: boolean }> {
  const method = options?.method ?? "GET";
  const headers: Record<string, string> = {};

  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (method !== "GET") {
    const csrf = options?.csrfToken ?? readCookie("g1_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
    headers["Idempotency-Key"] = options?.idempotencyKey ?? generateIdempotencyKey();
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      credentials: "same-origin",
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data, networkError: false };
  } catch {
    return {
      ok: false,
      status: 0,
      networkError: true,
      data: {
        reasonCode: "NETWORK_OFFLINE",
        detail:
          "Network connection unavailable. Your last confirmed server checkpoint revision remains intact.",
      } as unknown as T,
    };
  }
}
