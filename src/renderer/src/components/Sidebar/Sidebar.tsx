import { useRef, useState, type ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useTaskStore, type DueFilter } from '../../stores/taskStore'
import LabelTree from './LabelTree'
import type { TaskStatus, TaskPriority, LabelNode } from '../../../../shared/types'
import { matchesDue } from '../../../../shared/dateFilters'

function IconBacklog() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.5 2"/>
    </svg>
  )
}

function IconTodo() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  )
}

function IconInProgress() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2 7 A5 5 0 0 1 12 7 Z" fill="currentColor"/>
    </svg>
  )
}

function IconDone() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" fill="currentColor"/>
      <path d="M4.5 7.2 L6.2 8.9 L9.5 5.2" stroke="#1c1c1e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const STATUS_META: { id: TaskStatus; label: string; colour: string; icon: ReactNode }[] = [
  { id: 'backlog',     label: 'Backlog',     colour: '#6b7280', icon: <IconBacklog /> },
  { id: 'todo',        label: 'Todo',        colour: '#4a9eca', icon: <IconTodo /> },
  { id: 'in_progress', label: 'In Progress', colour: '#d4a843', icon: <IconInProgress /> },
  { id: 'done',        label: 'Done',        colour: '#4caf82', icon: <IconDone /> },
]

function IconFlagFilled() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" strokeLinecap="round">
      <line x1="3" y1="1.5" x2="3" y2="12.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M3 2 L11.5 4.5 L3 7 Z" fill="currentColor"/>
    </svg>
  )
}

function IconFlagOutline() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="1.5" x2="3" y2="12.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M3 2 L11.5 4.5 L3 7 Z" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

function IconDash() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" strokeLinecap="round">
      <line x1="2.5" y1="7" x2="11.5" y2="7" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

const PRIORITY_META: { id: TaskPriority; label: string; colour: string; icon: ReactNode }[] = [
  { id: 'high',   label: 'High',   colour: '#FC2847', icon: <IconFlagFilled /> },
  { id: 'medium', label: 'Medium', colour: '#FFC400', icon: <IconFlagOutline /> },
  { id: 'low',    label: 'Low',    colour: '#30D158', icon: <IconDash /> },
]

function IconClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="5.5"/>
      <path d="M7 3.5V7l2.5 1.5"/>
    </svg>
  )
}

function IconCalendarDay() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="11" height="10" rx="1.5"/>
      <path d="M1.5 6.5h11"/>
      <path d="M4.5 1v3M9.5 1v3"/>
      <rect x="4.5" y="8" width="5" height="2.5" rx="0.5" fill="currentColor" stroke="none" opacity="0.8"/>
    </svg>
  )
}

function IconCalendarWeek() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="11" height="10" rx="1.5"/>
      <path d="M1.5 6.5h11"/>
      <path d="M4.5 1v3M9.5 1v3"/>
      <circle cx="4" cy="9.5" r="0.9" fill="currentColor" stroke="none"/>
      <circle cx="7" cy="9.5" r="0.9" fill="currentColor" stroke="none"/>
      <circle cx="10" cy="9.5" r="0.9" fill="currentColor" stroke="none"/>
    </svg>
  )
}

const DUE_META: { id: DueFilter; label: string; colour: string; icon: ReactNode }[] = [
  { id: 'overdue',   label: 'Overdue',   colour: '#FC2847', icon: <IconClock /> },
  { id: 'today',     label: 'Today',     colour: '#FF9F0A', icon: <IconCalendarDay /> },
  { id: 'this_week', label: 'This Week', colour: '#30D158', icon: <IconCalendarWeek /> },
  { id: 'next_week', label: 'Next Week', colour: '#4a9eca', icon: <IconCalendarWeek /> },
]

function DroppableTag({ label, count, isActive, onActivate }: {
  label: LabelNode; count: number; isActive: boolean; onActivate: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `label:${label.id}` })
  return (
    <div ref={setNodeRef}>
      <button
        onClick={onActivate}
        className="flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded border transition-all"
        style={isActive || isOver
          ? { backgroundColor: label.colour + '33', borderColor: label.colour + '88', color: label.colour }
          : { backgroundColor: 'transparent', borderColor: '#383838', color: '#888888' }
        }
      >
        {label.name}
        {isOver ? (
          <span className="font-mono text-[9px] ml-0.5 text-[#30D158]">+</span>
        ) : count > 0 && (
          <span className="font-mono text-[9px] ml-0.5" style={{ color: isActive ? label.colour : '#555555' }}>
            {count}
          </span>
        )}
      </button>
    </div>
  )
}

