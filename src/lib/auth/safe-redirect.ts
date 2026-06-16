// Open-redirect guard for post-auth `next` targets.
//
// After OAuth (and any "return to where I was" flow) we redirect the user to a
// `next` path that originates in a URL query param — i.e. attacker-controllable.
// If we blindly `redirect(next)`, a value like `//evil.com` or `/\evil.com`
// becomes a protocol-relative URL and the browser navigates OFF-SITE, enabling
// phishing. This helper accepts ONLY same-origin relative paths and falls back
// to `/` for anything suspicious.
//
// Rules (applied to the already URL-decoded value, which is what
// URLSearchParams.get() returns):
//   - must be a non-empty string that starts with a single "/"
//   - reject "//…" (protocol-relative) and "/\…" (browsers fold "\" into "/")
//   - reject ANY backslash or ASCII control char (defeats "\t"/"\n"/"\\" tricks)
//   - cap length so a giant value can't be used for abuse
//
// A leading-"/" value such as "/javascript:alert(1)" is safe here: the browser
// treats it as the same-origin path "/javascript:alert(1)", not a JS URL — the
// dangerous `javascript:` scheme cannot start with "/".

const MAX_PATH_LEN = 512

export function safeRedirectPath(
  raw: string | null | undefined,
  fallback = '/',
): string {
  if (typeof raw !== 'string') return fallback

  const value = raw.trim()
  if (value === '' || value.length > MAX_PATH_LEN) return fallback

  // Must be rooted at the site origin as a relative path.
  if (!value.startsWith('/')) return fallback

  // Protocol-relative ("//host") or backslash-folded ("/\host", "/\\host").
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback

  // Any backslash (some browsers normalize "\" -> "/") or control/whitespace
  // char (\x00–\x1f, DEL) is rejected outright.
  if (/[\\\x00-\x1f\x7f]/.test(value)) return fallback

  return value
}
