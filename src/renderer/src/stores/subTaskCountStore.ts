import { create } from 'zustand'

interface SubTaskCount { done: number; total: number }

interface SubTaskCountStore {
  counts: Record<string, SubTaskCount>
  loadCounts: () => Promise<void>
  setCount: (taskId: string, count: SubTaskCount) => void
}

export const useSubTaskCountStore = create<SubTaskCountStore>((set) => ({
  counts: {},

  loadCounts: async () => {
    const counts = await window.api.subtasks.counts()
    set({ counts })
  },

  setCount: (taskId, count) => {
    set(s => {
      const counts = { ...s.counts }
      if (count.total === 0) delete counts[taskId]
      else counts[taskId] = count
      return { counts }
    })
  },
}))
