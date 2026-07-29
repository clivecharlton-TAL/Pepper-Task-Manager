import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import LabelTreeView from './LabelTreeView'
import MentionPopover from '../shared/MentionPopover'
import type { TaskPriority, TaskStatus } from '../../../../shared/types'
import { TEAM_MEMBERS } from '../../../../shared/team'

type MentionState = { active: boolean; start: number; query: string; highlight: number; rect: DOMRect | null }
const NO_MENTION: MentionState = { active: false, start: -1, query: '', highlight: 0, rect: null }

function filteredMembers(query: string) {
  const q = query.toLowerCase()
  return TEAM_MEMBERS.filter(m => m.name.toLowerCase().includes(q))
}

type View = 'form' | 'labels'

const PRIORITIES: { value: TaskPriority; label: string; colour: string }[] = [
  { value: 'high',   label: 'High',   colour: '#FC2847' },
  { value: 'medium', label: 'Med',    colour: '#FFC400' },
  { value: 'low',    label: 'Low',    colour: '#30D158' }
]

const STATUSES: { value: TaskStatus; label: string; colour: string }[] = [
  { value: 'backlog',     label: 'Backlog',  colour: '#6b7280' },
  { value: 'todo',        label: 'Todo',     colour: '#4a9eca' },
  { value: 'in_progress', label: 'Doing',    colour: '#d4a843' },
  { value: 'done',        label: 'Done',     colour: '#4caf82' },
]

function autoLinkName(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('docs.google.com')) {
      if (u.pathname.includes('/presentation')) return 'Google Slides'
      if (u.pathname.includes('/spreadsheets')) return 'Google Sheets'
      if (u.pathname.includes('/forms')) return 'Google Form'
      if (u.pathname.includes('/drawings')) return 'Google Drawing'
      return 'Google Doc'
    }
    if (u.hostname.includes('drive.google.com')) return 'Google Drive'
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url.length > 40 ? url.slice(0, 37) + '…' : url
  }
}

function LinkIcon({ url }: { url: string }) {
  const isGoogle = url.includes('google.com')
  if (isGoogle) {
    return (
      <span className="text-[9px] font-bold leading-none flex-shrink-0" style={{ color: '#4285f4' }}>G</span>
    )
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
      <path d="M4 5.5a2.5 2.5 0 003.5 0l1-1a2.5 2.5 0 00-3.5-3.5L4.5 1.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M6 4.5a2.5 2.5 0 00-3.5 0l-1 1a2.5 2.5 0 003.5 3.5L5.5 8.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
    </svg>
  )
}

// Files/links can't be attached until a task row exists, so drops are staged
// locally and flushed via attachments.add/links.add right after createTask resolves.
type StagedFile = { path: string; name: string }
type StagedLink = { url: string; name: string }

