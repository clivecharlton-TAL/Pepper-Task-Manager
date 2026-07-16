import { useState, useEffect, useRef } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown, type MarkdownStorage } from 'tiptap-markdown'
import type { Note, Meeting } from '../../../../shared/types'
import { useTaskStore } from '../../stores/taskStore'
import { useNoteStore } from '../../stores/noteStore'
import { useRecordingStore } from '../../stores/recordingStore'
import LabelPicker from '../QuickAdd/LabelPicker'
import TaskLinkPicker from './TaskLinkPicker'
import MeetingPicker from './MeetingPicker'
import EditorToolbar from './EditorToolbar'

function getMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as Record<string, unknown>
  return (storage.markdown as MarkdownStorage).getMarkdown()
}

interface Props {
  note: Note
  onClose: () => void
}

export default function NoteEditor({ note, onClose }: Props) {
  const labels = useTaskStore(s => s.labels)
  const allTasks = useTaskStore(s => s.allTasks)
  const updateNote = useNoteStore(s => s.updateNote)
  const archiveNote = useNoteStore(s => s.archiveNote)
  const unarchiveNote = useNoteStore(s => s.unarchiveNote)
  const recordingStatus = useRecordingStore(s => s.status)
  const recordingNoteId = useRecordingStore(s => s.activeNoteId)
  const recordingError = useRecordingStore(s => s.errorMessage)
  const startRecording = useRecordingStore(s => s.start)
  const stopRecording = useRecordingStore(s => s.stop)
  const [title, setTitle] = useState(note.title)
  const [showMeetingPicker, setShowMeetingPicker] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isRecordingThisNote = recordingStatus === 'recording' && recordingNoteId === note.id
  const isTranscribingThisNote = recordingStatus === 'transcribing' && recordingNoteId === note.id
  const isAnalyzingThisNote = recordingStatus === 'analyzing' && recordingNoteId === note.id
  const isRecordingElsewhere = (recordingStatus === 'recording' || recordingStatus === 'transcribing' || recordingStatus === 'analyzing') && recordingNoteId !== note.id

  const handleRecordClick = async () => {
    if (isRecordingThisNote) {
      await stopRecording()
      return
    }
    const permissions = await window.api.recording.permissions()
    if (permissions.microphone === 'denied' || permissions.screen === 'denied') {
      useRecordingStore.setState({
        status: 'error',
        activeNoteId: null,
        errorMessage: 'Microphone or Screen Recording permission is required. Open System Settings → Privacy & Security, enable Pepper Tasks for both, then fully quit and relaunch the app. (You may need to re-grant this after each rebuild.)',
      })
      return
    }
    await startRecording(note.id)
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your notes…' }),
      Markdown.configure({ html: false, transformCopiedText: true }),
    ],
    content: note.body,
    onUpdate: ({ editor }) => {
      scheduleSave({ body: getMarkdown(editor) })
    },
  })

  useEffect(() => {
    setTitle(note.title)
    if (editor && getMarkdown(editor) !== note.body) {
      editor.commands.setContent(note.body)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="flex items-center gap-3">
          {isTranscribingThisNote ? (
            <span className="font-mono text-[10px] text-[#636366] flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full border border-[#636366] border-t-transparent animate-spin" />
              Transcribing…
            </span>
          ) : isAnalyzingThisNote ? (
            <span className="font-mono text-[10px] text-[#636366] flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full border border-[#636366] border-t-transparent animate-spin" />
              Analyzing…
            </span>
          ) : (
            <button
              onClick={handleRecordClick}
              disabled={isRecordingElsewhere}
              title={isRecordingElsewhere ? 'Recording in progress on another note' : undefined}
              className={`font-mono text-[10px] transition-colors ${
                isRecordingThisNote
                  ? 'text-[#c45d2e] animate-pulse'
                  : isRecordingElsewhere
                    ? 'text-[#3a3a3a] cursor-not-allowed'
                    : 'text-[#636366] hover:text-[#c45d2e]'
              }`}
            >
              {isRecordingThisNote ? '■ Stop' : '● Record'}
            </button>
          )}
          <button
            onClick={() => note.archived ? unarchiveNote(note.id) : archiveNote(note.id)}
            className="font-mono text-[10px] text-[#636366] hover:text-[#c45d2e] transition-colors"
          >
            {note.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button
            onClick={onClose}
            className="font-mono text-[14px] text-[#555555] hover:text-[#f0f0f0] transition-colors leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {recordingStatus === 'error' && recordingError && (
        <div className="px-4 pt-3">
          <p className="font-mono text-[10px] text-[#FC2847] leading-relaxed">{recordingError}</p>
        </div>
      )}

      <div className="px-4 pt-4 space-y-3">
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
      </div>

      <EditorToolbar editor={editor} />

      <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
        <EditorContent editor={editor} className="note-prose" />

        {note.transcript && (
          <div className="pt-3 mt-3 border-t border-[#272727]">
            <p className="font-mono text-[10px] tracking-widest uppercase text-[#555555] mb-2">Transcript</p>
            <p className="text-[12px] text-[#999999] leading-relaxed whitespace-pre-wrap">{note.transcript}</p>
          </div>
        )}
      </div>
    </div>
  )
}
