import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subfolder of a repo that has its own lockfile
  turbopack: { root: __dirname },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85],
  },
  async headers() {
    return [
      {
        source: "/media/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
