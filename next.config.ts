import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allowlisted hosts for next/image. Cover artwork comes from MyAnimeList's
    // CDN (Jikan API): /images/** for posters and /s/** for news thumbnails, so
    // the whole host is allowed. placehold.co is the documented fallback host.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.myanimelist.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
};

export default nextConfig;
