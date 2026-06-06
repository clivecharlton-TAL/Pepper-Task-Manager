import { useRef, useEffect } from 'react'
import { useTaskStore } from '../../stores/taskStore'

export default function TopBar() {
  const { activeLabel, activeStatus, activePriority, searchQuery, setSearchQuery, viewMode, setViewMode } = useTaskStore()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const clear = () => { setSearchQuery(''); inputRef.current?.focus() }
  const isActive = searchQuery.length > 0

  return (
    <div
      className="flex items-center gap-3 px-4 border-b border-[#333333] flex-shrink-0 drag-region"
      style={{ paddingTop: '14px', paddingBottom: '10px' }}
    >
      {(activeLabel || activeStatus || activePriority) ? (
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
          {[
            activeStatus   && activeStatus.replace('_', ' '),
            activePriority && `${activePriority} priority`,
            activeLabel    && activeLabel.split('/').pop(),
          ].filter(Boolean).map((crumb, i, arr) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-[#c45d2e] capitalize">{crumb}</span>
              {i < arr.length - 1 && <span className="font-mono text-[10px] text-[#4a4a4a]">·</span>}
            </span>
          ))}
        </div>
      ) : (
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">All Tasks</span>
      )}

      <div className="flex-1" />

      {/* View toggle */}
      <div
        className="no-drag flex items-center gap-0.5 bg-[#2a2a2a] border border-[#333333] rounded p-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => setViewMode('kanban')}
          title="Kanban view"
          className={`p-1.5 rounded transition-colors ${viewMode === 'kanban' ? 'bg-[#383838] text-[#c45d2e]' : 'text-[#555555] hover:text-[#a0a0a0]'}`}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
            <rect x="0" y="0" width="5.5" height="13" rx="1"/>
            <rect x="7.5" y="0" width="5.5" height="8" rx="1"/>
          </svg>
        </button>
        <button
          onClick={() => setViewMode('list')}
          title="List view"
          className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-[#383838] text-[#c45d2e]' : 'text-[#555555] hover:text-[#a0a0a0]'}`}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
            <rect x="0" y="0" width="13" height="2" rx="1"/>
            <rect x="0" y="5.5" width="13" height="2" rx="1"/>
            <rect x="0" y="11" width="13" height="2" rx="1"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <div
        className={`no-drag flex items-center gap-2 rounded px-3 py-1.5 transition-all border ${
          isActive
            ? 'bg-[#2a2a2a] border-[#c45d2e]/50'
            : 'bg-[#2a2a2a] border-[#333333] hover:border-[#444444]'
        }`}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span className={`text-[13px] transition-colors flex-shrink-0 ${isActive ? 'text-[#c45d2e]' : 'text-[#555555]'}`}>
          ⌕
        </span>
        <input
          ref={inputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') { clear(); e.currentTarget.blur() }
            e.stopPropagation()
          }}
          placeholder="Search tasks…  ⌘F"
          className="bg-transparent font-mono text-[12px] text-[#f0f0f0] placeholder-[#3a3a3a] w-48 focus:outline-none"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        />
        {isActive && (
          <button
            onClick={clear}
            className="text-[#555555] hover:text-[#f0f0f0] transition-colors text-[14px] leading-none flex-shrink-0"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
