import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO, isPast, isToday, isTomorrow } from 'date-fns'
import type { Task, TaskPriority, LabelNode } from '../../../../shared/types'
import { useTaskStore } from '../../stores/taskStore'
import MentionText from '../shared/MentionText'

const PRIORITY_COLOURS: Record<TaskPriority, string> = {
  high:   '#FC2847',
  medium: '#FFC400',
  low:    '#30D158'
}

function flattenNodes(nodes: LabelNode[]): LabelNode[] {
  const result: LabelNode[] = []
  const walk = (arr: LabelNode[]) => { for (const n of arr) { result.push(n); walk(n.children) } }
  walk(nodes)
  return result
}

function dueDateLabel(iso: string): { text: string; urgent: boolean } {
  const d = parseISO(iso)
  if (isToday(d))    return { text: 'Today',    urgent: true }
  if (isTomorrow(d)) return { text: 'Tomorrow', urgent: false }
  if (isPast(d))     return { text: format(d, 'MMM d'), urgent: true }
  return { text: format(d, 'MMM d'), urgent: false }
}

interface Props { task: Task; isDragging?: boolean; onOpen?: (task: Task) => void }

export default function TaskCard({ task, isDragging, onOpen }: Props) {
  const { deleteTask, labels } = useTaskStore()
  const { attributes, listeners, setNodeRef, transform, isDragging: sorting } =
    useSortable({ id: task.id })

  const style = { transform: CSS.Transform.toString(transform), opacity: sorting ? 0.35 : 1 }
  const flat = flattenNodes(labels)
  const labelMeta = task.labels.map(id => flat.find(l => l.id === id)).filter((l): l is LabelNode => !!l)
  const due = task.due_date ? dueDateLabel(task.due_date) : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(task)}
      className={`group relative bg-[#2a2a2a] rounded border-l-2 p-3 cursor-pointer select-none transition-all ${
        isDragging ? 'shadow-2xl rotate-1 border-[#c45d2e]' : 'border-[#333333] hover:border-[#c45d2e]/50 hover:bg-[#303030]'
      }`}
    >
      {/* Priority bar — top right */}
      <div
        className="absolute top-2 right-2 w-1 h-4 rounded-full"
        style={{ backgroundColor: PRIORITY_COLOURS[task.priority] }}
      />

      {/* Title */}
      <MentionText text={task.title} className="text-[13px] text-[#f0f0f0] leading-snug pr-4 mb-1.5 block" />

      {/* Notes */}
      {task.notes && (
        <p
          className="text-[11px] text-[#888888] leading-relaxed mb-2 overflow-hidden"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}
        >
          {task.notes}
        </p>
      )}

      {/* Label chips */}
      {labelMeta.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {labelMeta.slice(0, 2).map(l => (
            <span
              key={l.id}
              className="font-mono text-[10px] tracking-wide px-1.5 py-0.5 rounded"
              style={{ backgroundColor: l.colour + '1a', color: l.colour }}
            >
              {l.name}
            </span>
          ))}
          {labelMeta.length > 2 && (
            <span className="font-mono text-[10px] text-[#6b7280]">+{labelMeta.length - 2}</span>
          )}
        </div>
      )}

      {/* Footer row */}
      {(due || task.linked_email_id) && (
        <div className="flex items-center gap-2">
          {due && (
            <span className={`font-mono text-[10px] ${due.urgent ? 'text-[#FC2847]' : 'text-[#6b7280]'}`}>
              {due.text}
            </span>
          )}
          {task.linked_email_id && (
            <span className="font-mono text-[10px] text-[#4a9eca]">✉ linked</span>
          )}
        </div>
      )}

      {/* Delete — only on hover */}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
        className="absolute bottom-2 right-2 font-mono text-[12px] text-[#333333] hover:text-[#FC2847] transition-colors opacity-0 group-hover:opacity-100 leading-none"
      >
        ×
      </button>
    </div>
  )
}
