import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allowlisted hosts for next/image. Cover artwork in the seed comes from
    // MyAnimeList's CDN (Jikan API). placehold.co is the documented fallback
    // host used if Jikan/MAL is ever unreachable — see scripts/build_seed.mjs.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.myanimelist.net",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
};

export default nextConfig;
