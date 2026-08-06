import { create } from 'zustand'
import type { DomainEvent, OpsSignal } from '../../../shared/types'
import { bandFor } from '../utils/opsHelpers'

export type OpsFilterMode = 'all' | 'directs' | 'attention'

interface OpsStore {
  signals: OpsSignal[]
  filterMode: OpsFilterMode
  filterPerson: string | null
  refreshing: boolean
  hasCredentials: boolean

  init: () => () => void
  loadSignals: () => Promise<void>
  refresh: () => Promise<void>
  trackSignal: (signal: OpsSignal) => Promise<void>
  setFilterMode: (mode: OpsFilterMode) => void
  setFilterPerson: (name: string | null) => void
}

export const useOpsStore = create<OpsStore>((set, get) => ({
  signals: [],
  filterMode: 'all',
  filterPerson: null,
  refreshing: false,
  hasCredentials: false,

  init: () => {
    // The poller broadcasts a bare signal; re-fetch rather than reconciling
    // in place, matching the labels:changed → loadLabels() pattern.
    const unsub = window.api.on('domain-event', (raw: unknown) => {
      const event = raw as DomainEvent
      if (event.type === 'ops:updated') get().loadSignals()
    })
    return unsub
  },

  loadSignals: async () => {
    const [signals, hasCredentials] = await Promise.all([
      window.api.ops.list(),
      window.api.ops.hasCredentials(),
    ])
    set({ signals, hasCredentials })
  },

  refresh: async () => {
    set({ refreshing: true })
    try {
      await window.api.ops.refresh()
      await get().loadSignals()
    } finally {
      set({ refreshing: false })
    }
  },

  trackSignal: async (signal) => {
    const { signal: updated } = await window.api.ops.track({
      key: signal.key, title: signal.title, url: signal.url,
    })
    if (updated) {
      set(s => ({ signals: s.signals.map(x => x.key === updated.key ? updated : x) }))
    }
  },

  setFilterMode: (filterMode) => set({ filterMode }),
  setFilterPerson: (filterPerson) => set({ filterPerson }),
}))

/** Count of live signals needing attention — drives the sidebar indicator. */
export function attentionCount(signals: OpsSignal[]): number {
  return signals.filter(s => bandFor(s) === 'attention').length
}
