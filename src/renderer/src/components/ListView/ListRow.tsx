import { format, parseISO, isPast, isToday, isTomorrow } from 'date-fns'
import type { Task, TaskStatus, TaskPriority, LabelNode } from '../../../../shared/types'
import { useTaskStore } from '../../stores/taskStore'

const STATUS_COLOURS: Record<TaskStatus, string> = {
  backlog:     '#6b7280',
  todo:        '#4a9eca',
  in_progress: '#d4a843',
  done:        '#4caf82',
}

const PRIORITY_COLOURS: Record<TaskPriority, string> = {
  high:   '#FC2847',
  medium: '#FFC400',
  low:    '#30D158',
}

function dueDateLabel(iso: string): { text: string; urgent: boolean } {
  const d = parseISO(iso)
  if (isToday(d))    return { text: 'Today',    urgent: true }
  if (isTomorrow(d)) return { text: 'Tomorrow', urgent: false }
  if (isPast(d))     return { text: format(d, 'MMM d'), urgent: true }
  return { text: format(d, 'MMM d'), urgent: false }
}

function stripMarkdown(text: string): string {
  return text
    .split('\n')[0]
    .replace(/^#+\s+/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^[-*]\s+/, '')
    .trim()
}

interface Props {
  task: Task
  flatLabels: LabelNode[]
  onOpen: (task: Task) => void
  isLast: boolean
}

export default function ListRow({ task, flatLabels, onOpen, isLast }: Props) {
  const { deleteTask, updateTask } = useTaskStore()
  const isDone = task.status === 'done'
  const statusColour = STATUS_COLOURS[task.status]
  const due = task.due_date ? dueDateLabel(task.due_date) : null
  const labelMeta = task.labels
    .map(id => flatLabels.find(l => l.id === id))
    .filter((l): l is LabelNode => !!l)

  const toggleDone = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateTask({ id: task.id, status: isDone ? 'todo' : 'done' })
  }

  return (
    <div className="group">
      <div
        className="flex items-start gap-3 py-3 px-3 -mx-3 cursor-pointer rounded-lg hover:bg-[#242424] transition-colors"
        onClick={() => onOpen(task)}
      >
        {/* Status circle — click to mark done */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={toggleDone}
          className="flex-shrink-0 mt-0.5 group/circle"
          title={isDone ? 'Mark as todo' : 'Mark as done'}
        >
          <div
            className="w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center transition-all group-hover/circle:border-[#4caf82] group-hover/circle:bg-[#4caf82]/20"
            style={{
              borderColor: isDone ? STATUS_COLOURS.done : statusColour,
              backgroundColor: isDone ? STATUS_COLOURS.done : 'transparent',
            }}
          >
            {/* Checkmark — always visible when done, shown on hover when not */}
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none"
              className={isDone ? 'opacity-100' : 'opacity-0 group-hover/circle:opacity-60'}
            >
              <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke={isDone ? '#1c1c1e' : '#4caf82'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-sans leading-snug mb-1 ${isDone ? 'text-[#555555] line-through' : 'text-[#f0f0f0]'}`}>
            {task.title}
          </p>

          {task.notes && (
            <p className="text-[11px] text-[#666666] leading-relaxed mb-1.5 truncate">
              {stripMarkdown(task.notes)}
            </p>
          )}

          {(due || labelMeta.length > 0 || task.linked_email_id) && (
            <div className="flex items-center gap-3 flex-wrap">
              {due && (
                <span className={`font-mono text-[10px] flex items-center gap-1 ${due.urgent ? 'text-[#FC2847]' : 'text-[#6b7280]'}`}>
                  {/* calendar icon */}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="flex-shrink-0">
                    <rect x="0.5" y="1.5" width="9" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1"/>
                    <path d="M0.5 4h9" stroke="currentColor" strokeWidth="1"/>
                    <rect x="2.5" y="0.5" width="1" height="2" rx="0.5"/>
                    <rect x="6.5" y="0.5" width="1" height="2" rx="0.5"/>
                  </svg>
                  {due.text}
                </span>
              )}
              {labelMeta.slice(0, 3).map(l => (
                <span key={l.id} className="font-mono text-[10px] flex items-center gap-1 min-w-0">
                  {/* tag icon */}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="flex-shrink-0" style={{ color: l.colour }}>
                    <path d="M1 1h4l4 4-4 4-4-4V1z" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                    <circle cx="3" cy="3" r="0.8"/>
                  </svg>
                  <span className="truncate max-w-[110px]" style={{ color: l.colour }}>{l.id}</span>
                </span>
              ))}
              {task.linked_email_id && (
                <span className="font-mono text-[10px] text-[#4a9eca]">✉ linked</span>
              )}
            </div>
          )}
        </div>

        {/* Priority dot */}
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
          style={{ backgroundColor: PRIORITY_COLOURS[task.priority] }}
        />

        {/* Delete */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); deleteTask(task.id) }}
          className="flex-shrink-0 font-mono text-[14px] text-[#333333] hover:text-[#FC2847] transition-colors opacity-0 group-hover:opacity-100 leading-none mt-0.5"
        >
          ×
        </button>
      </div>

      {!isLast && <div className="h-px bg-[#272727] mx-0" />}
    </div>
  )
}
