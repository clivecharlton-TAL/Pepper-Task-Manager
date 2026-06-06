import { useEffect, useRef } from 'react'
import { TEAM_MEMBERS } from '../../../../shared/team'

interface Props {
  query: string
  highlight: number
  anchorRect: DOMRect
  onSelect: (name: string) => void
  onClose: () => void
}

export default function MentionPopover({ query, highlight, anchorRect, onSelect, onClose }: Props) {
  const q = query.toLowerCase()
  const filtered = TEAM_MEMBERS.filter(m => m.name.toLowerCase().includes(q))
  const listRef = useRef<HTMLDivElement>(null)

  // Scroll highlighted item into view
  useEffect(() => {
    const item = listRef.current?.children[highlight] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!listRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  if (filtered.length === 0) return null

  const top = anchorRect.bottom + 6
  const left = anchorRect.left

  return (
    <div
      style={{ position: 'fixed', top, left, zIndex: 9999, minWidth: 240, maxWidth: 320 }}
      className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-2xl overflow-hidden"
    >
      <div ref={listRef} className="max-h-52 overflow-y-auto py-1">
        {filtered.map((m, i) => (
          <button
            key={m.name}
            onMouseDown={e => { e.preventDefault(); onSelect(m.name) }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
              i === highlight ? 'bg-[#3d2218]/80' : 'hover:bg-[#333333]'
            }`}
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0"
              style={{ backgroundColor: '#c45d2e22', color: '#c45d2e' }}
            >
              {m.name.charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] text-[#f0f0f0] font-sans leading-none mb-0.5">{m.name}</p>
              <p className="text-[10px] text-[#666666] font-mono truncate">{m.role}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
