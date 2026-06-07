import { useState, useEffect, useRef, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Task, TaskPriority, TaskStatus, LabelNode } from '../../../../shared/types'
import { useTaskStore } from '../../stores/taskStore'
import LabelTreeView from '../QuickAdd/LabelTreeView'
import MentionPopover from '../shared/MentionPopover'
import { TEAM_MEMBERS } from '../../../../shared/team'

// ── FY quarter helpers (FY starts 1 April) ───────────────────────────────────

function currentFY(): number {
  const now = new Date()
  return (now.getMonth() + 1) >= 4 ? now.getFullYear() + 1 : now.getFullYear()
}

function quarterEnd(fy: number, q: 1 | 2 | 3 | 4): string {
  if (q === 1) return `${fy - 1}-06-30`
  if (q === 2) return `${fy - 1}-09-30`
  if (q === 3) return `${fy - 1}-12-31`
  return `${fy}-03-31`
}

function dateToFYQ(date: string): { fy: number; q: 1 | 2 | 3 | 4 } | null {
  if (!date) return null
  const [y, m] = date.split('-').map(Number)
  if (m >= 4 && m <= 6)   return { fy: y + 1, q: 1 }
  if (m >= 7 && m <= 9)   return { fy: y + 1, q: 2 }
  if (m >= 10 && m <= 12) return { fy: y + 1, q: 3 }
  return { fy: y, q: 4 }
}

const FY_RANGE = [0, 1, 2, 3].map(n => currentFY() + n)
const TODAY_FYQ = dateToFYQ(new Date().toISOString().slice(0, 10))

// ─────────────────────────────────────────────────────────────────────────────

