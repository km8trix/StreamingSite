import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * cn — merge conditional class names (clsx) and dedupe/resolve conflicting
 * Tailwind utilities (tailwind-merge). The standard className helper used by
 * every component in src/components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
