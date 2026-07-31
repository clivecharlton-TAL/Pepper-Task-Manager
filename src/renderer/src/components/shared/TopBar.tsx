import { useRef, useEffect, useState, useMemo } from 'react'
import { useTaskStore, type ListSort, type ListGroup } from '../../stores/taskStore'
import { useNoteStore } from '../../stores/noteStore'
import type { TaskStatus } from '../../../../shared/types'

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

const STATUS_FILTER_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog',     label: 'Backlog'     },
  { value: 'todo',        label: 'To Do'       },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done'        },
]

function MultiSelectControl<T extends string>({
  label,
  options,
  hiddenValues,
  onToggle,
}: {
  label: string
  options: { value: T; label: string }[]
  hiddenValues: T[]
  onToggle: (v: T) => void
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

  const visibleCount = options.length - hiddenValues.length

  return (
    <div ref={ref} className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        onMouseDown={e => e.stopPropagation()}
        onClick={() => setOpen(o => !o)}
        className="no-drag flex items-center gap-1.5 px-2 py-1 bg-[#2a2a2a] border border-[#333333] rounded font-mono text-[10px] hover:border-[#444444] transition-colors"
      >
        <span className="text-[#444444]">{label}</span>
        <span className="text-[#888888]">
          {visibleCount === options.length ? 'All' : `${visibleCount} selected`}
        </span>
        <svg
          width="6" height="4" viewBox="0 0 6 4" fill="currentColor"
          className={`text-[#555555] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M0 0.5L3 3.5L6 0.5H0Z"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 bg-[#252525] border border-[#383838] rounded shadow-xl z-50 py-1"
          style={{ minWidth: '130px' }}
          onMouseDown={e => e.stopPropagation()}
        >
          {options.map(opt => {
            const isVisible = !hiddenValues.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => onToggle(opt.value)}
                className="w-full text-left px-3 py-1.5 font-mono text-[10px] flex items-center gap-2 transition-colors text-[#888888] hover:text-[#c0c0c0] hover:bg-[#2a2a2a]"
              >
                <div className={`w-3 h-3 rounded-[3px] border flex items-center justify-center transition-colors ${
                  isVisible ? 'bg-[#c45d2e] border-[#c45d2e] text-white' : 'border-[#444444] bg-transparent'
                }`}>
                  {isVisible && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

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

interface TopBarProps {
  isAIChatOpen: boolean
  onToggleAIChat: () => void
}

export default function TopBar({ isAIChatOpen, onToggleAIChat }: TopBarProps) {
  const {
    activeLabel, activeStatus, activePriority, activeDue, assignedToMe,
    searchQuery, setSearchQuery,
    semanticTaskIds, semanticSearching,
    viewMode, setViewMode,
    listSort, setListSort,
    listGroup, setListGroup,
    hiddenStatuses, toggleHiddenStatus,
    hiddenTags, toggleHiddenTag,
    labels,
  } = useTaskStore()
  const { searchQuery: noteSearchQuery, setSearchQuery: setNoteSearchQuery } = useNoteStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const isNotes = viewMode === 'notes'

  const tagOptions = useMemo(
    () => labels.filter(l => l.id.startsWith('+')).map(l => ({ value: l.id, label: l.name })),
    [labels]
  )

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

  const activeSearchQuery = isNotes ? noteSearchQuery : searchQuery
  const setActiveSearchQuery = isNotes ? setNoteSearchQuery : setSearchQuery
  const clear = () => { setActiveSearchQuery(''); inputRef.current?.focus() }
  const isActive = activeSearchQuery.length > 0

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
      ) : viewMode === 'notes' ? (
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Notes</span>
      ) : (activeLabel || activeStatus || activePriority || activeDue || assignedToMe) ? (
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
          {[
            assignedToMe   && 'my tasks',
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

      {/* List/Timeline: sort + group + filter controls */}
      {(viewMode === 'list' || viewMode === 'timeline') && (
        <div className="flex items-center gap-2">
          <ListControl label="Sort" options={SORT_OPTIONS} value={listSort} onChange={setListSort} />
          <ListControl label="Group" options={GROUP_OPTIONS} value={listGroup} onChange={setListGroup} />
          <MultiSelectControl
            label="Filter Status"
            options={STATUS_FILTER_OPTIONS}
            hiddenValues={hiddenStatuses}
            onToggle={toggleHiddenStatus}
          />
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
          onClick={() => setViewMode('timeline')}
          title="Timeline view"
          className={`p-1.5 rounded transition-colors ${viewMode === 'timeline' ? 'bg-[#383838] text-[#c45d2e]' : 'text-[#555555] hover:text-[#a0a0a0]'}`}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
            <rect x="0" y="2" width="6" height="2.5" rx="0.5"/>
            <rect x="4" y="6" width="9" height="2.5" rx="0.5"/>
            <rect x="2" y="10" width="5" height="2.5" rx="0.5"/>
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
        <button
          onClick={() => setViewMode('notes')}
          title="Notes"
          className={`p-1.5 rounded transition-colors ${viewMode === 'notes' ? 'bg-[#383838] text-[#c45d2e]' : 'text-[#555555] hover:text-[#a0a0a0]'}`}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
            <path d="M2 0.5C1.17 0.5 0.5 1.17 0.5 2V11C0.5 11.83 1.17 12.5 2 12.5H11C11.83 12.5 12.5 11.83 12.5 11V4.5L8.5 0.5H2Z" fillOpacity="0"/>
            <path d="M2 0.5H8L12.5 5V11C12.5 11.83 11.83 12.5 11 12.5H2C1.17 12.5 0.5 11.83 0.5 11V2C0.5 1.17 1.17 0.5 2 0.5Z" fillOpacity="0" stroke="currentColor" strokeWidth="1"/>
            <rect x="2.5" y="6" width="6" height="1" rx="0.5"/>
            <rect x="2.5" y="8.5" width="6" height="1" rx="0.5"/>
          </svg>
        </button>
      </div>

      {/* AI Chat toggle */}
      <button
        onClick={onToggleAIChat}
        title="AI Assistant"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className={`no-drag px-2 py-1 rounded border font-mono text-[10px] transition-colors ${
          isAIChatOpen
            ? 'bg-[#383838] border-[#c45d2e]/50 text-[#c45d2e]'
            : 'bg-[#2a2a2a] border-[#333333] text-[#888888] hover:border-[#444444] hover:text-[#b0b0b0]'
        }`}
      >
        AI
      </button>

      {/* Manual Meeting Trigger */}
      <button
        onClick={() => {
          const ev = new CustomEvent('open-briefing-panel')
          window.dispatchEvent(ev)
        }}
        id="manual-meeting-btn"
        title="Upcoming Meeting Briefing"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="no-drag px-2 py-1 rounded border font-mono text-[10px] transition-colors bg-[#2a2a2a] border-[#333333] text-[#888888] hover:border-[#444444] hover:text-[#b0b0b0]"
      >
        Briefing
      </button>

      {/* Tag filter (all task views) */}
      {!isNotes && viewMode !== 'reports' && viewMode !== 'files' && viewMode !== 'calendar' && tagOptions.length > 0 && (
        <MultiSelectControl
          label="Tags"
          options={tagOptions}
          hiddenValues={hiddenTags}
          onToggle={toggleHiddenTag}
        />
      )}

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
          value={activeSearchQuery}
          onChange={e => setActiveSearchQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') { clear(); e.currentTarget.blur() }
            e.stopPropagation()
          }}
          placeholder={isNotes ? 'Search notes…  ⌘F' : 'Search tasks…  ⌘F'}
          className="bg-transparent font-mono text-[12px] text-[#f0f0f0] placeholder-[#3a3a3a] w-48 focus:outline-none"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        />
        {!isNotes && isActive && (semanticSearching || semanticTaskIds.length > 0) && (
          <span
            title={semanticSearching ? 'Finding related items…' : `${semanticTaskIds.length} related by meaning`}
            className={`font-mono text-[9px] px-1 py-0.5 rounded flex-shrink-0 transition-opacity ${
              semanticSearching ? 'opacity-40' : 'opacity-100'
            }`}
            style={{ backgroundColor: '#5AC8FA22', color: '#5AC8FA' }}
          >
            {semanticSearching ? '~' : `~${semanticTaskIds.length}`}
          </span>
        )}
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
