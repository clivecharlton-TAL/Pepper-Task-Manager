import { create } from 'zustand'
import type { DomainEvent } from '../../../shared/types'
import type { OrgPerson, OrgChange } from '../../../shared/org'
import { setTeamFromOrg } from '../../../shared/team'

interface OrgStore {
  people: OrgPerson[]
  changes: OrgChange[]
  loaded: boolean
  init: () => () => void
  load: () => Promise<void>
}

export const useOrgStore = create<OrgStore>((set, get) => ({
  people: [],
  changes: [],
  loaded: false,

  // Both windows (main + Quick Add) keep the @mention roster in step with the
  // org chart, so this runs regardless of which window is showing.
  init: () => {
    get().load()
    return window.api.on('domain-event', (raw: unknown) => {
      if ((raw as DomainEvent).type === 'org:changed') get().load()
    })
  },

  load: async () => {
    const [people, changes] = await Promise.all([window.api.org.list(), window.api.org.changes()])
    setTeamFromOrg(people)
    set({ people, changes, loaded: true })
  },
}))
