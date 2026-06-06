import { useState, useEffect, useRef, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Task, TaskPriority, TaskStatus, LabelNode } from '../../../../shared/types'
import { useTaskStore } from '../../stores/taskStore'
import LabelTreeView from '../QuickAdd/LabelTreeView'

const STATUS_OPTS: { id: TaskStatus; label: string; colour: string }[] = [
  { id: 'backlog',     label: 'Backlog',     colour: '#6b7280' },
  { id: 'todo',        label: 'Todo',        colour: '#4a9eca' },
  { id: 'in_progress', label: 'In Progress', colour: '#d4a843' },
  { id: 'done',        label: 'Done',        colour: '#4caf82' },
]

const PRIORITY_OPTS: { id: TaskPriority; label: string; colour: string }[] = [
  { id: 'high',   label: 'High',   colour: '#FC2847' },
  { id: 'medium', label: 'Medium', colour: '#FFC400' },
  { id: 'low',    label: 'Low',    colour: '#30D158' },
]

function flattenNodes(nodes: LabelNode[]): LabelNode[] {
  const result: LabelNode[] = []
  const walk = (arr: LabelNode[]) => { for (const n of arr) { result.push(n); walk(n.children) } }
  walk(nodes)
  return result
}

interface Props {
  task: Task
  onClose: () => void
}

