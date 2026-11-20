/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      // The live WordPress shop's menu lives at /order-here/.
      { source: "/order", destination: "/order-here", permanent: true },
      // Refer-a-friend links from the November 2026 SK Rewards campaign.
      { source: "/order-here/ref/:token*", destination: "/order-here", permanent: true }
    ];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
      ]
    }];
  }
};
export default nextConfig;
