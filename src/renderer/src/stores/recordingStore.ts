import { create } from 'zustand'
import type { DomainEvent } from '../../../shared/types'

type RecordingStatus = 'idle' | 'recording' | 'transcribing' | 'analyzing' | 'done' | 'error'

interface RecordingStore {
  status: RecordingStatus
  activeNoteId: string | null
  errorMessage: string | null

  init: () => () => void
  start: (noteId: string) => Promise<void>
  stop: () => Promise<void>
}

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  status: 'idle',
  activeNoteId: null,
  errorMessage: null,

  init: () => {
    const unsub = window.api.on('domain-event', (raw: unknown) => {
      const event = raw as DomainEvent
      if (event.type === 'recording:started') {
        set({ status: 'recording', activeNoteId: event.noteId, errorMessage: null })
      } else if (event.type === 'recording:transcribing') {
        set({ status: 'transcribing', activeNoteId: event.noteId })
      } else if (event.type === 'recording:analyzing') {
        set({ status: 'analyzing', activeNoteId: event.noteId })
      } else if (event.type === 'recording:done') {
        set({ status: 'done', activeNoteId: null })
      } else if (event.type === 'recording:error') {
        set({ status: 'error', activeNoteId: null, errorMessage: event.message })
      }
    })
    return unsub
  },

  start: async (noteId) => {
    if (get().status === 'recording' || get().status === 'transcribing') return
    set({ status: 'recording', activeNoteId: noteId, errorMessage: null })
    try {
      await window.api.recording.start(noteId)
    } catch (error) {
      set({ status: 'error', activeNoteId: null, errorMessage: (error as Error).message })
    }
  },

  stop: async () => {
    try {
      await window.api.recording.stop()
    } catch (error) {
      set({ status: 'error', activeNoteId: null, errorMessage: (error as Error).message })
    }
  },
}))
