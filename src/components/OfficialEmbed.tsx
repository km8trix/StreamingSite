/**
 * OfficialEmbed — an official YouTube IFrame for a title that streams LEGALLY on
 * YouTube (e.g. Muse Asia / Ani-One channels surfaced by AniList). `src` must be
 * a pre-validated youtube-nocookie /embed/ URL (see toYouTubeEmbedSrc); this
 * component does no parsing and never fabricates a player for owned content.
 *
 * Reserved 16:9 box (no layout shift), mirroring the AdSlot reserved-height
 * discipline. Server-safe (a plain iframe, no client state).
 */
export function OfficialEmbed({ src, title }: { src: string; title: string }) {
  return (
    <div
      data-testid="official-embed"
      className="relative aspect-video w-full overflow-hidden rounded-card border border-border bg-surface"
    >
      <iframe
        src={src}
        title={`Watch ${title} on YouTube`}
        className="absolute inset-0 h-full w-full"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
      />
    </div>
  )
}
