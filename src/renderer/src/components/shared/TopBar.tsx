import { useRef, useEffect, useState } from 'react'
import { useTaskStore, type ListSort, type ListGroup } from '../../stores/taskStore'

const SORT_OPTIONS: { value: ListSort; label: string }[] = [
  { value: 'due',      label: 'Due date'  },
  { value: 'priority', label: 'Priority'  },
  { value: 'created',  label: 'Created'   },
  { value: 'title',    label: 'Title'     },
]

const GROUP_OPTIONS: { value: ListGroup; label: string }[] = [
  { value: 'none',     label: 'None'      },
  { value: 'priority', label: 'Priority'  },
  { value: 'status',   label: 'Status'    },
  { value: 'label',    label: 'Label'     },
]

function ListControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        onMouseDown={e => e.stopPropagation()}
        onClick={() => setOpen(o => !o)}
        className="no-drag flex items-center gap-1.5 px-2 py-1 bg-[#2a2a2a] border border-[#333333] rounded font-mono text-[10px] hover:border-[#444444] transition-colors"
      >
        <span className="text-[#444444]">{label}</span>
        <span className="text-[#888888]">{current?.label}</span>
        <svg
          width="6" height="4" viewBox="0 0 6 4" fill="currentColor"
          className={`text-[#555555] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M0 0.5L3 3.5L6 0.5H0Z"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 bg-[#252525] border border-[#383838] rounded shadow-xl z-50"
          style={{ minWidth: '110px' }}
          onMouseDown={e => e.stopPropagation()}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 font-mono text-[10px] flex items-center gap-2 transition-colors ${
                value === opt.value
                  ? 'text-[#c45d2e]'
                  : 'text-[#888888] hover:text-[#c0c0c0] hover:bg-[#2a2a2a]'
              }`}
            >
              <span className="w-2.5">{value === opt.value ? '✓' : ''}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TopBar() {
  const {
    activeLabel, activeStatus, activePriority, activeDue,
    searchQuery, setSearchQuery,
    viewMode, setViewMode,
    listSort, setListSort,
    listGroup, setListGroup,
  } = useTaskStore()
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
      {viewMode === 'reports' ? (
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Reports</span>
      ) : viewMode === 'files' ? (
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Files</span>
      ) : viewMode === 'calendar' ? (
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Calendar</span>
      ) : (activeLabel || activeStatus || activePriority || activeDue) ? (
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
          {[
            activeStatus   && activeStatus.replace('_', ' '),
            activePriority && `${activePriority} priority`,
            activeDue      && activeDue.replace('_', ' '),
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

      {/* List-only: sort + group controls */}
      {viewMode === 'list' && (
        <div className="flex items-center gap-2">
          <ListControl label="Sort" options={SORT_OPTIONS} value={listSort} onChange={setListSort} />
          <ListControl label="Group" options={GROUP_OPTIONS} value={listGroup} onChange={setListGroup} />
        </div>
      )}

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
        <button
          onClick={() => setViewMode('reports')}
          title="Reports"
          className={`p-1.5 rounded transition-colors ${viewMode === 'reports' ? 'bg-[#383838] text-[#c45d2e]' : 'text-[#555555] hover:text-[#a0a0a0]'}`}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
            <rect x="0" y="7" width="3" height="6" rx="0.5"/>
            <rect x="5" y="4" width="3" height="9" rx="0.5"/>
            <rect x="10" y="0" width="3" height="13" rx="0.5"/>
          </svg>
        </button>
        {(() => {
          const filesBrowsable = !!activeLabel && !activeLabel.startsWith('+')
          const filesTitle = viewMode === 'files' ? 'Files'
            : filesBrowsable ? 'Files'
            : activeLabel?.startsWith('+') ? 'Tags have no Drive folder'
            : 'Select a label to browse files'
          return (
        <button
          onClick={() => { if (filesBrowsable) setViewMode('files') }}
          title={filesTitle}
          className={`p-1.5 rounded transition-colors ${
            viewMode === 'files'
              ? 'bg-[#383838] text-[#c45d2e]'
              : filesBrowsable
                ? 'text-[#555555] hover:text-[#a0a0a0]'
                : 'text-[#2a2a2a] cursor-not-allowed'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
            <path d="M0 3C0 2.17.67 1.5 1.5 1.5H5L6.5 3H11.5C12.33 3 13 3.67 13 4.5V10.5C13 11.33 12.33 12 11.5 12H1.5C.67 12 0 11.33 0 10.5V3Z"/>
          </svg>
        </button>
          )
        })()}
        <button
          onClick={() => setViewMode('calendar')}
          title="Calendar"
          className={`p-1.5 rounded transition-colors ${viewMode === 'calendar' ? 'bg-[#383838] text-[#c45d2e]' : 'text-[#555555] hover:text-[#a0a0a0]'}`}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
            <rect x="0" y="2.5" width="13" height="10.5" rx="1.5"/>
            <rect x="3" y="0" width="1.5" height="4" rx="0.75"/>
            <rect x="8.5" y="0" width="1.5" height="4" rx="0.75"/>
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
