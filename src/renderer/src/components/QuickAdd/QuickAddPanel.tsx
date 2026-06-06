import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import LabelTreeView from './LabelTreeView'
import type { TaskPriority } from '../../../../shared/types'

type View = 'form' | 'labels'

const PRIORITIES: { value: TaskPriority; label: string; colour: string }[] = [
  { value: 'high',   label: 'High',   colour: '#FC2847' },
  { value: 'medium', label: 'Med',    colour: '#FFC400' },
  { value: 'low',    label: 'Low',    colour: '#30D158' }
]

export default function QuickAddPanel() {
  const { createTask, labels } = useTaskStore()
  const [view, setView]                   = useState<View>('form')
  const [title, setTitle]                 = useState('')
  const [notes, setNotes]                 = useState('')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [priority, setPriority]           = useState<TaskPriority>('medium')
  const [dueDate, setDueDate]             = useState('')
  const [emailCtx, setEmailCtx]           = useState<{ id: string; subject: string; body?: string } | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
    const unsub = window.api.on('set-email-context', (ctx: unknown) => {
      const c = ctx as { id: string; subject: string; body?: string }
      setEmailCtx(c)
      setTitle(c.subject)
      if (c.body) setNotes(c.body)
    })
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'labels') setView('form')
        else window.api.window.hideQuickAdd()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { unsub(); window.removeEventListener('keydown', onKey) }
  }, [view])

  const submit = async () => {
    if (!title.trim()) return
    await createTask({
      title: title.trim(),
      notes: notes.trim() || undefined,
      labels: selectedLabels,
      priority,
      due_date: dueDate || undefined,
      linked_email_id: emailCtx?.id,
      linked_email_subject: emailCtx?.subject
    })
    window.api.window.hideQuickAdd()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const activePriority = PRIORITIES.find(p => p.value === priority)!

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
    <div className="h-screen flex flex-col bg-[#1c1c1c]">

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
          onChange={e => setTitle(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="What needs to be done?"
          className="w-full text-[15px] font-sans text-[#f0f0f0] placeholder-[#6b7280] bg-transparent border-none"
        />
      </div>

      {/* Notes */}
      <div className="px-4 pb-3 flex-shrink-0">
        <textarea
          ref={notesRef}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add description…"
          rows={3}
          className="w-full text-[12px] font-sans text-[#c0c0c0] placeholder-[#444444] bg-transparent border-none resize-none leading-relaxed focus:outline-none"
        />
      </div>

      <div className="h-px bg-[#333333] mx-4 flex-shrink-0" />

      {/* Controls */}
      <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0">

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
      </div>

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
