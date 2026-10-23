import type { ReactNode } from 'react'

export type IconName = 'grid' | 'clock' | 'path' | 'check' | 'spark' | 'arrow' | 'book' | 'sun' | 'play' | 'pause' | 'reset' | 'chevron' | 'trophy' | 'flame' | 'target' | 'leaf' | 'star' | 'back' | 'lock' | 'maximize'

const paths: Record<IconName, ReactNode> = {
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.7"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.7"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.7"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.7"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
  path: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3v-3a3 3 0 0 1 3-3h1"/></>,
  check: <><path d="m5 12.5 4.2 4.2L19.5 6.8"/><circle cx="12" cy="12" r="9"/></>,
  spark: <><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 17a2.5 2.5 0 0 1 2.5-2.5H20M8 7h8"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m17.1-7.1-1.4 1.4M6.3 17.7l-1.4 1.4m14.2 0-1.4-1.4M6.3 6.3 4.9 4.9"/></>,
  play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none"/>,
  pause: <><path d="M8 5h3v14H8zM15 5h3v14h-3z" fill="currentColor" stroke="none"/></>,
  reset: <><path d="M4 11a8 8 0 1 1 2.2 5.5"/><path d="M4 5v6h6"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  trophy: <><path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 7H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4"/></>,
  flame: <path d="M12 22c4.4 0 7-3.1 7-7 0-2.8-1.5-5.2-4.5-7.5.1 2.2-1 3.4-2 3.8C12.8 7.7 11 4.7 8 2 8.5 6.8 5 9.5 5 14.7 5 19 7.8 22 12 22Z"/>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  leaf: <><path d="M20 4c-8 0-14 3.5-14 10a6 6 0 0 0 6 6c6.5 0 8-8 8-16Z"/><path d="M4 21c2-5 6-8 11-11"/></>,
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>,
  back: <><path d="M19 12H5m7 7-7-7 7-7"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  maximize: <><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></>,
}

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
