import { create } from 'zustand'
import type { Note, CreateNoteInput, UpdateNoteInput, NoteFilters, DomainEvent } from '../../../shared/types'

interface NoteStore {
  notes: Note[]
  allNotes: Note[]
  filters: NoteFilters
  activeLabel: string | null
  searchQuery: string
  pendingOpenNoteId: string | null

  init: () => () => void
  loadNotes: () => Promise<void>
  loadAllNotes: () => Promise<void>
  createNote: (input: CreateNoteInput) => Promise<Note>
  updateNote: (input: UpdateNoteInput) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  setActiveLabel: (label: string | null) => void
  setSearchQuery: (q: string) => void
  requestOpenNote: (id: string) => void
  clearPendingOpenNote: () => void
}

function applyEvent(state: Pick<NoteStore, 'notes' | 'allNotes' | 'activeLabel'>, event: DomainEvent) {
  const { notes, allNotes, activeLabel } = state

  if (event.type === 'note:created') {
    const { note } = event
    const alreadyKnown = (arr: Note[]) => arr.some(n => n.id === note.id)
    const inFilter = !activeLabel || note.labels.some(l => l === activeLabel || l.startsWith(activeLabel + '/'))
    return {
      allNotes: alreadyKnown(allNotes) ? allNotes : [note, ...allNotes],
      notes: alreadyKnown(notes) ? notes : inFilter ? [note, ...notes] : notes
    }
  }

  if (event.type === 'note:updated') {
    const { note } = event
    const inFilter = !activeLabel || note.labels.some(l => l === activeLabel || l.startsWith(activeLabel + '/'))
    const updateOrRemove = (arr: Note[]) =>
      arr.some(n => n.id === note.id)
        ? arr.map(n => n.id === note.id ? note : n)
        : inFilter ? [...arr, note] : arr
    return {
      allNotes: allNotes.map(n => n.id === note.id ? note : n),
      notes: inFilter
        ? updateOrRemove(notes)
        : notes.filter(n => n.id !== note.id)
    }
  }

  if (event.type === 'note:deleted') {
    const drop = (arr: Note[]) => arr.filter(n => n.id !== event.id)
    return { allNotes: drop(allNotes), notes: drop(notes) }
  }

  return {}
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  allNotes: [],
  filters: {},
  activeLabel: null,
  searchQuery: '',
  pendingOpenNoteId: null,

  init: () => {
    const unsub = window.api.on('domain-event', (raw: unknown) => {
      const event = raw as DomainEvent
      set(s => applyEvent({ notes: s.notes, allNotes: s.allNotes, activeLabel: s.activeLabel }, event))
    })
    return unsub
  },

  loadNotes: async () => {
    const { filters, activeLabel } = get()
    const f = activeLabel ? { ...filters, label: activeLabel } : filters
    const notes = await window.api.notes.list(f)
    set({ notes })
  },

  loadAllNotes: async () => {
    const allNotes = await window.api.notes.list({})
    set({ allNotes })
  },

  createNote: async (input) => window.api.notes.create(input),

  updateNote: async (input) => {
    set(s => ({
      notes:    s.notes.map(n    => n.id === input.id ? { ...n, ...input } : n),
      allNotes: s.allNotes.map(n => n.id === input.id ? { ...n, ...input } : n),
    }))
    await window.api.notes.update(input)
  },

  deleteNote: async (id) => { await window.api.notes.delete(id) },

  setActiveLabel: (label) => {
    set({ activeLabel: label })
    get().loadNotes()
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  requestOpenNote: (id) => {
    set({ pendingOpenNoteId: id, activeLabel: null })
    get().loadNotes()
  },
  clearPendingOpenNote: () => set({ pendingOpenNoteId: null }),
}))