type MentionState = { active: boolean; start: number; query: string; highlight: number; rect: DOMRect | null }
const NO_MENTION: MentionState = { active: false, start: -1, query: '', highlight: 0, rect: null }
function filteredMembers(query: string) {
  const q = query.toLowerCase()
  return TEAM_MEMBERS.filter(m => m.name.toLowerCase().includes(q))
}

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
  const [showQuarters,   setShowQuarters]   = useState(false)
  const [aiState,        setAiState]        = useState<'idle' | 'drafting' | 'error'>('idle')
  const [aiError,        setAiError]        = useState('')
  const [showKeyInput,   setShowKeyInput]   = useState(false)
  const [keyInput,       setKeyInput]       = useState('')
  const labelPickerRef   = useRef<HTMLDivElement>(null)
  const quarterPickerRef = useRef<HTMLDivElement>(null)
  const titleInputRef  = useRef<HTMLInputElement>(null)
  const notesRef       = useRef<HTMLTextAreaElement>(null)
  const [titleMention, setTitleMention] = useState<MentionState>(NO_MENTION)
  const [notesMention, setNotesMention] = useState<MentionState>(NO_MENTION)
  const titlePending   = useRef<number | null>(null)
  const notesPending   = useRef<number | null>(null)

  function handleMentionKeyDown(
    e: React.KeyboardEvent,
    mention: MentionState,
    setMention: (m: MentionState) => void,
    pending: React.MutableRefObject<number | null>,
    inputEl: HTMLInputElement | HTMLTextAreaElement | null,
    insertFn: (name: string) => void
  ) {
    if (e.key === '@') {
      const pos = inputEl?.selectionStart ?? 0
      pending.current = pos
    }
    if (mention.active) {
      const members = filteredMembers(mention.query)
      if (e.key === 'ArrowDown') { e.preventDefault(); setMention({ ...mention, highlight: Math.min(mention.highlight + 1, members.length - 1) }) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMention({ ...mention, highlight: Math.max(mention.highlight - 1, 0) }) }
      if (e.key === 'Enter' && members[mention.highlight]) { e.preventDefault(); insertFn(members[mention.highlight].name) }
      if (e.key === 'Escape')    { e.stopPropagation(); setMention(NO_MENTION) }
    }
  }

  function handleMentionChange(
    val: string,
    pos: number,
    mention: MentionState,
    setMention: (m: MentionState) => void,
    pending: React.MutableRefObject<number | null>,
    inputEl: HTMLElement | null
  ) {
    if (pending.current !== null) {
      const start = pending.current
      pending.current = null
      if (val[start] === '@') {
        const rect = inputEl?.getBoundingClientRect() ?? null
        setMention({ active: true, start, query: '', highlight: 0, rect })
      }
      return
    }
    if (mention.active) {
      if (val[mention.start] !== '@' || pos <= mention.start) {
        setMention(NO_MENTION)
      } else {
        setMention({ ...mention, query: val.slice(mention.start + 1, pos), highlight: 0 })
      }
    }
  }

  const insertTitleMention = (name: string) => {
    const before = title.slice(0, titleMention.start)
    const after  = title.slice(titleMention.start + 1 + titleMention.query.length)
    setTitle(`${before}@${name} ${after}`)
    setTitleMention(NO_MENTION)
    titleInputRef.current?.focus()
  }

  const insertNotesMention = (name: string) => {
    const before = notes.slice(0, notesMention.start)
    const after  = notes.slice(notesMention.start + 1 + notesMention.query.length)
    setNotes(`${before}@${name} ${after}`)
    setNotesMention(NO_MENTION)
    notesRef.current?.focus()
  }

  const handleAiDraft = async () => {
    setAiError('')
    const hasKey = await window.api.ai.hasKey()
    if (!hasKey) { setShowKeyInput(true); return }

    setAiState('drafting')
    setNotesMode('edit')
    setNotes('')

    const unsub = window.api.ai.onChunk((chunk) => {
      setNotes(prev => prev + chunk)
    })

    try {
      await window.api.ai.draft(title)
    } catch (e) {
      setAiError(String(e))
      setAiState('error')
    } finally {
      unsub()
      setAiState('idle')
    }
  }

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return
    await window.api.ai.saveKey(keyInput.trim())
    setShowKeyInput(false)
    setKeyInput('')
    handleAiDraft()
  }

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

  useEffect(() => {
    if (!showQuarters) return
    const handler = (e: MouseEvent) => {
      if (quarterPickerRef.current && !quarterPickerRef.current.contains(e.target as Node)) {
        setShowQuarters(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showQuarters])

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
            ref={titleInputRef}
            value={title}
            onChange={e => {
              const val = e.target.value
              const pos = e.target.selectionStart ?? val.length
              setTitle(val)
              handleMentionChange(val, pos, titleMention, setTitleMention, titlePending, titleInputRef.current)
            }}
            onKeyDown={e => {
              e.stopPropagation()
              handleMentionKeyDown(e, titleMention, setTitleMention, titlePending, titleInputRef.current, insertTitleMention)
            }}
            placeholder="Task title"
            className="flex-1 bg-transparent text-[16px] font-sans font-medium text-[#f0f0f0] focus:outline-none placeholder-[#444444]"
          />
          {titleMention.active && titleMention.rect && (
            <MentionPopover
              query={titleMention.query}
              highlight={titleMention.highlight}
              anchorRect={titleMention.rect}
              onSelect={insertTitleMention}
              onClose={() => setTitleMention(NO_MENTION)}
            />
          )}
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
              <div className="flex items-center gap-1">
                {(['edit', 'preview'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setNotesMode(m)}
                    disabled={aiState === 'drafting'}
                    className={`font-mono text-[10px] px-2 py-0.5 rounded transition-colors capitalize disabled:opacity-30 ${
                      notesMode === m ? 'bg-[#333333] text-[#f0f0f0]' : 'text-[#555555] hover:text-[#a0a0a0]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
                <div className="w-px h-3 bg-[#333333] mx-0.5" />
                <button
                  onClick={handleAiDraft}
                  disabled={aiState === 'drafting'}
                  className={`flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded transition-all disabled:opacity-50 ${
                    aiState === 'drafting'
                      ? 'bg-[#c45d2e]/20 text-[#c45d2e] border border-[#c45d2e]/30'
                      : 'text-[#c45d2e] hover:bg-[#c45d2e]/10 border border-transparent hover:border-[#c45d2e]/30'
                  }`}
                  title="Generate a description with AI"
                >
                  {aiState === 'drafting' ? (
                    <>
                      <svg className="animate-spin" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      drafting…
                    </>
                  ) : (
                    <>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                      </svg>
                      AI Draft
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* API key setup (first-time only) */}
            {showKeyInput && (
              <div className="mb-2 flex items-center gap-2 p-2.5 bg-[#1e1e1e] border border-[#c45d2e]/30 rounded-lg">
                <input
                  autoFocus
                  type="password"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveKey()
                    if (e.key === 'Escape') { setShowKeyInput(false); setKeyInput('') }
                    e.stopPropagation()
                  }}
                  placeholder="Anthropic API key (sk-ant-…)"
                  className="flex-1 bg-transparent font-mono text-[11px] text-[#d4d4d4] placeholder-[#444444] focus:outline-none"
                />
                <button
                  onClick={handleSaveKey}
                  className="font-mono text-[10px] px-2.5 py-1 bg-[#c45d2e] text-white rounded hover:bg-[#d4692e] transition-colors flex-shrink-0"
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowKeyInput(false); setKeyInput('') }}
                  className="font-mono text-[10px] text-[#555555] hover:text-[#f0f0f0] transition-colors"
                >
                  ×
                </button>
              </div>
            )}

            {/* AI error */}
            {aiState === 'error' && aiError && (
              <p className="mb-2 font-mono text-[10px] text-[#FC2847]">{aiError}</p>
            )}

            {notesMode === 'edit' ? (
              <>
                <textarea
                  ref={notesRef}
                  value={notes}
                  onChange={e => {
                    const val = e.target.value
                    const pos = e.target.selectionStart ?? val.length
                    setNotes(val)
                    handleMentionChange(val, pos, notesMention, setNotesMention, notesPending, notesRef.current)
                  }}
                  onKeyDown={e => {
                    e.stopPropagation()
                    handleMentionKeyDown(e, notesMention, setNotesMention, notesPending, notesRef.current, insertNotesMention)
                  }}
                  placeholder="Add a description… (markdown supported)"
                  rows={6}
                  className="w-full bg-[#1e1e1e] border border-[#333333] rounded-lg px-3 py-2.5 text-[13px] font-sans text-[#d4d4d4] placeholder-[#444444] resize-none focus:outline-none focus:border-[#c45d2e]/50 leading-relaxed"
                />
                {notesMention.active && notesMention.rect && (
                  <MentionPopover
                    query={notesMention.query}
                    highlight={notesMention.highlight}
                    anchorRect={notesMention.rect}
                    onSelect={insertNotesMention}
                    onClose={() => setNotesMention(NO_MENTION)}
                  />
                )}
              </>
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-20 flex-shrink-0">Due</span>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="bg-[#1e1e1e] border border-[#333333] rounded px-2.5 py-1 font-mono text-[11px] text-[#d4d4d4] focus:outline-none focus:border-[#c45d2e]/50 [color-scheme:dark]"
              />

              {/* Quarter picker */}
              {(() => {
                const selFYQ = dueDate ? dateToFYQ(dueDate) : null
                const btnLabel = selFYQ
                  ? `Q${selFYQ.q} FY${String(selFYQ.fy).slice(2)}`
                  : 'Quarter'
                return (
                  <div ref={quarterPickerRef} className="relative">
                    <button
                      onClick={() => setShowQuarters(v => !v)}
                      onMouseDown={e => e.stopPropagation()}
                      className={`flex items-center gap-1 font-mono text-[11px] px-2.5 py-1 rounded border transition-colors ${
                        selFYQ
                          ? 'bg-[#c45d2e]/10 border-[#c45d2e]/40 text-[#c45d2e]'
                          : 'bg-[#1e1e1e] border-[#333333] text-[#888888] hover:border-[#444444] hover:text-[#b0b0b0]'
                      }`}
                    >
                      {btnLabel}
                      <svg width="6" height="4" viewBox="0 0 6 4" fill="currentColor"
                        className={`flex-shrink-0 transition-transform ${showQuarters ? 'rotate-180' : ''}`}>
                        <path d="M0 0.5L3 3.5L6 0.5H0Z"/>
                      </svg>
                    </button>

                    {showQuarters && (
                      <div
                        className="absolute left-0 top-full mt-1 bg-[#1e1e1e] border border-[#383838] rounded-xl shadow-2xl z-20 p-2.5"
                        onMouseDown={e => e.stopPropagation()}
                      >
                        {FY_RANGE.map(fy => (
                          <div key={fy} className="flex items-center gap-1 mb-1 last:mb-0">
                            <span className="font-mono text-[10px] text-[#4a4a4a] w-8 flex-shrink-0 text-right pr-1">
                              FY{String(fy).slice(2)}
                            </span>
                            {([1, 2, 3, 4] as const).map(q => {
                              const end = quarterEnd(fy, q)
                              const isSelected = dueDate === end
                              const isCurrent  = TODAY_FYQ?.fy === fy && TODAY_FYQ?.q === q
                              return (
                                <button
                                  key={q}
                                  onClick={() => { setDueDate(end); setShowQuarters(false) }}
                                  className={`font-mono text-[10px] w-8 py-1 rounded transition-all ${
                                    isSelected
                                      ? 'bg-[#c45d2e]/20 text-[#c45d2e] border border-[#c45d2e]/50'
                                      : isCurrent
                                        ? 'text-[#d4d4d4] border border-[#555555] bg-[#2a2a2a] hover:border-[#c45d2e]/40 hover:text-[#c45d2e]'
                                        : 'text-[#666666] border border-transparent hover:bg-[#2a2a2a] hover:text-[#c0c0c0]'
                                  }`}
                                >
                                  Q{q}
                                </button>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

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
