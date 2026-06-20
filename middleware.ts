// Root middleware — keeps the Supabase auth session fresh on every request via
// the @supabase/ssr `updateSession` pattern (see src/lib/supabase/middleware.ts).
//
// The matcher excludes Next internals and static assets so we only refresh the
// session for real page/route requests (cheap + avoids touching image/font/etc).

import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static (build assets)
     *  - _next/image (image optimization)
     *  - favicon.ico, sitemap.xml, robots.txt
     *  - monitoring (the Sentry tunnel route — must not run auth-session logic)
     *  - any file with an extension (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|monitoring|.*\\.[^/]*$).*)',
  ],
}
