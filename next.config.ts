import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const localMediaOrigin = process.env.ALLOW_LOCAL_SYNTHETIC_FIXTURES === "true" && process.env.VERCEL !== "1"
  ? " http://127.0.0.1:" + (Number(process.env.G1_MEDIA_PORT || 3002)) : "";
const hostedMediaOrigin = process.env.BLOB_READ_WRITE_TOKEN ? " https://vercel.com/api/blob https://vercel.com/api/blob/" : "";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      isProd
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'" + localMediaOrigin + hostedMediaOrigin,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    // The diagnostic log writer can trigger repeated Turbopack refreshes in this Windows checkout.
    mcpServer: false,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["pg", "@electric-sql/pglite", "@electric-sql/pglite-socket"],
  outputFileTracingIncludes: {
    "/api/creator/media": ["./node_modules/@ffprobe-installer/linux-x64/ffprobe"],
    "/laboratories": ["./project-brief/AI_Virtual_Labs_Labster_REA_Research_2026-11/data/ap_experiment_catalog.csv"],
    "/laboratories/[subject]": ["./project-brief/AI_Virtual_Labs_Labster_REA_Research_2026-11/data/ap_experiment_catalog.csv"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
