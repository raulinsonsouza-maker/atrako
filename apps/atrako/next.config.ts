import type { NextConfig } from "next";

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
  allowedDevOrigins: ["*.replit.dev", "*.repl.co", "*.riker.replit.dev"],
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