export default function TaskDetailModal({ task, onClose }: Props) {
  const { labels, updateTask } = useTaskStore()
  const flat = useMemo(() => flattenNodes(labels), [labels])

  const [title,          setTitle]          = useState(task.title)
  const [notes,          setNotes]          = useState(task.notes ?? '')
  const [status,         setStatus]         = useState<TaskStatus>(task.status)
  const [priority,       setPriority]       = useState<TaskPriority>(task.priority)
  const [dueDate,        setDueDate]        = useState(task.due_date ? task.due_date.slice(0, 10) : '')
  const [selectedLabels, setSelectedLabels] = useState<string[]>(task.labels)
  const [notesMode,      setNotesMode]      = useState<'edit' | 'preview'>('preview')
  const [showLabels,     setShowLabels]     = useState(false)
  const labelPickerRef = useRef<HTMLDivElement>(null)

  const isDirty =
    title.trim() !== task.title ||
    notes.trim() !== (task.notes ?? '') ||
    status    !== task.status ||
    priority  !== task.priority ||
    dueDate   !== (task.due_date ? task.due_date.slice(0, 10) : '') ||
    JSON.stringify([...selectedLabels].sort()) !== JSON.stringify([...task.labels].sort())

  const saveRef = useRef<() => void>(() => {})
  saveRef.current = () => {
    if (!isDirty) return
    updateTask({
      id: task.id,
      title: title.trim() || task.title,
      notes: notes.trim() || undefined,
      status,
      priority,
      due_date: dueDate || undefined,
      labels: selectedLabels,
    })
  }

  const handleClose = () => { saveRef.current(); onClose() }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!showLabels) return
    const handler = (e: MouseEvent) => {
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) {
        setShowLabels(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showLabels])

  const labelMeta = selectedLabels.map(id => flat.find(l => l.id === id)).filter((l): l is LabelNode => !!l)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onMouseDown={handleClose}
    >
      <div
        className="relative bg-[#242424] border border-[#383838] rounded-xl shadow-2xl flex flex-col"
        style={{ width: 600, maxHeight: '82vh' }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Title */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 flex-shrink-0 border-b border-[#2e2e2e]">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder="Task title"
            className="flex-1 bg-transparent text-[16px] font-sans font-medium text-[#f0f0f0] focus:outline-none placeholder-[#444444]"
          />
          <button
            onClick={handleClose}
            className="flex-shrink-0 text-[#555555] hover:text-[#f0f0f0] transition-colors text-[18px] leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Description</span>
              <div className="flex gap-1">
                {(['edit', 'preview'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setNotesMode(m)}
                    className={`font-mono text-[10px] px-2 py-0.5 rounded transition-colors capitalize ${
                      notesMode === m ? 'bg-[#333333] text-[#f0f0f0]' : 'text-[#555555] hover:text-[#a0a0a0]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {notesMode === 'edit' ? (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                placeholder="Add a description… (markdown supported)"
                rows={6}
                className="w-full bg-[#1e1e1e] border border-[#333333] rounded-lg px-3 py-2.5 text-[13px] font-sans text-[#d4d4d4] placeholder-[#444444] resize-none focus:outline-none focus:border-[#c45d2e]/50 leading-relaxed"
              />
            ) : (
              <div className="bg-[#1e1e1e] border border-[#333333] rounded-lg px-3 py-2.5 min-h-[120px]">
                {notes ? (
                  <div className="text-[13px] font-sans text-[#b0b0b0] leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({children}) => <h1 className="text-[16px] font-semibold text-[#e0e0e0] mb-2 mt-4 first:mt-0">{children}</h1>,
                        h2: ({children}) => <h2 className="text-[14px] font-semibold text-[#d4d4d4] mb-2 mt-3 first:mt-0">{children}</h2>,
                        h3: ({children}) => <h3 className="text-[13px] font-semibold text-[#c8c8c8] mb-1.5 mt-3 first:mt-0">{children}</h3>,
                        p:  ({children}) => <p className="mb-2 last:mb-0 text-[#b0b0b0]">{children}</p>,
                        strong: ({children}) => <strong className="font-semibold text-[#d4d4d4]">{children}</strong>,
                        em:     ({children}) => <em className="italic text-[#a0a0a0]">{children}</em>,
                        ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-0.5 text-[#b0b0b0]">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-0.5 text-[#b0b0b0]">{children}</ol>,
                        li: ({children}) => <li className="text-[#b0b0b0]">{children}</li>,
                        blockquote: ({children}) => (
                          <blockquote className="border-l-2 border-[#c45d2e] pl-3 my-2 text-[#888888] italic">{children}</blockquote>
                        ),
                        code: ({children, className}) => {
                          const isBlock = className?.includes('language-')
                          return isBlock
                            ? <code className="block bg-[#1c1c1c] border border-[#333333] rounded px-3 py-2 my-2 font-mono text-[12px] text-[#c45d2e] overflow-x-auto whitespace-pre">{children}</code>
                            : <code className="bg-[#1c1c1c] border border-[#333333] rounded px-1.5 py-0.5 font-mono text-[11px] text-[#c45d2e]">{children}</code>
                        },
                        hr: () => <hr className="border-[#303030] my-3" />,
                        a:  ({href, children}) => <a href={href} className="text-[#4a9eca] hover:underline" onClick={e => e.preventDefault()}>{children}</a>,
                        input: ({checked}) => (
                          <input type="checkbox" checked={checked} readOnly className="mr-1.5 accent-[#c45d2e] cursor-default" />
                        ),
                      }}
                    >
                      {notes}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[12px] text-[#444444] italic">No description</p>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-[#2e2e2e]" />

          {/* Metadata */}
          <div className="space-y-4">

            {/* Labels */}
            <div className="flex items-start gap-4">
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-20 pt-1 flex-shrink-0">Labels</span>
              <div className="flex-1 relative">
                <div className="flex flex-wrap gap-1.5 items-center">
                  {labelMeta.map(l => (
                    <span
                      key={l.id}
                      className="font-mono text-[10px] tracking-wide px-2 py-0.5 rounded flex items-center gap-1"
                      style={{ backgroundColor: l.colour + '22', color: l.colour }}
                    >
                      {l.name}
                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => setSelectedLabels(prev => prev.filter(id => id !== l.id))}
                        className="opacity-50 hover:opacity-100 transition-opacity leading-none ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => setShowLabels(v => !v)}
                    className="font-mono text-[10px] px-2 py-0.5 rounded border border-dashed border-[#3a3a3a] text-[#555555] hover:border-[#c45d2e]/40 hover:text-[#c45d2e] transition-colors"
                  >
                    + label
                  </button>
                </div>

                {showLabels && (
                  <div
                    ref={labelPickerRef}
                    className="absolute top-full left-0 mt-2 z-10 bg-[#1e1e1e] border border-[#383838] rounded-xl shadow-2xl overflow-hidden"
                    style={{ width: 300, height: 280 }}
                    onMouseDown={e => e.stopPropagation()}
                  >
                    <LabelTreeView
                      labels={labels}
                      selected={selectedLabels}
                      onChange={setSelectedLabels}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-20 flex-shrink-0">Status</span>
              <div className="flex gap-1.5">
                {STATUS_OPTS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setStatus(opt.id)}
                    className="font-mono text-[10px] px-2.5 py-1 rounded transition-all"
                    style={
                      status === opt.id
                        ? { backgroundColor: opt.colour + '28', color: opt.colour, border: `1px solid ${opt.colour}55` }
                        : { backgroundColor: '#1e1e1e', color: '#555555', border: '1px solid #333333' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-20 flex-shrink-0">Priority</span>
              <div className="flex gap-1.5">
                {PRIORITY_OPTS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPriority(opt.id)}
                    className="font-mono text-[10px] px-2.5 py-1 rounded transition-all flex items-center gap-1.5"
                    style={
                      priority === opt.id
                        ? { backgroundColor: opt.colour + '22', color: opt.colour, border: `1px solid ${opt.colour}55` }
                        : { backgroundColor: '#1e1e1e', color: '#555555', border: '1px solid #333333' }
                    }
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: opt.colour }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-20 flex-shrink-0">Due</span>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="bg-[#1e1e1e] border border-[#333333] rounded px-2.5 py-1 font-mono text-[11px] text-[#d4d4d4] focus:outline-none focus:border-[#c45d2e]/50 [color-scheme:dark]"
              />
              {dueDate && (
                <button
                  onClick={() => setDueDate('')}
                  className="font-mono text-[10px] text-[#555555] hover:text-[#FC2847] transition-colors"
                >
                  clear
                </button>
              )}
            </div>

            {/* Linked email — read-only */}
            {task.linked_email_id && (
              <div className="flex items-center gap-4">
                <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-20 flex-shrink-0">Email</span>
                <span className="font-mono text-[11px] text-[#4a9eca]">
                  ✉ {task.linked_email_subject ?? task.linked_email_id}
                </span>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2e2e2e] flex-shrink-0">
          <p className="font-mono text-[10px] text-[#3a3a3a]">
            Created {format(parseISO(task.created_at), 'MMM d, yyyy · HH:mm')}
          </p>
          <button
            onClick={() => { saveRef.current(); onClose() }}
            className={`font-mono text-[12px] px-4 py-1.5 rounded transition-all ${
              isDirty
                ? 'bg-[#c45d2e] text-[#f0f0f0] hover:bg-[#d4692e]'
                : 'bg-[#2a2a2a] text-[#3a3a3a] cursor-default'
            }`}
          >
            {isDirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>
    </div>
  )
}
