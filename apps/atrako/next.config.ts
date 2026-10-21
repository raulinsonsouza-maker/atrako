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
