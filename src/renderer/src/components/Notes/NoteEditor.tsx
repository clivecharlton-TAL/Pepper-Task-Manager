import { useState, useEffect, useRef } from 'react'
import type { Note, Meeting } from '../../../../shared/types'
import { useTaskStore } from '../../stores/taskStore'
import { useNoteStore } from '../../stores/noteStore'
import LabelPicker from '../QuickAdd/LabelPicker'
import TaskLinkPicker from './TaskLinkPicker'
import MeetingPicker from './MeetingPicker'

interface Props {
  note: Note
  onClose: () => void
}

export default function NoteEditor({ note, onClose }: Props) {
  const labels = useTaskStore(s => s.labels)
  const allTasks = useTaskStore(s => s.allTasks)
  const updateNote = useNoteStore(s => s.updateNote)
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [showMeetingPicker, setShowMeetingPicker] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTitle(note.title)
    setBody(note.body)
  }, [note.id])

  const scheduleSave = (patch: Partial<Pick<Note, 'title' | 'body'>>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateNote({ id: note.id, ...patch })
    }, 400)
  }

  const linkMeeting = (meeting: Meeting) => {
    updateNote({
      id: note.id,
      meeting_title: meeting.title,
      meeting_start_time: meeting.start_time,
      meeting_end_time: meeting.end_time,
    })
    setShowMeetingPicker(false)
  }

  const unlinkMeeting = () => {
    updateNote({ id: note.id, meeting_title: null, meeting_start_time: null, meeting_end_time: null })
  }

  return (
    <div className="flex flex-col h-full border-l border-[#272727] w-[420px] flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#272727]">
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#555555]">Note</span>
        <button
          onClick={onClose}
          className="font-mono text-[14px] text-[#555555] hover:text-[#f0f0f0] transition-colors leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); scheduleSave({ title: e.target.value }) }}
          placeholder="Untitled note"
          className="w-full bg-transparent text-[16px] font-medium text-[#f0f0f0] placeholder-[#4a4a4a] focus:outline-none"
        />

        <div className="flex items-center gap-2">
          <LabelPicker
            labels={labels}
            selected={note.labels}
            onChange={sel => updateNote({ id: note.id, labels: sel })}
          />
          <TaskLinkPicker
            tasks={allTasks}
            selectedTaskId={note.task_id}
            onChange={taskId => updateNote({ id: note.id, task_id: taskId })}
          />
        </div>

        {note.meeting_title ? (
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#4a9eca]">
            <span>📅 {note.meeting_title}</span>
            <button onClick={unlinkMeeting} className="text-[#636366] hover:text-[#f2f2f7] transition-colors">
              ×
            </button>
          </div>
        ) : showMeetingPicker ? (
          <MeetingPicker onSelect={linkMeeting} onClose={() => setShowMeetingPicker(false)} />
        ) : (
          <button
            onClick={() => setShowMeetingPicker(true)}
            className="font-mono text-[10px] text-[#636366] hover:text-[#a0a0a0] transition-colors"
          >
            + Link to meeting
          </button>
        )}

        <textarea
          value={body}
          onChange={e => { setBody(e.target.value); scheduleSave({ body: e.target.value }) }}
          placeholder="Write your notes…"
          className="w-full min-h-[240px] bg-transparent text-[13px] text-[#d0d0d0] placeholder-[#4a4a4a] leading-relaxed resize-none focus:outline-none custom-scrollbar"
        />

        {note.transcript && (
          <div className="pt-3 border-t border-[#272727]">
            <p className="font-mono text-[10px] tracking-widest uppercase text-[#555555] mb-2">Transcript</p>
            <p className="text-[12px] text-[#999999] leading-relaxed whitespace-pre-wrap">{note.transcript}</p>
          </div>
        )}
      </div>
    </div>
  )
}