export default function QuickAddPanel() {
  const { createTask, labels } = useTaskStore()
  const [view, setView]                   = useState<View>('form')
  const [title, setTitle]                 = useState('')
  const [notes, setNotes]                 = useState('')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [status, setStatus]               = useState<TaskStatus>('backlog')
  const [priority, setPriority]           = useState<TaskPriority>('medium')
  const [dueDate, setDueDate]             = useState('')
  const [assigned, setAssigned]           = useState<string[]>([])
  const [assignedInput, setAssignedInput] = useState('')
  const [emailCtx, setEmailCtx]           = useState<{ id: string; subject: string; body?: string } | null>(null)
  const [stagedFiles, setStagedFiles]     = useState<StagedFile[]>([])
  const [stagedLinks, setStagedLinks]     = useState<StagedLink[]>([])
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkInput, setLinkInput]         = useState('')
  const [filesDragging, setFilesDragging] = useState(false)
  const [submitError, setSubmitError]     = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const assignedInputRef = useRef<HTMLInputElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const [titleMention, setTitleMention] = useState<MentionState>(NO_MENTION)
  const [notesMention, setNotesMention] = useState<MentionState>(NO_MENTION)
  const [assignedMention, setAssignedMention] = useState<MentionState>(NO_MENTION)
  const titlePending = useRef<number | null>(null)
  const notesPending = useRef<number | null>(null)
  const assignedPending = useRef<number | null>(null)

  // Pull context from main process each time the window is focused (reshown)
  useEffect(() => {
    const onFocus = async () => {
      // Always reset to a clean form first
      setTitle('')
      setNotes('')
      setSelectedLabels([])
      setStatus('backlog')
      setPriority('medium')
      setDueDate('')
      setAssigned([])
      setAssignedInput('')
      setEmailCtx(null)
      setStagedFiles([])
      setStagedLinks([])
      setShowLinkInput(false)
      setLinkInput('')
      setSubmitError('')
      setView('form')

      const raw = await window.api.window.getContext()
      if (!raw) return
      const ctx = raw as { id?: string; subject?: string; body?: string; title?: string; notes?: string }
      if (ctx.id && ctx.subject) {
        setEmailCtx({ id: ctx.id, subject: ctx.subject, body: ctx.body })
        setTitle(ctx.subject)
        if (ctx.body) setNotes(ctx.body)
      } else if (ctx.title) {
        setTitle(ctx.title)
        if (ctx.notes) setNotes(ctx.notes)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    titleRef.current?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'labels') setView('form')
        else window.api.window.hideQuickAdd()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [view])

  useEffect(() => {
    if (showLinkInput) setTimeout(() => linkInputRef.current?.focus(), 50)
  }, [showLinkInput])

  const submit = async () => {
    if (!title.trim()) return
    setSubmitError('')
    const task = await createTask({
      title: title.trim(),
      notes: notes.trim() || undefined,
      labels: selectedLabels,
      status,
      priority,
      due_date: dueDate || undefined,
      assigned,
      linked_email_id: emailCtx?.id,
      linked_email_subject: emailCtx?.subject
    })

    let attachError = ''
    for (const file of stagedFiles) {
      const result = await window.api.attachments.add(task.id, file.path)
      if (result && 'error' in result) { attachError = result.error; break }
    }
    if (!attachError) {
      for (const link of stagedLinks) {
        const result = await window.api.links.add(task.id, link.url, link.name)
        if (result && 'error' in result) { attachError = result.error; break }
      }
    }
    if (attachError) {
      // Task was created successfully; only the file/link staging partially failed.
      // Keep the panel open so the user sees why, instead of silently hiding it.
      setSubmitError(attachError)
      setStagedFiles([])
      setStagedLinks([])
      return
    }

    setTitle('')
    setNotes('')
    setSelectedLabels([])
    setStatus('backlog')
    setPriority('medium')
    setDueDate('')
    setAssigned([])
    setAssignedInput('')
    setEmailCtx(null)
    setStagedFiles([])
    setStagedLinks([])
    window.api.window.hideQuickAdd()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  // ─── Mention helpers ───────────────────────────────────────────────────────
  function makeMentionKeyDown(
    mention: MentionState,
    setMention: (m: MentionState) => void,
    pending: React.MutableRefObject<number | null>,
    inputEl: () => HTMLElement | null,
    insertMention: (name: string) => void
  ) {
    return (e: KeyboardEvent) => {
      if (e.key === '@') {
        const el = inputEl()
        const pos = (el as HTMLInputElement | HTMLTextAreaElement)?.selectionStart ?? 0
        pending.current = pos
      }
      if (mention.active) {
        const members = filteredMembers(mention.query)
        if (e.key === 'ArrowDown') { e.preventDefault(); setMention({ ...mention, highlight: Math.min(mention.highlight + 1, members.length - 1) }) }
        if (e.key === 'ArrowUp')   { e.preventDefault(); setMention({ ...mention, highlight: Math.max(mention.highlight - 1, 0) }) }
        if (e.key === 'Enter' && members[mention.highlight]) { e.preventDefault(); insertMention(members[mention.highlight].name) }
        if (e.key === 'Escape')    { e.stopPropagation(); setMention(NO_MENTION) }
      }
    }
  }

  function makeMentionChange(
    mention: MentionState,
    setMention: (m: MentionState) => void,
    pending: React.MutableRefObject<number | null>,
    inputEl: () => HTMLInputElement | HTMLTextAreaElement | null,
    setValue: (v: string) => void
  ) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const val = e.target.value
      const pos = e.target.selectionStart ?? val.length
      setValue(val)
      if (pending.current !== null) {
        const start = pending.current
        pending.current = null
        if (val[start] === '@') {
          const rect = (inputEl() as HTMLElement)?.getBoundingClientRect() ?? null
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
  }

  function makeInsertMention(
    mention: MentionState,
    setMention: (m: MentionState) => void,
    value: string,
    setValue: (v: string) => void,
    focus: () => void
  ) {
    return (name: string) => {
      const before = value.slice(0, mention.start)
      const after  = value.slice(mention.start + 1 + mention.query.length)
      setValue(`${before}@${name} ${after}`)
      setMention(NO_MENTION)
      focus()
    }
  }

  const insertTitleMention = makeInsertMention(titleMention, setTitleMention, title, setTitle, () => titleRef.current?.focus())
  const insertNotesMention = makeInsertMention(notesMention, setNotesMention, notes, setNotes, () => notesRef.current?.focus())

  const insertAssignedMention = (name: string) => {
    if (!assigned.includes(name)) setAssigned(prev => [...prev, name])
    setAssignedInput('')
    setAssignedMention(NO_MENTION)
    assignedInputRef.current?.focus()
  }

  // ─── Files / links staging ─────────────────────────────────────────────
  const handleStageFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const additions: StagedFile[] = Array.from(files).map(f => ({ path: f.path, name: f.name }))
    setStagedFiles(prev => [...prev, ...additions])
  }

  const handleStageLink = (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    const withScheme = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    setStagedLinks(prev => [...prev, { url: withScheme, name: autoLinkName(withScheme) }])
    setLinkInput('')
    setShowLinkInput(false)
  }

  const handleFormDragOver = (e: React.DragEvent) => {
    const hasFiles = e.dataTransfer.types.includes('Files')
    const hasUri   = e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain')
    if (!hasFiles && !hasUri) return
    e.preventDefault()
    setFilesDragging(true)
  }

  const handleFormDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setFilesDragging(false)
    }
  }

  const handleFormDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setFilesDragging(false)
    if (e.dataTransfer.types.includes('Files') && e.dataTransfer.files.length > 0) {
      handleStageFiles(e.dataTransfer.files)
      return
    }
    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (uri && uri.startsWith('http')) handleStageLink(uri.split('\n')[0].trim())
  }

  // ─── Label picker view ─────────────────────────────────────────────────
  if (view === 'labels') {
    return (
      <div className="h-screen flex flex-col bg-[#1c1c1c]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#333333] flex-shrink-0">
          <button
            onClick={() => setView('form')}
            className="text-[#c45d2e] font-mono text-[11px] tracking-wider uppercase hover:opacity-70 transition-opacity"
          >
            ← Back
          </button>
          <span className="font-mono text-[11px] tracking-wider uppercase text-[#6b7280]">
            Select Labels
          </span>
          {selectedLabels.length > 0 && (
            <button
              onClick={() => setSelectedLabels([])}
              className="ml-auto text-[11px] text-[#6b7280] hover:text-[#FC2847] transition-colors"
            >
              Clear ({selectedLabels.length})
            </button>
          )}
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto">
          <LabelTreeView
            labels={labels}
            selected={selectedLabels}
            onChange={setSelectedLabels}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#333333] flex-shrink-0">
          <button
            onClick={() => setView('form')}
            className="w-full py-2 bg-[#c45d2e] hover:bg-[#d46a38] text-[#f0f0f0] font-mono text-[11px] tracking-wider uppercase rounded transition-colors"
          >
            Done{selectedLabels.length > 0 ? ` — ${selectedLabels.length} selected` : ''}
          </button>
        </div>
      </div>
    )
  }

  // ─── Main form view ────────────────────────────────────────────────────
  return (
    <div
      className="h-screen flex flex-col bg-[#1c1c1c] overflow-y-auto"
      onDragOver={handleFormDragOver}
      onDragLeave={handleFormDragLeave}
      onDrop={handleFormDrop}
    >

      {/* Title */}
      <div className="px-4 pt-4 pb-3 flex-shrink-0">
        {emailCtx && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="font-mono text-[10px] tracking-wider uppercase text-[#6b7280]">From email</span>
            <span className="font-mono text-[10px] text-[#c45d2e] truncate">{emailCtx.subject}</span>
          </div>
        )}
        <input
          ref={titleRef}
          value={title}
          onChange={makeMentionChange(titleMention, setTitleMention, titlePending, () => titleRef.current, setTitle)}
          onKeyDown={e => {
            makeMentionKeyDown(titleMention, setTitleMention, titlePending, () => titleRef.current, insertTitleMention)(e)
            onKeyDown(e)
          }}
          placeholder="What needs to be done?"
          className="w-full text-[15px] font-sans text-[#f0f0f0] placeholder-[#6b7280] bg-transparent border-none focus:outline-none"
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
      </div>

      {/* Notes */}
      <div className="px-4 pb-3 flex-shrink-0">
        <textarea
          ref={notesRef}
          value={notes}
          onChange={makeMentionChange(notesMention, setNotesMention, notesPending, () => notesRef.current, setNotes)}
          onKeyDown={makeMentionKeyDown(notesMention, setNotesMention, notesPending, () => notesRef.current, insertNotesMention)}
          placeholder="Add description…"
          rows={3}
          className="w-full text-[12px] font-sans text-[#c0c0c0] placeholder-[#444444] bg-transparent border-none resize-none leading-relaxed focus:outline-none"
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
      </div>

      <div className="h-px bg-[#333333] mx-4 flex-shrink-0" />

      {/* Status */}
      <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0">
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#6b7280] w-14 flex-shrink-0">Status</span>
        <div className="flex border border-[#333333] rounded overflow-hidden">
          {STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className="px-2.5 py-1.5 text-[11px] font-mono tracking-wide transition-all no-drag"
              style={status === s.value
                ? { backgroundColor: s.colour + '22', color: s.colour }
                : { color: '#6b7280' }
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assigned */}
      <div className="px-4 pb-3 flex items-start gap-2 flex-shrink-0">
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#6b7280] w-14 pt-1.5 flex-shrink-0">Assigned</span>
        <div className="flex-1 flex flex-wrap gap-1.5 items-center">
          {assigned.map(name => (
            <span
              key={name}
              className="font-mono text-[10px] tracking-wide px-2 py-1 rounded flex items-center gap-1"
              style={{ backgroundColor: '#4a9eca22', color: '#4a9eca' }}
            >
              @{name}
              <button
                onClick={() => setAssigned(prev => prev.filter(n => n !== name))}
                className="opacity-50 hover:opacity-100 transition-opacity leading-none ml-0.5 no-drag"
              >
                ×
              </button>
            </span>
          ))}
          <div className="relative">
            <input
              ref={assignedInputRef}
              value={assignedInput}
              onChange={makeMentionChange(assignedMention, setAssignedMention, assignedPending, () => assignedInputRef.current, setAssignedInput)}
              onKeyDown={makeMentionKeyDown(assignedMention, setAssignedMention, assignedPending, () => assignedInputRef.current, insertAssignedMention)}
              placeholder="@ to assign…"
              className="bg-transparent font-mono text-[11px] text-[#d4d4d4] placeholder-[#6b7280] focus:outline-none no-drag py-1"
              style={{ minWidth: 100 }}
            />
            {assignedMention.active && assignedMention.rect && (
              <MentionPopover
                query={assignedMention.query}
                highlight={assignedMention.highlight}
                anchorRect={assignedMention.rect}
                onSelect={insertAssignedMention}
                onClose={() => setAssignedMention(NO_MENTION)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="h-px bg-[#333333] mx-4 flex-shrink-0" />

      {/* Controls: label / priority / due date */}
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap flex-shrink-0">

        {/* Label button */}
        <button
          onClick={() => setView('labels')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[#333333] hover:border-[#c45d2e]/40 hover:bg-[#3d2218]/30 transition-all text-[11px] font-mono tracking-wide no-drag"
        >
          {selectedLabels.length === 0 ? (
            <span className="text-[#6b7280]">Label</span>
          ) : (
            <>
              <div className="flex gap-1">
                {selectedLabels.slice(0, 2).map(id => {
                  const flat = flattenLabels(labels)
                  const l = flat.find(x => x.id === id)
                  return l ? (
                    <span
                      key={id}
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: l.colour }}
                    />
                  ) : null
                })}
              </div>
              <span className="text-[#f0f0f0]">
                {selectedLabels.length === 1
                  ? flattenLabels(labels).find(l => l.id === selectedLabels[0])?.name ?? '1 label'
                  : `${selectedLabels.length} labels`}
              </span>
            </>
          )}
        </button>

        {/* Priority */}
        <div className="flex border border-[#333333] rounded overflow-hidden">
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              onClick={() => setPriority(p.value)}
              className="px-2.5 py-1.5 text-[11px] font-mono tracking-wide transition-all no-drag"
              style={priority === p.value
                ? { backgroundColor: p.colour + '22', color: p.colour }
                : { color: '#6b7280' }
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Due date */}
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="px-2.5 py-1.5 text-[11px] font-mono text-[#6b7280] bg-transparent border border-[#333333] rounded hover:border-[#6b7280] transition-colors cursor-pointer no-drag"
          style={{ colorScheme: 'dark' }}
        />
        {dueDate && (
          <button
            onClick={() => setDueDate('')}
            className="font-mono text-[10px] text-[#555555] hover:text-[#FC2847] transition-colors no-drag"
          >
            clear
          </button>
        )}
      </div>

      <div className="h-px bg-[#333333] mx-4 flex-shrink-0" />

      {/* Files / Links */}
      <div className="px-4 py-3 flex items-start gap-2 flex-shrink-0">
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#6b7280] w-14 pt-1.5 flex-shrink-0">Files</span>
        <div
          className={`flex-1 rounded-lg transition-all ${filesDragging ? 'border border-dashed border-[#c45d2e]/60 bg-[#c45d2e]/5 p-2' : 'p-0'}`}
        >
          {submitError && (
            <p className="font-mono text-[10px] text-[#FC2847] mb-1.5">{submitError}</p>
          )}
          <div className="flex flex-wrap gap-1.5 items-center">
            {stagedFiles.map((f, i) => (
              <span
                key={`${f.path}-${i}`}
                className="font-mono text-[10px] px-2 py-1 rounded flex items-center gap-1 bg-[#2e2e2e] text-[#b0b0b0]"
                title={f.path}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
                  <path d="M2 1h4l3 3v5H2V1z" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round"/>
                  <path d="M6 1v3h3" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round"/>
                </svg>
                <span className="max-w-[140px] truncate">{f.name}</span>
                <button
                  onClick={() => setStagedFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="opacity-50 hover:opacity-100 transition-opacity leading-none ml-0.5 hover:text-[#FC2847] no-drag"
                >×</button>
              </span>
            ))}
            {stagedLinks.map((l, i) => (
              <span
                key={`${l.url}-${i}`}
                className="font-mono text-[10px] px-2 py-1 rounded flex items-center gap-1 bg-[#1a2a3a] text-[#4a9eca]"
                title={l.url}
              >
                <LinkIcon url={l.url} />
                <span className="max-w-[140px] truncate">{l.name}</span>
                <button
                  onClick={() => setStagedLinks(prev => prev.filter((_, idx) => idx !== i))}
                  className="opacity-50 hover:opacity-100 transition-opacity leading-none ml-0.5 hover:text-[#FC2847] no-drag"
                >×</button>
              </span>
            ))}
            {stagedFiles.length === 0 && stagedLinks.length === 0 && !filesDragging && !showLinkInput && (
              <span className="font-mono text-[10px] text-[#444444]">Drop files or links here</span>
            )}
            {showLinkInput ? (
              <input
                ref={linkInputRef}
                value={linkInput}
                onChange={e => setLinkInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleStageLink(linkInput) }
                  if (e.key === 'Escape') { e.stopPropagation(); setShowLinkInput(false); setLinkInput('') }
                }}
                onBlur={() => { if (!linkInput.trim()) setShowLinkInput(false) }}
                placeholder="Paste URL…"
                className="font-mono text-[10px] bg-[#1e2a38] border border-[#4a9eca]/40 rounded px-2 py-1 text-[#a0c8e8] placeholder-[#3a5a70] focus:outline-none w-40 no-drag"
              />
            ) : (
              <button
                onClick={() => setShowLinkInput(true)}
                className="font-mono text-[10px] px-1.5 py-1 rounded border border-[#333] text-[#6b7280] hover:border-[#4a9eca]/50 hover:text-[#4a9eca] transition-colors no-drag"
                title="Add a link"
              >+ link</button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="h-px bg-[#333333] mx-4 flex-shrink-0" />

      {/* Footer */}
      <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => window.api.window.hideQuickAdd()}
          className="font-mono text-[11px] tracking-wider uppercase text-[#6b7280] hover:text-[#f0f0f0] transition-colors no-drag"
        >
          Cancel
        </button>
        <div className="flex-1" />
        <span className="font-mono text-[10px] text-[#6b7280]">↵ to save</span>
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="px-4 py-1.5 bg-[#c45d2e] hover:bg-[#d46a38] disabled:opacity-30 text-[#f0f0f0] font-mono text-[11px] tracking-wider uppercase rounded transition-colors no-drag"
        >
          Add Task
        </button>
      </div>
    </div>
  )
}

import type { LabelNode } from '../../../../shared/types'
function flattenLabels(nodes: LabelNode[]): LabelNode[] {
  const result: LabelNode[] = []
  const walk = (arr: LabelNode[]) => { for (const n of arr) { result.push(n); walk(n.children) } }
  walk(nodes)
  return result
}
