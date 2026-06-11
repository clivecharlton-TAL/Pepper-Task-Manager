import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SubTask, TaskAttachmentWithStatus, TaskLink } from '../../../../shared/types'
import { TEAM_MEMBERS } from '../../../../shared/team'
import MentionPopover from '../shared/MentionPopover'

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

interface Props {
  subTask: SubTask
  onClose: () => void
  onChange: (updated: SubTask) => void
}

export default function SubTaskDetailModal({ subTask, onClose, onChange }: Props) {
  const [title,    setTitle]    = useState(subTask.title)
  const [notes,    setNotes]    = useState(subTask.notes ?? '')
  const [notesMode, setNotesMode] = useState<'edit' | 'preview'>(subTask.notes ? 'preview' : 'edit')
  const [assigned, setAssigned] = useState(subTask.assigned)
  const [dueDate,  setDueDate]  = useState(subTask.due_date ?? '')
  const [showPicker,    setShowPicker]    = useState(false)
  const [attachments,   setAttachments]   = useState<TaskAttachmentWithStatus[]>([])
  const [attachDragging, setAttachDragging] = useState(false)
  const [attachError,   setAttachError]   = useState('')
  const [links,          setLinks]          = useState<TaskLink[]>([])
  const [showLinkInput,  setShowLinkInput]  = useState(false)
  const [linkInput,      setLinkInput]      = useState('')
  const linkInputRef = useRef<HTMLInputElement>(null)
  const [aiState,       setAiState]       = useState<'idle' | 'drafting' | 'error'>('idle')
  const [aiError,       setAiError]       = useState('')
  const [showKeyInput,  setShowKeyInput]  = useState(false)
  const [keyInput,      setKeyInput]      = useState('')
  const [showQuarters,   setShowQuarters]   = useState(false)
  const [assignInput,    setAssignInput]    = useState('')
  const [assignMention,  setAssignMention]  = useState<{ active: boolean; query: string; highlight: number; rect: DOMRect | null }>({ active: false, query: '', highlight: 0, rect: null })
  const assignInputRef   = useRef<HTMLInputElement>(null)
  const quarterPickerRef = useRef<HTMLDivElement>(null)
  const saveRef          = useRef<() => void>(() => {})

  const isDirty =
    title.trim() !== subTask.title ||
    notes.trim() !== (subTask.notes ?? '') ||
    assigned !== subTask.assigned ||
    (dueDate || null) !== subTask.due_date

  saveRef.current = async () => {
    if (!isDirty) return
    const result = await window.api.subtasks.update(subTask.id, {
      title:    title.trim() || subTask.title,
      notes:    notes.trim() || null,
      assigned: assigned,
      due_date: dueDate || null,
    })
    if (result) onChange(result)
  }

  const handleClose = () => { saveRef.current(); onClose() }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!showPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPicker])

  useEffect(() => {
    if (!showQuarters) return
    const handler = (e: MouseEvent) => {
      if (quarterPickerRef.current && !quarterPickerRef.current.contains(e.target as Node)) setShowQuarters(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showQuarters])

  useEffect(() => {
    window.api.attachments.list(subTask.task_id).then(setAttachments)
    window.api.links.list(subTask.task_id).then(setLinks)
  }, [subTask.task_id])

  const autoLinkName = (url: string): string => {
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

  const handleAddLink = async (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    const withScheme = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    const result = await window.api.links.add(subTask.task_id, withScheme, autoLinkName(withScheme))
    if ('error' in result) { setAttachError(result.error); setTimeout(() => setAttachError(''), 3000); return }
    setLinks(prev => [...prev.filter(l => l.id !== result.id), result])
    setLinkInput('')
    setShowLinkInput(false)
  }

  useEffect(() => {
    if (showLinkInput) setTimeout(() => linkInputRef.current?.focus(), 50)
  }, [showLinkInput])

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const errors: string[] = []
    for (const file of Array.from(files)) {
      const result = await window.api.attachments.add(subTask.task_id, file.path)
      if ('error' in result) { errors.push(result.error); break }
      else setAttachments(prev => prev.some(a => a.id === result.id) ? prev : [...prev, result])
    }
    if (errors.length > 0) {
      setAttachError(errors[0])
      setTimeout(() => setAttachError(''), 3000)
    }
  }

  const handleAiDraft = async () => {
    setAiError('')
    const hasKey = await window.api.ai.hasKey()
    if (!hasKey) { setShowKeyInput(true); return }

    setAiState('drafting')
    setNotesMode('edit')
    setNotes('')

    const unsub = window.api.ai.onChunk((chunk) => setNotes(prev => prev + chunk))
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

  const handleModalDragOver = (e: React.DragEvent) => {
    const hasFiles = e.dataTransfer.types.includes('Files')
    const hasUri   = e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain')
    if (!hasFiles && !hasUri) return
    e.preventDefault()
    setAttachDragging(true)
  }

  const handleModalDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setAttachDragging(false)
    }
  }

  const handleModalDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setAttachDragging(false)
    if (e.dataTransfer.types.includes('Files') && e.dataTransfer.files.length > 0) {
      handleAttachFiles(e.dataTransfer.files)
      return
    }
    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (uri && uri.startsWith('http')) handleAddLink(uri.split('\n')[0].trim())
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onMouseDown={handleClose}
    >
      <div
        className={`relative bg-[#242424] border rounded-xl shadow-2xl flex flex-col transition-colors ${attachDragging ? 'border-[#c45d2e]/50' : 'border-[#383838]'}`}
        style={{ width: 520, maxHeight: '78vh' }}
        onMouseDown={e => e.stopPropagation()}
        onDragOver={handleModalDragOver}
        onDragLeave={handleModalDragLeave}
        onDrop={handleModalDrop}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 flex-shrink-0">
          {/* Done toggle */}
          <button
            onClick={async () => {
              const result = await window.api.subtasks.update(subTask.id, { done: !subTask.done })
              if (result) onChange(result)
            }}
            className="flex-shrink-0 mt-0.5 transition-opacity hover:opacity-70"
          >
            {subTask.done ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7.5" fill="#4caf82"/>
                <path d="M5 8.2L7 10.2L11 6" stroke="#1c1c1e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7.5" stroke="#555555" strokeWidth="1.2"/>
              </svg>
            )}
          </button>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            className="flex-1 bg-transparent text-[15px] font-sans text-[#f0f0f0] placeholder-[#555555] focus:outline-none leading-snug"
            placeholder="Sub-task title"
          />

          <button
            onClick={handleClose}
            className="flex-shrink-0 text-[#4a4a4a] hover:text-[#888888] transition-colors leading-none text-[18px] mt-0.5"
          >
            ×
          </button>
        </div>

        <div className="h-px bg-[#2e2e2e] flex-shrink-0" />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Notes</span>
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
                  title="Generate notes with AI"
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
                <button onClick={handleSaveKey} className="font-mono text-[10px] px-2.5 py-1 bg-[#c45d2e] text-white rounded hover:bg-[#d4692e] transition-colors flex-shrink-0">Save</button>
                <button onClick={() => { setShowKeyInput(false); setKeyInput('') }} className="font-mono text-[10px] text-[#555555] hover:text-[#f0f0f0] transition-colors">×</button>
              </div>
            )}

            {aiState === 'error' && aiError && (
              <p className="mb-2 font-mono text-[10px] text-[#FC2847]">{aiError}</p>
            )}

            {notesMode === 'edit' ? (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                placeholder="Add notes… (markdown supported)"
                rows={6}
                className="w-full bg-[#1e1e1e] border border-[#333333] rounded-lg px-3 py-2.5 text-[13px] font-sans text-[#d4d4d4] placeholder-[#444444] resize-none focus:outline-none focus:border-[#c45d2e]/50 leading-relaxed"
              />
            ) : (
              <div className="bg-[#1e1e1e] border border-[#333333] rounded-lg px-3 py-2.5 min-h-[120px]">
                {notes ? (
                  <div className="text-[13px] font-sans text-[#b0b0b0] leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[12px] text-[#444444] italic">No notes</p>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-[#2e2e2e]" />

          {/* Assigned */}
          <div className="flex items-start gap-4">
            <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-20 pt-1 flex-shrink-0">Assigned</span>
            <div className="flex-1">
              <div className="flex flex-wrap gap-1.5 items-center">
                {assigned && (
                  <span className="font-mono text-[10px] tracking-wide px-2 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: '#4a9eca22', color: '#4a9eca' }}>
                    @{assigned}
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={() => setAssigned(null)}
                      className="opacity-50 hover:opacity-100 transition-opacity leading-none ml-0.5"
                    >×</button>
                  </span>
                )}
                <div className="relative">
                  <input
                    ref={assignInputRef}
                    value={assignInput}
                    onChange={e => {
                      const val = e.target.value
                      setAssignInput(val)
                      if (val.startsWith('@')) {
                        setAssignMention({ active: true, query: val.slice(1), highlight: 0, rect: assignInputRef.current?.getBoundingClientRect() ?? null })
                      } else {
                        setAssignMention(m => ({ ...m, active: false }))
                      }
                    }}
                    onKeyDown={e => {
                      e.stopPropagation()
                      if (e.key === '@') {
                        setAssignMention({ active: true, query: '', highlight: 0, rect: assignInputRef.current?.getBoundingClientRect() ?? null })
                      }
                      if (assignMention.active) {
                        const members = TEAM_MEMBERS.filter(m => m.name.toLowerCase().includes(assignMention.query.toLowerCase()))
                        if (e.key === 'ArrowDown') { e.preventDefault(); setAssignMention(m => ({ ...m, highlight: Math.min(m.highlight + 1, members.length - 1) })) }
                        if (e.key === 'ArrowUp')   { e.preventDefault(); setAssignMention(m => ({ ...m, highlight: Math.max(m.highlight - 1, 0) })) }
                        if (e.key === 'Enter' && members[assignMention.highlight]) {
                          e.preventDefault()
                          setAssigned(members[assignMention.highlight].name)
                          setAssignInput('')
                          setAssignMention({ active: false, query: '', highlight: 0, rect: null })
                        }
                        if (e.key === 'Escape') setAssignMention({ active: false, query: '', highlight: 0, rect: null })
                      }
                    }}
                    placeholder="@ to assign…"
                    className="bg-transparent font-mono text-[10px] text-[#d4d4d4] placeholder-[#444444] focus:outline-none"
                    style={{ minWidth: 100 }}
                  />
                  {assignMention.active && assignMention.rect && (
                    <MentionPopover
                      query={assignMention.query}
                      highlight={assignMention.highlight}
                      anchorRect={assignMention.rect}
                      onSelect={name => { setAssigned(name); setAssignInput(''); setAssignMention({ active: false, query: '', highlight: 0, rect: null }) }}
                      onClose={() => setAssignMention({ active: false, query: '', highlight: 0, rect: null })}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Files + Links */}
          <div className="flex items-start gap-4">
            <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-20 pt-1 flex-shrink-0">Files</span>
            <div
              className={`flex-1 rounded-lg transition-all ${attachDragging ? 'border border-dashed border-[#c45d2e]/60 bg-[#c45d2e]/5 p-2' : 'p-0'}`}
            >
              {attachError && (
                <p className="font-mono text-[10px] text-[#FC2847] mb-1.5">{attachError}</p>
              )}
              <div className="flex flex-wrap gap-1.5 items-center">
                {attachments.map(a => (
                  <span
                    key={a.id}
                    className={`font-mono text-[10px] px-2 py-0.5 rounded flex items-center gap-1 ${
                      a.exists
                        ? 'bg-[#2e2e2e] text-[#b0b0b0] hover:text-[#e0e0e0] cursor-pointer'
                        : 'bg-[#2a2a2a] text-[#4a4a4a] cursor-default'
                    }`}
                    onClick={() => a.exists && window.api.attachments.open(a.path)}
                    onContextMenu={e => { e.preventDefault(); a.exists && window.api.attachments.reveal(a.path) }}
                    title={a.exists ? a.path : `File not found: ${a.path}`}
                  >
                    {!a.exists && <span className="text-[#FFC400]">⚠</span>}
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
                      <path d="M2 1h4l3 3v5H2V1z" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round"/>
                      <path d="M6 1v3h3" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round"/>
                    </svg>
                    <span className="max-w-[140px] truncate">{a.name}</span>
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); window.api.attachments.remove(a.id); setAttachments(prev => prev.filter(x => x.id !== a.id)) }}
                      className="opacity-50 hover:opacity-100 transition-opacity leading-none ml-0.5 hover:text-[#FC2847]"
                    >×</button>
                  </span>
                ))}
                {links.map(l => (
                  <span
                    key={l.id}
                    className="font-mono text-[10px] px-2 py-0.5 rounded flex items-center gap-1 bg-[#1a2a3a] text-[#4a9eca] hover:text-[#7ab8e0] cursor-pointer"
                    onClick={() => window.api.links.open(l.url)}
                    title={l.url}
                  >
                    <SubLinkIcon url={l.url} />
                    <span className="max-w-[140px] truncate">{l.name}</span>
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); window.api.links.remove(l.id); setLinks(prev => prev.filter(x => x.id !== l.id)) }}
                      className="opacity-50 hover:opacity-100 transition-opacity leading-none ml-0.5 hover:text-[#FC2847]"
                    >×</button>
                  </span>
                ))}
                {attachments.length === 0 && links.length === 0 && !attachDragging && !showLinkInput && (
                  <span className="font-mono text-[10px] text-[#3a3a3a]">Drop files or links here</span>
                )}
                {showLinkInput ? (
                  <input
                    ref={linkInputRef}
                    value={linkInput}
                    onChange={e => setLinkInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddLink(linkInput) }
                      if (e.key === 'Escape') { setShowLinkInput(false); setLinkInput('') }
                    }}
                    onBlur={() => { if (!linkInput.trim()) setShowLinkInput(false) }}
                    placeholder="Paste URL…"
                    className="font-mono text-[10px] bg-[#1e2a38] border border-[#4a9eca]/40 rounded px-2 py-0.5 text-[#a0c8e8] placeholder-[#3a5a70] focus:outline-none w-48"
                  />
                ) : (
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => setShowLinkInput(true)}
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#333] text-[#4a4a4a] hover:border-[#4a9eca]/50 hover:text-[#4a9eca] transition-colors"
                    title="Add a link"
                  >+ link</button>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-[#2e2e2e]" />

          {/* Due date */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-20 flex-shrink-0">Due</span>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="bg-[#1e1e1e] border border-[#333333] rounded px-2.5 py-1 font-mono text-[11px] text-[#d4d4d4] focus:outline-none focus:border-[#c45d2e]/50 [color-scheme:dark]"
            />
            {(() => {
              const selFYQ = dueDate ? dateToFYQ(dueDate) : null
              const btnLabel = selFYQ ? `Q${selFYQ.q} FY${String(selFYQ.fy).slice(2)}` : 'Quarter'
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

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2e2e2e] flex-shrink-0">
          <p className="font-mono text-[10px] text-[#3a3a3a]">
            Created {format(parseISO(subTask.created_at), 'MMM d, yyyy · HH:mm')}
          </p>
          <button
            onClick={handleClose}
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

function SubLinkIcon({ url }: { url: string }) {
  if (url.includes('google.com')) {
    return <span className="text-[9px] font-bold leading-none flex-shrink-0" style={{ color: '#4285f4' }}>G</span>
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
      <path d="M4 5.5a2.5 2.5 0 003.5 0l1-1a2.5 2.5 0 00-3.5-3.5L4.5 1.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M6 4.5a2.5 2.5 0 00-3.5 0l-1 1a2.5 2.5 0 003.5 3.5L5.5 8.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
    </svg>
  )
}
