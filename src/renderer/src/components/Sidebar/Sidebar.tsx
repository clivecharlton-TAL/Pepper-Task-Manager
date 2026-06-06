import { useTaskStore } from '../../stores/taskStore'
import LabelTree from './LabelTree'
import type { TaskStatus, TaskPriority } from '../../../../shared/types'

const STATUS_META: { id: TaskStatus; label: string; colour: string }[] = [
  { id: 'backlog',     label: 'Backlog',     colour: '#6b7280' },
  { id: 'todo',        label: 'Todo',        colour: '#4a9eca' },
  { id: 'in_progress', label: 'In Progress', colour: '#d4a843' },
  { id: 'done',        label: 'Done',        colour: '#4caf82' },
]

const PRIORITY_META: { id: TaskPriority; label: string; colour: string }[] = [
  { id: 'high',   label: 'High',   colour: '#FC2847' },
  { id: 'medium', label: 'Medium', colour: '#FFC400' },
  { id: 'low',    label: 'Low',    colour: '#30D158' },
]

function FilterRow({
  colour, label, count, isActive, onClick
}: { colour: string; label: string; count: number; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 py-1.5 px-3 rounded text-left transition-colors group ${
        isActive ? 'bg-[#2a2a2a]' : 'hover:bg-[#2a2a2a]'
      }`}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colour }} />
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
    allTasks
  } = useTaskStore()

  const clearAll = () => { setActiveLabel(null); setActiveStatus(null); setActivePriority(null) }
  const isAllActive = activeLabel === null && activeStatus === null && activePriority === null

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
            count={allTasks.filter(t => t.priority === p.id).length}
            isActive={activePriority === p.id}
            onClick={() => setActivePriority(activePriority === p.id ? null : p.id)}
          />
        ))}
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