function FilterRow({
  colour, label, count, isActive, onClick, icon
}: { colour: string; label: string; count: number; isActive: boolean; onClick: () => void; icon?: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 py-1.5 px-3 rounded text-left transition-colors group ${
        isActive ? 'bg-[#2a2a2a]' : 'hover:bg-[#2a2a2a]'
      }`}
    >
      {icon ? (
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0" style={{ color: colour }}>
          {icon}
        </span>
      ) : (
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colour }} />
      )}
      <span className={`font-mono text-[11px] tracking-wide flex-1 transition-colors ${
        isActive ? 'text-[#f0f0f0] font-medium' : 'text-[#a8a8a8] group-hover:text-[#f0f0f0]'
      }`}>
        {label}
      </span>
      {count > 0 && (
        <span
          className="font-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ backgroundColor: colour + '22', color: colour }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

export default function Sidebar({ width }: { width?: number }) {
  const {
    activeLabel, setActiveLabel,
    activeStatus, setActiveStatus,
    activePriority, setActivePriority,
    activeDue, setActiveDue,
    allTasks, labels
  } = useTaskStore()

  const crossCuttingLabels = labels.filter(l => l.id.startsWith('+'))
  const [addingTag,  setAddingTag]  = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)

  const startAddingTag = () => {
    setNewTagName('')
    setAddingTag(true)
    setTimeout(() => tagInputRef.current?.focus(), 0)
  }

  const cancelAddingTag = () => { setAddingTag(false); setNewTagName('') }

  const confirmAddingTag = async () => {
    const raw = newTagName.trim()
    if (!raw) { cancelAddingTag(); return }
    const name = raw.startsWith('+') ? raw : `+${raw}`
    cancelAddingTag()
    await window.api.labels.create(name, name, null)
    // labels:changed event triggers loadLabels() automatically via store init
  }

  const clearAll = () => {
    setActiveLabel(null)
    setActiveStatus(null)
    setActivePriority(null)
    setActiveDue(null)
  }
  const isAllActive = activeLabel === null && activeStatus === null && activePriority === null && activeDue === null

  return (
    <div
      className="flex-shrink-0 bg-[#242424] border-r border-[#333333] flex flex-col overflow-hidden"
      style={{ width: width ?? 208 }}
    >
      {/* Traffic light spacer */}
      <div className="h-10 flex-shrink-0 drag-region" />

      {/* All Tasks */}
      <div className="px-3 pb-2 flex-shrink-0">
        <button
          onClick={clearAll}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-colors text-[12px] font-mono tracking-wide font-medium ${
            isAllActive
              ? 'bg-[#3d2218]/60 text-[#c45d2e]'
              : 'text-[#d4d4d4] hover:text-[#f0f0f0] hover:bg-[#2a2a2a]'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAllActive ? 'bg-[#c45d2e]' : 'bg-[#555555]'}`} />
          All Tasks
        </button>
      </div>

      <div className="h-px bg-[#2e2e2e] mx-3 mb-2 flex-shrink-0" />

      {/* Due filters */}
      <div className="px-2 pb-2 flex-shrink-0">
        <div className="px-3 py-1.5 mb-1">
          <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Due</span>
        </div>
        {DUE_META.map(d => (
          <FilterRow
            key={d.id}
            colour={d.colour}
            label={d.label}
            count={allTasks.filter(t => matchesDue(t, d.id)).length}
            isActive={activeDue === d.id}
            onClick={() => setActiveDue(activeDue === d.id ? null : d.id)}
            icon={d.icon}
          />
        ))}
      </div>

      <div className="h-px bg-[#2e2e2e] mx-3 mb-2 flex-shrink-0" />

      {/* Status filters */}
      <div className="px-2 pb-2 flex-shrink-0">
        <div className="px-3 py-1.5 mb-1">
          <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Status</span>
        </div>
        {STATUS_META.map(s => (
          <FilterRow
            key={s.id}
            colour={s.colour}
            label={s.label}
            count={allTasks.filter(t => t.status === s.id).length}
            isActive={activeStatus === s.id}
            onClick={() => setActiveStatus(activeStatus === s.id ? null : s.id)}
            icon={s.icon}
          />
        ))}
      </div>

      <div className="h-px bg-[#2e2e2e] mx-3 mb-2 flex-shrink-0" />

      {/* Priority filters */}
      <div className="px-2 pb-2 flex-shrink-0">
        <div className="px-3 py-1.5 mb-1">
          <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Priority</span>
        </div>
        {PRIORITY_META.map(p => (
          <FilterRow
            key={p.id}
            colour={p.colour}
            label={p.label}
            count={allTasks.filter(t => t.status !== 'done' && t.priority === p.id).length}
            isActive={activePriority === p.id}
            onClick={() => setActivePriority(activePriority === p.id ? null : p.id)}
            icon={p.icon}
          />
        ))}
      </div>

      <div className="h-px bg-[#2e2e2e] mx-3 mb-2 flex-shrink-0" />

      {/* Cross-cutting tags */}
      <div className="px-2 pb-2 flex-shrink-0">
        <div className="px-3 py-1.5 mb-1.5 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Tags</span>
          <button
            onClick={startAddingTag}
            title="New tag"
            className="text-[#4a4a4a] hover:text-[#5AC8FA] transition-colors"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
              <rect x="4" y="0" width="2" height="10" rx="1"/>
              <rect x="0" y="4" width="10" height="2" rx="1"/>
            </svg>
          </button>
        </div>
        <div className="px-3 flex flex-wrap gap-1.5">
          {crossCuttingLabels.map(l => {
            const count = allTasks.filter(t => t.status !== 'done' && t.labels.includes(l.id)).length
            const isActive = activeLabel === l.id
            return (
              <DroppableTag
                key={l.id}
                label={l}
                count={count}
                isActive={isActive}
                onActivate={() => setActiveLabel(isActive ? null : l.id)}
              />
            )
          })}

          {addingTag && (
            <input
              ref={tagInputRef}
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); confirmAddingTag() }
                if (e.key === 'Escape') cancelAddingTag()
                e.stopPropagation()
              }}
              onBlur={cancelAddingTag}
              placeholder="+tag"
              className="font-mono text-[10px] px-2 py-0.5 rounded border border-[#5AC8FA]/40 bg-[#5AC8FA]/10 text-[#5AC8FA] placeholder-[#5AC8FA]/30 focus:outline-none w-16"
            />
          )}
        </div>
      </div>

      <div className="h-px bg-[#2e2e2e] mx-3 mb-2 flex-shrink-0" />

      {/* Label tree */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="px-3 py-1.5 mb-1">
          <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Labels</span>
        </div>
        <LabelTree />
      </div>
    </div>
  )
}
