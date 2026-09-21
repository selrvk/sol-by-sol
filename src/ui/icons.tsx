// The crew avatar and mission patch. Presentation only.

import { useState } from 'react'
import { CREW_PORTRAITS } from './labels.ts'

// Fallback suit accents, used only when a crew member has no portrait art.
const SUIT = ['#2f72d9', '#31ac90', '#f8a24b', '#6665e3']

interface AvatarProps {
  index: number
  initial: string
  size?: number
  crewId?: string
  onEva?: boolean
}

// A crew portrait. Both the indoor and the helmeted version are drawn, one
// over the other, and cross-faded: assigning someone outside visibly puts
// their helmet on. Drawing both also means neither has to load mid-swap.
// Falls back to a drawn helmet if the art is missing.
export function CrewAvatar({ index, initial, size = 44, crewId, onEva = false }: AvatarProps) {
  const art = crewId ? CREW_PORTRAITS[crewId] : undefined
  const accent = art?.accent ?? SUIT[index % SUIT.length]
  const [failed, setFailed] = useState(false)
  if (art && !failed) {
    return (
      <span
        className="relative shrink-0 overflow-hidden rounded-full"
        style={{ width: size, height: size, boxShadow: `0 0 0 2px ${accent}` }}
      >
        {/* alt="" on both: the card already says in words who is outside. */}
        <img src={art.inside} alt="" width={size} height={size} onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
        <img
          src={art.eva}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="portrait-fade absolute inset-0 h-full w-full object-cover"
          style={{ opacity: onEva ? 1 : 0 }}
        />
      </span>
    )
  }
  const id = `visor-${index}`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e3a8a" />
          <stop offset="0.55" stopColor="#0f172a" />
          <stop offset="1" stopColor={accent} />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="#1e293b" stroke={accent} strokeWidth="2" />
      {/* shoulders */}
      <path d="M8 44c2-8 8-11 16-11s14 3 16 11" fill="#e2e8f0" />
      <rect x="20" y="36" width="8" height="4" rx="1" fill={accent} />
      {/* helmet and visor */}
      <circle cx="24" cy="21" r="12" fill="#f1f5f9" />
      <ellipse cx="24" cy="22" rx="8.5" ry="7" fill={`url(#${id})`} />
      <path d="M18.5 18.5c1.5-1.8 3.6-2.6 6-2.4" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <text x="24" y="26" textAnchor="middle" fontSize="8" fontWeight="700" fill="#e2e8f0">
        {initial}
      </text>
    </svg>
  )
}

// The game's own mission patch (not an agency logo).
export function MissionPatch({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <circle cx="24" cy="24" r="22" fill="#0b1b3a" stroke="#38bdf8" strokeWidth="2.5" />
      <circle cx="31" cy="17" r="6" fill="#cbd5e1" />
      <circle cx="29.5" cy="15.5" r="1.3" fill="#94a3b8" />
      <circle cx="33" cy="19" r="1" fill="#94a3b8" />
      <path d="M8 34c6-4 12-5 18-3s10 2 14-1" stroke="#f97316" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M15 30l6-14 3 7 4-3-6 13z" fill="#fde047" />
      <circle cx="12" cy="14" r="1" fill="#fff" />
      <circle cx="17" cy="9" r="0.8" fill="#fff" />
      <circle cx="38" cy="30" r="0.8" fill="#fff" />
    </svg>
  )
}
