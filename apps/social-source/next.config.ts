import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: ["*.replit.dev", "*.repl.co", "*.riker.replit.dev"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.fbcdn.net", pathname: "/**" },
      { protocol: "https", hostname: "**.facebook.com", pathname: "/**" },
      { protocol: "https", hostname: "fbcdn.net", pathname: "/**" },
      { protocol: "https", hostname: "facebook.com", pathname: "/**" },
      { protocol: "https", hostname: "**.cdninstagram.com", pathname: "/**" },
      { protocol: "https", hostname: "cdninstagram.com", pathname: "/**" },
      { protocol: "https", hostname: "**.instagram.com", pathname: "/**" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com", pathname: "/**" },
    ],
  },
  async headers() {
    const allowEmbed = process.env.ATRAKO_EMBED_OPEN === "true";
    return [
      {
        source: "/:path*",
        headers: [
          ...(allowEmbed ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
