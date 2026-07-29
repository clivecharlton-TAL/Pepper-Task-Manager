import { useState, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { Task } from '../../../../shared/types'
import { TEAM_MEMBERS } from '../../../../shared/team'
import EditorToolbar from '../Notes/EditorToolbar'

interface Props {
  task: Task
  onClose: () => void
}

function emailFor(name: string): string | null {
  return TEAM_MEMBERS.find(m => m.name === name)?.email ?? null
}

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/^[-*]\s+/gm, '- ')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

export default function QuickEmailModal({ task, onClose }: Props) {
  const initialRecipients = useMemo(
    () => (task.assigned ?? []).map(emailFor).filter((e): e is string => !!e),
    [task.assigned]
  )
  const [to, setTo] = useState<string[]>(initialRecipients)
  const [toInput, setToInput] = useState('')
  const [subject, setSubject] = useState(task.title)
  const [sent, setSent] = useState(false)

  const context = [
    task.notes ? stripMarkdown(task.notes) : null,
    task.due_date ? `Due: ${task.due_date.slice(0, 10)}` : null,
  ].filter(Boolean).join('\n\n')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Add more detail…' }),
    ],
    content: context ? `<p>${context.replace(/\n/g, '<br>')}</p>` : '',
  })

  const unmatchedAssignees = (task.assigned ?? []).filter(n => !emailFor(n))

  const addRecipient = () => {
    const val = toInput.trim()
    if (val && !to.includes(val)) setTo(prev => [...prev, val])
    setToInput('')
  }

  const removeRecipient = (email: string) => setTo(prev => prev.filter(e => e !== email))

  const handleSend = async () => {
    if (toInput.trim()) addRecipient()
    const recipients = toInput.trim() && !to.includes(toInput.trim()) ? [...to, toInput.trim()] : to
    if (recipients.length === 0 || !editor) return

    const bodyText = editor.getText({ blockSeparator: '\n\n' })
    const mailto =
      `mailto:${recipients.map(encodeURIComponent).join(',')}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(bodyText)}`

    await window.api.links.open(mailto)
    setSent(true)
    setTimeout(onClose, 700)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onMouseDown={onClose}
    >
      <div
        className="relative bg-[#242424] border border-[#383838] rounded-xl shadow-2xl flex flex-col"
        style={{ width: 560, maxHeight: '82vh' }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 flex-shrink-0 border-b border-[#2e2e2e]">
          <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">Quick Email</span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="flex-shrink-0 text-[#555555] hover:text-[#f0f0f0] transition-colors text-[18px] leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">

          {/* To */}
          <div className="flex items-start gap-4">
            <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-14 pt-1.5 flex-shrink-0">To</span>
            <div className="flex-1 flex flex-wrap gap-1.5 items-center">
              {to.map(email => (
                <span
                  key={email}
                  className="font-mono text-[10px] tracking-wide px-2 py-0.5 rounded flex items-center gap-1"
                  style={{ backgroundColor: '#4a9eca22', color: '#4a9eca' }}
                >
                  {email}
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => removeRecipient(email)}
                    className="opacity-50 hover:opacity-100 transition-opacity leading-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={toInput}
                onChange={e => setToInput(e.target.value)}
                onKeyDown={e => {
                  e.stopPropagation()
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addRecipient() }
                  if (e.key === 'Backspace' && !toInput && to.length > 0) removeRecipient(to[to.length - 1])
                }}
                onBlur={addRecipient}
                placeholder={to.length === 0 ? 'name@takealot.com' : 'add another…'}
                className="bg-transparent font-mono text-[11px] text-[#d4d4d4] placeholder-[#444444] focus:outline-none"
                style={{ minWidth: 140 }}
              />
            </div>
          </div>

          {unmatchedAssignees.length > 0 && (
            <div className="pl-[72px] -mt-2">
              <span className="font-mono text-[10px] text-[#8a5a2e]">
                No email on file for {unmatchedAssignees.join(', ')} — add them to "To" manually.
              </span>
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] w-14 flex-shrink-0">Subject</span>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-[#f0f0f0] focus:outline-none placeholder-[#444444]"
            />
          </div>

          {/* Body */}
          <div>
            <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a] block mb-2">Message</span>
            <div className="border border-[#333333] rounded-lg overflow-hidden">
              <EditorToolbar editor={editor} />
              <EditorContent
                editor={editor}
                className="note-prose px-3 py-2.5 text-[13px] text-[#e0e0e0] min-h-[160px] max-h-[320px] overflow-y-auto focus:outline-none"
              />
            </div>
            <p className="font-mono text-[9px] text-[#555555] mt-1.5">
              Opens as a new draft in Superhuman — formatting is flattened to plain text.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#2e2e2e] flex-shrink-0">
          <button
            onClick={onClose}
            className="font-mono text-[11px] px-3 py-1.5 rounded text-[#888888] hover:text-[#f0f0f0] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sent || (to.length === 0 && !toInput.trim())}
            className={`font-mono text-[11px] px-3 py-1.5 rounded transition-colors disabled:opacity-30 ${
              sent ? 'bg-[#1e3a22] text-[#4caf82]' : 'bg-[#c45d2e] text-white hover:bg-[#d46b3a]'
            }`}
          >
            {sent ? 'Draft opened ✓' : 'Open Draft'}
          </button>
        </div>
      </div>
    </div>
  )
}
