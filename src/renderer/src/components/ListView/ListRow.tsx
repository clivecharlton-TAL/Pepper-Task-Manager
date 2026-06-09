import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { format, parseISO, isPast, isToday, isTomorrow } from 'date-fns'
import type { Task, TaskStatus, TaskPriority, LabelNode } from '../../../../shared/types'
import { useTaskStore } from '../../stores/taskStore'
import { useAttachmentCountStore } from '../../stores/attachmentCountStore'
import MentionText from '../shared/MentionText'

const STATUS_COLOURS: Record<TaskStatus, string> = {
  backlog:     '#6b7280',
  todo:        '#4a9eca',
  in_progress: '#d4a843',
  done:        '#4caf82',
}

function StatusIcon({ status }: { status: TaskStatus }) {
  const colour = STATUS_COLOURS[status]
  if (status === 'backlog') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke={colour} strokeWidth="1.5" strokeDasharray="3 2.5"/>
    </svg>
  )
  if (status === 'todo') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke={colour} strokeWidth="1.5"/>
    </svg>
  )
  if (status === 'in_progress') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke={colour} strokeWidth="1.5"/>
      <path d="M2 9 A7 7 0 0 1 16 9 Z" fill={colour}/>
    </svg>
  )
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="8.5" fill={colour}/>
      <path d="M5.5 9.2 L7.5 11.2 L12.5 6.5" stroke="#1c1c1e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
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
  const { counts, incrementCount } = useAttachmentCountStore()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  const [fileDragging, setFileDragging] = useState(false)
  const isDone = task.status === 'done'
  const due = task.due_date ? dueDateLabel(task.due_date) : null
  const attachCount = counts[task.id] ?? 0
  const labelMeta = task.labels
    .map(id => flatLabels.find(l => l.id === id))
    .filter((l): l is LabelNode => !!l)

  const toggleDone = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateTask({ id: task.id, status: isDone ? 'todo' : 'done' })
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.stopPropagation()
    setFileDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setFileDragging(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.stopPropagation()
    setFileDragging(false)
    for (const file of Array.from(e.dataTransfer.files)) {
      const result = await window.api.attachments.add(task.id, file.path)
      if (!('error' in result)) incrementCount(task.id)
    }
  }

  return (
    <div className={`group ${isDragging ? 'opacity-40' : ''}`}>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`flex items-start gap-3 py-3 px-3 -mx-3 cursor-pointer rounded-lg transition-colors ${
          fileDragging ? 'bg-[#c45d2e]/5 border border-dashed border-[#c45d2e]/50' : 'hover:bg-[#242424]'
        }`}
        onClick={() => !isDragging && onOpen(task)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Status circle — click to mark done; stopPropagation prevents drag from activating */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={toggleDone}
          className="flex-shrink-0 mt-0.5 transition-opacity hover:opacity-70"
          title={isDone ? 'Mark as todo' : 'Mark as done'}
        >
          <StatusIcon status={task.status} />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <MentionText
            text={task.title}
            className={`text-[13px] font-sans leading-snug mb-1 ${isDone ? 'text-[#555555] line-through' : 'text-[#f0f0f0]'}`}
          />

          {task.notes && (
            <p className="text-[11px] text-[#666666] leading-relaxed mb-1.5 truncate">
              {stripMarkdown(task.notes)}
            </p>
          )}

          {(due || labelMeta.length > 0 || task.linked_email_id || attachCount > 0) && (
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
              {attachCount > 0 && (
                <span className="font-mono text-[10px] text-[#6b7280] flex items-center gap-0.5">
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M7.5 4.5L4.5 7.5C3.67 8.33 2.33 8.33 1.5 7.5C0.67 6.67 0.67 5.33 1.5 4.5L5 1C5.55 0.45 6.45 0.45 7 1C7.55 1.55 7.55 2.45 7 3L3.5 6.5C3.22 6.78 2.78 6.78 2.5 6.5C2.22 6.22 2.22 5.78 2.5 5.5L5.5 2.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
                  </svg>
                  {attachCount}
                </span>
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
