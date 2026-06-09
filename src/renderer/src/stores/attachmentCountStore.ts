import { create } from 'zustand'

interface AttachmentCountStore {
  counts: Record<string, number>
  loadCounts: () => Promise<void>
  incrementCount: (taskId: string) => void
  decrementCount: (taskId: string) => void
}

export const useAttachmentCountStore = create<AttachmentCountStore>((set, get) => ({
  counts: {},

  loadCounts: async () => {
    const counts = await window.api.attachments.counts()
    set({ counts })
  },

  incrementCount: (taskId) => {
    set(s => ({ counts: { ...s.counts, [taskId]: (s.counts[taskId] ?? 0) + 1 } }))
  },

  decrementCount: (taskId) => {
    set(s => {
      const next = Math.max(0, (s.counts[taskId] ?? 1) - 1)
      const counts = { ...s.counts }
      if (next === 0) delete counts[taskId]
      else counts[taskId] = next
      return { counts }
    })
  },
}))
