import type { StreamingLink } from '@/lib/data'
import { toYouTubeEmbedSrc } from '@/lib/youtube'
import { OfficialEmbed } from './OfficialEmbed'
import { WhereToWatch } from './WhereToWatch'

/**
 * WatchSection — the "how to watch" hub on the show detail page.
 *
 * Senpai is a discovery product: it never hosts or proxies licensed video. So
 * this section leads with the legal watch path —
 *   - if a provider link is officially embeddable (YouTube, e.g. Muse Asia /
 *     Ani-One) AND resolves to a concrete video/playlist → an OfficialEmbed;
 *   - then the WhereToWatch panel of out-links to every licensed provider.
 *
 * The old in-app HLS player (VideoPlayer) is retired here but kept dormant for a
 * future licensed catalog; with no owned playback there is no progress to record
 * (Continue Watching is repurposed into a watchlist in a later slice).
 *
 * Server component (no client state).
 */
export function WatchSection({
  title,
  links,
}: {
  title: string
  links: StreamingLink[]
}) {
  // The first provider we can actually iframe. `embeddable` is a host-level hint
  // from getWhereToWatch; toYouTubeEmbedSrc narrows it to a real /embed/ URL
  // (channel/handle pages can't be framed) and is the source of truth here.
  const embedSrc = links.reduce<string | null>(
    (found, link) =>
      found ?? (link.embeddable ? toYouTubeEmbedSrc(link.url) : null),
    null,
  )

  return (
    <section
      aria-label="Watch"
      data-testid="watch-section"
      className="flex flex-col gap-4"
    >
      {embedSrc && <OfficialEmbed src={embedSrc} title={title} />}
      <WhereToWatch links={links} title={title} />
    </section>
  )
}
