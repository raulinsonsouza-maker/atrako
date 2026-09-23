/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    const allowEmbed = process.env.ATRAKO_EMBED_OPEN === "true";
    return [
      {
        source: "/:path*",
        headers: [
          // Em modo embed Atrako, permite iframe do shell local.
          ...(allowEmbed
            ? []
            : [{ key: "X-Frame-Options", value: "DENY" }]),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
