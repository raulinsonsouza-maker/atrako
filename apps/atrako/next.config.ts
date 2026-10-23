import type { NextConfig } from "next";
import { LP_DOMAINS } from "./lib/lp-domains";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@atrako/agent",
    "@atrako/events",
    "@atrako/forms",
    "@atrako/social",
    "@puckeditor/core",
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Build na VPS (RAM limitada); CI local deve validar tipos.
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    "*.replit.dev",
    "*.repl.co",
    "*.riker.replit.dev",
    ...Object.keys(LP_DOMAINS).filter((host) => host.endsWith(".localhost")),
  ],
  async headers() {
    const production = process.env.NODE_ENV === "production";
    const lpHosts = Object.keys(LP_DOMAINS);
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
      ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ];
    return [
      ...lpHosts.map((host) => ({
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        headers: security,
      })),
      {
        source: "/lp/:dir/assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        source: "/lp/:dir/:file(styles\\.css|app\\.js)",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/f/franquia-regicenter-lp",
          missing: [{ type: "query", key: "preview" }],
          destination: "/lp/regicenter-franquia/index.html",
        },
        ...Object.entries(LP_DOMAINS).map(([host, { dir }]) => ({
          source: "/",
          has: [{ type: "host" as const, value: host }],
          destination: `${dir}/index.html`,
        })),
      ],
    };
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.fbcdn.net", pathname: "/**" },
      { protocol: "https", hostname: "**.facebook.com", pathname: "/**" },
      { protocol: "https", hostname: "fbcdn.net", pathname: "/**" },
      { protocol: "https", hostname: "facebook.com", pathname: "/**" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
