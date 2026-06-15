import type { ReactNode } from 'react'

/**
 * Auth route-group layout — centers the signin/signup card in the viewport,
 * under the global SiteHeader/SiteFooter from the root layout.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      {children}
    </div>
  )
}
