import { useState, useEffect, useMemo } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import { useNoteStore } from '../../stores/noteStore'
import type { Note } from '../../../../shared/types'
import { flattenLabels } from '../../utils/listHelpers'
import NoteCard from './NoteCard'
import NoteEditor from './NoteEditor'

export default function NotesView() {
  const labels = useTaskStore(s => s.labels)
  const allTasks = useTaskStore(s => s.allTasks)
  const { notes, allNotes, searchQuery, loadNotes, createNote, deleteNote, pendingOpenNoteId, clearPendingOpenNote } = useNoteStore()
  const [selected, setSelected] = useState<Note | null>(null)

  useEffect(() => { loadNotes() }, [])

  const isBlank = (n: Note) =>
    !n.title && !n.body && n.labels.length === 0 && !n.task_id && !n.meeting_title && !n.transcript

  // Discards the currently open note if it was never touched, then opens the next one.
  // Used for both list-item clicks and cross-navigation, so a blank note left behind
  // doesn't linger as junk no matter how the editor pane changes what it shows.
  const selectNote = (next: Note | null) => {
    setSelected(prev => {
      if (prev && prev.id !== next?.id) {
        const fresh = allNotes.find(n => n.id === prev.id) ?? prev
        if (isBlank(fresh)) deleteNote(fresh.id)
      }
      return next
    })
  }

  // A note requested from elsewhere (e.g. the task detail modal) takes priority
  // over whatever's currently selected — resolve it from allNotes, or fetch it
  // directly if it hasn't loaded into the store yet.
  useEffect(() => {
    if (!pendingOpenNoteId) return
    const local = allNotes.find(n => n.id === pendingOpenNoteId)
    if (local) {
      selectNote(local)
      clearPendingOpenNote()
      return
    }
    window.api.notes.get(pendingOpenNoteId).then(fetched => {
      if (fetched) selectNote(fetched)
      clearPendingOpenNote()
    })
  }, [pendingOpenNoteId, allNotes, clearPendingOpenNote])

  const flatLabels = useMemo(() => flattenLabels(labels), [labels])

  const filtered = useMemo(() => {
    if (!searchQuery) return notes
    const q = searchQuery.toLowerCase()
    return notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.body.toLowerCase().includes(q) ||
      n.transcript?.toLowerCase().includes(q)
    )
  }, [notes, searchQuery])

  const handleCreate = async () => {
    const note = await createNote({ title: '', body: '' })
    await loadNotes()
    selectNote(note)
  }

  // Keep the open editor pane in sync with the underlying note as it updates/deletes.
  // Check allNotes (unfiltered) so a note opened via cross-navigation isn't
  // dropped just because it's outside the currently active label filter.
  useEffect(() => {
    if (!selected) return
    const fresh = allNotes.find(n => n.id === selected.id)
    if (!fresh) { setSelected(null); return }
    if (fresh !== selected) setSelected(fresh)
  }, [allNotes, selected])

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-4">
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded font-mono text-[11px] text-[#888888] bg-[#242424] hover:bg-[#2a2a2a] hover:text-[#f0f0f0] transition-colors"
          >
            + New note
          </button>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="font-mono text-[9px] tracking-[0.35em] uppercase mb-3 text-[#4a4a4a]">
                {searchQuery ? 'no results' : 'no notes yet'}
              </p>
              <p className="text-[15px] font-light text-[#888888]">
                {searchQuery ? 'Try adjusting your search.' : 'Capture your first note.'}
              </p>
            </div>
          ) : (
            filtered.map((note, i) => (
              <NoteCard
                key={note.id}
                note={note}
                flatLabels={flatLabels}
                allTasks={allTasks}
                onOpen={selectNote}
                isLast={i === filtered.length - 1}
              />
            ))
          )}
        </div>
      </div>

      {selected && (
        <NoteEditor note={selected} onClose={() => selectNote(null)} />
      )}
    </div>
  )
}
