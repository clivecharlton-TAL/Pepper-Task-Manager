import { format, parseISO } from 'date-fns'
import type { Note } from '../../../../shared/types'

function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim()
}

interface Props {
  note: Note
  onOpenInNotes: () => void
  onClose: () => void
}

export default function NotePreviewFlyout({ note, onOpenInNotes, onClose }: Props) {
  return (
    <div
      className="absolute top-0 left-full ml-3 bg-[#242424] border border-[#383838] rounded-xl shadow-2xl flex flex-col"
      style={{ width: 340, maxHeight: '82vh' }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e2e2e] flex-shrink-0">
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#555555]">Note</span>
        <button
          onClick={onClose}
          className="font-mono text-[14px] text-[#555555] hover:text-[#f0f0f0] transition-colors leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
        <h3 className="text-[14px] font-medium text-[#f0f0f0]">{note.title || 'Untitled note'}</h3>

        {note.meeting_title && (
          <div className="font-mono text-[10px] text-[#4a9eca]">📅 {note.meeting_title}</div>
        )}

        {note.body && (
          <p className="text-[12px] text-[#b0b0b0] leading-relaxed whitespace-pre-wrap">
            {stripMarkdown(note.body)}
          </p>
        )}

        {note.transcript && (
          <div className="pt-2 border-t border-[#2e2e2e]">
            <p className="font-mono text-[9px] tracking-widest uppercase text-[#555555] mb-1.5">Transcript</p>
            <p className="text-[11px] text-[#999999] leading-relaxed whitespace-pre-wrap">{note.transcript}</p>
          </div>
        )}

        {!note.body && !note.transcript && (
          <p className="text-[12px] text-[#444444] italic">Empty note</p>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-[#2e2e2e] flex-shrink-0">
        <span className="font-mono text-[9px] text-[#3a3a3a]">
          {format(parseISO(note.created_at), 'MMM d, yyyy')}
        </span>
        <button
          onClick={onOpenInNotes}
          className="font-mono text-[10px] text-[#c45d2e] hover:text-[#d4692e] transition-colors"
        >
          Open in Notes →
        </button>
      </div>
    </div>
  )
}
