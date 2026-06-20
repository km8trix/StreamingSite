import type { NextConfig } from "next";

// Content-Security-Policy. Tightly scopes where the app may load/connect, which
// matters now that the show page embeds an official YouTube player (iframe) and
// fetches "where to watch" data from AniList. Notes:
//  - script/style keep 'unsafe-inline' because the Next.js App Router emits
//    inline bootstrap/hydration scripts and inline styles without a nonce; a
//    nonce-based strict CSP is a future hardening step. 'unsafe-eval' covers
//    runtime needs in dev and some deps.
//  - frame-src: only the privacy youtube-nocookie host (OfficialEmbed).
//  - connect-src: AniList GraphQL + Supabase (REST + realtime websocket).
//  - img-src: next/image optimizes via same-origin, but allow the source CDNs
//    (MyAnimeList covers, placehold.co fallback) for any direct loads.
//  - frame-ancestors 'none' + X-Frame-Options block clickjacking of our pages.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.myanimelist.net https://placehold.co",
  "font-src 'self' data:",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "connect-src 'self' https://graphql.anilist.co https://*.supabase.co wss://*.supabase.co",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Note: no `upgrade-insecure-requests` — HSTS already enforces https on the
  // real domain, and the directive would rewrite same-origin http subresources
  // on localhost (breaking local/prod-mode e2e). All prod traffic is https.
].join("; ");

// Defense-in-depth response headers, applied to every route.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
