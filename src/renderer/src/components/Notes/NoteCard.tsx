import { format, parseISO } from 'date-fns'
import type { Note, LabelNode, Task } from '../../../../shared/types'
import { useNoteStore } from '../../stores/noteStore'

function stripMarkdown(text: string): string {
  return text
    .split('\n')[0]
    .replace(/^#+\s+/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim()
}

interface Props {
  note: Note
  flatLabels: LabelNode[]
  allTasks: Task[]
  onOpen: (note: Note) => void
  isLast: boolean
}

export default function NoteCard({ note, flatLabels, allTasks, onOpen, isLast }: Props) {
  const deleteNote = useNoteStore(s => s.deleteNote)
  const preview = note.body ? stripMarkdown(note.body) : note.transcript ? stripMarkdown(note.transcript) : null
  const labelMeta = note.labels
    .map(id => flatLabels.find(l => l.id === id))
    .filter((l): l is LabelNode => !!l)
  const linkedTask = note.task_id ? allTasks.find(t => t.id === note.task_id) : null

  return (
    <div className="group">
      <div
        className="flex items-start gap-3 py-3 px-3 -mx-3 cursor-pointer rounded-lg transition-colors hover:bg-[#242424]"
        onClick={() => onOpen(note)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-sans leading-snug mb-1 text-[#f0f0f0] truncate">
            {note.title || 'Untitled note'}
          </p>

          {preview && (
            <p className="text-[11px] text-[#666666] leading-relaxed mb-1.5 truncate">
              {preview}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[10px] text-[#6b7280]">
              {format(parseISO(note.created_at), 'MMM d')}
            </span>

            {note.meeting_title && (
              <span className="font-mono text-[10px] text-[#4a9eca]">📅 {note.meeting_title}</span>
            )}

            {note.task_id && (
              <span className="font-mono text-[10px] text-[#4a9eca] truncate max-w-[160px]">
                ↳ {linkedTask?.title ?? 'linked task'}
              </span>
            )}

            {note.recording_path && (
              <span className="font-mono text-[10px] text-[#c45d2e]">● recording</span>
            )}

            {labelMeta.slice(0, 3).map(l => (
              <span key={l.id} className="font-mono text-[10px] flex items-center gap-1 min-w-0">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="flex-shrink-0" style={{ color: l.colour }}>
                  <path d="M1 1h4l4 4-4 4-4-4V1z" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                  <circle cx="3" cy="3" r="0.8"/>
                </svg>
                <span className="truncate max-w-[110px]" style={{ color: l.colour }}>{l.id}</span>
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={e => { e.stopPropagation(); deleteNote(note.id) }}
          className="flex-shrink-0 font-mono text-[14px] text-[#333333] hover:text-[#FC2847] transition-colors opacity-0 group-hover:opacity-100 leading-none mt-0.5"
        >
          ×
        </button>
      </div>

      {!isLast && <div className="h-px bg-[#272727] mx-0" />}
    </div>
  )
}
