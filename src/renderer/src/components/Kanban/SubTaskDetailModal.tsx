import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SubTask, TaskAttachmentWithStatus } from '../../../../shared/types'
import { TEAM_MEMBERS } from '../../../../shared/team'

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
  const pickerRef = useRef<HTMLDivElement>(null)
  const saveRef   = useRef<() => void>(() => {})

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
    window.api.attachments.list(subTask.task_id).then(setAttachments)
  }, [subTask.task_id])

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

  const handleModalDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setAttachDragging(true)
  }

  const handleModalDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setAttachDragging(false)
    }
  }

  const handleModalDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setAttachDragging(false)
    handleAttachFiles(e.dataTransfer.files)
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
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Notes</span>
              <button
                onClick={() => setNotesMode(m => m === 'edit' ? 'preview' : 'edit')}
                className="font-mono text-[10px] text-[#4a4a4a] hover:text-[#888888] transition-colors"
              >
                {notesMode === 'edit' ? 'preview' : 'edit'}
              </button>
            </div>

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
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-20 flex-shrink-0">Assigned</span>
            <div className="relative">
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setShowPicker(v => !v)}
                className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  assigned
                    ? 'border-[#4a9eca44] bg-[#4a9eca11] text-[#4a9eca]'
                    : 'border-[#383838] text-[#666666] hover:border-[#555555] hover:text-[#999999]'
                }`}
              >
                {assigned ? `@${assigned}` : '@ Assign'}
              </button>
              {showPicker && (
                <div
                  ref={pickerRef}
                  className="absolute left-0 top-full mt-1 z-20 bg-[#1e1e1e] border border-[#383838] rounded-xl shadow-2xl overflow-y-auto"
                  style={{ width: 220, maxHeight: 220 }}
                  onMouseDown={e => e.stopPropagation()}
                >
                  {assigned && (
                    <button
                      onClick={() => { setAssigned(null); setShowPicker(false) }}
                      className="w-full text-left px-3 py-1.5 font-mono text-[10px] text-[#FC2847] hover:bg-[#2a2a2a] transition-colors"
                    >
                      Remove
                    </button>
                  )}
                  {TEAM_MEMBERS.map(m => (
                    <button
                      key={m.name}
                      onClick={() => { setAssigned(m.name); setShowPicker(false) }}
                      className="w-full text-left px-3 py-1.5 font-mono text-[10px] text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors"
                    >
                      <span className="block truncate">{m.name}</span>
                      <span className="block truncate text-[#555555]">{m.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Files */}
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
                    >
                      ×
                    </button>
                  </span>
                ))}
                {attachments.length === 0 && !attachDragging && (
                  <span className="font-mono text-[10px] text-[#3a3a3a]">Drop files here</span>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-[#2e2e2e]" />

          {/* Due date */}
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-20 flex-shrink-0">Due</span>
            <div className="flex items-center gap-2">
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
