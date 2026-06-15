import { Logo } from './Logo'
import { NavLink } from './NavLink'
import { RandomizeButton } from './RandomizeButton'
import { SearchPlaceholder } from './SearchPlaceholder'

/**
 * SiteHeader — sticky site chrome: logo, primary nav, a (non-functional)
 * search field, and the prominent Randomize action. Mostly a Server Component;
 * only NavLink and RandomizeButton are client islands.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav aria-label="Primary" className="ml-2 hidden items-center gap-1 md:flex">
          <NavLink href="/" exact>
            Home
          </NavLink>
          <NavLink href="/shows">Browse</NavLink>
        </nav>

        <SearchPlaceholder className="ml-auto hidden w-full max-w-xs lg:block" />

        <div className="ml-auto flex items-center gap-2 lg:ml-3">
          <RandomizeButton />
        </div>
      </div>

      {/* mobile: search sits below the bar on small screens */}
      <div className="border-t border-border px-4 py-2 lg:hidden">
        <SearchPlaceholder className="w-full" />
      </div>
    </header>
  )
}
