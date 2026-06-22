// consent-store.ts — the cookie-consent choice, persisted in localStorage and
// read via useSyncExternalStore (no setState-in-effect). Mirrors the guest
// stores (e.g. watch/watchlist-guest-store.ts).
//
// Snapshot states: 'accepted' | 'declined' | 'unset' (no choice yet). The server
// snapshot is 'pending' — a value that is neither 'unset' nor 'accepted' — so the
// banner and Analytics render NOTHING during SSR/hydration and only resolve after
// mount (no hydration mismatch, no banner flash for visitors who already chose).
export type Consent = 'accepted' | 'declined'
export type ConsentSnapshot = Consent | 'unset' | 'pending'

const KEY = 'cookie-consent'
const listeners = new Set<() => void>()

/** Client snapshot. Returns a primitive string, so useSyncExternalStore's
 *  value-equality check holds without memoizing. */
export function getConsentSnapshot(): ConsentSnapshot {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'accepted' || v === 'declined' ? v : 'unset'
  } catch {
    return 'unset'
  }
}

/** Server/hydration snapshot — render neither the banner nor Analytics. */
export function getConsentServerSnapshot(): ConsentSnapshot {
  return 'pending'
}

export function subscribeConsent(callback: () => void): () => void {
  listeners.add(callback)
  // Cross-tab: another tab writing the choice updates this one.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) callback()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

export function setConsent(value: Consent): void {
  try {
    window.localStorage.setItem(KEY, value)
  } catch {
    // Storage blocked (private mode): honor the choice for this session only.
  }
  listeners.forEach((l) => l())
}
