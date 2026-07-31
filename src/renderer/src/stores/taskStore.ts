import { create } from 'zustand'
import type { Task, LabelNode, CreateTaskInput, UpdateTaskInput, TaskFilters, TaskStatus, TaskPriority, DomainEvent } from '../../../shared/types'
import type { DueFilter } from '../../../shared/dateFilters'
import { loadPref, savePref } from '../utils/persist'

export type { DueFilter }
export type ListSort  = 'due' | 'priority' | 'created' | 'title'
export type ListGroup = 'none' | 'priority' | 'status' | 'label'

interface TaskStore {
  tasks: Task[]
  allTasks: Task[]
  labels: LabelNode[]
  filters: TaskFilters
  activeLabel: string | null
  activeStatus: TaskStatus | null
  activePriority: TaskPriority | null
  activeDue: DueFilter | null
  assignedToMe: boolean
  /** Task ids semantically related to searchQuery, best first. */
  semanticTaskIds: string[]
  semanticSearching: boolean
  statusCollapsed: boolean
  priorityCollapsed: boolean
  /** Kanban columns collapsed to a narrow strip, for focusing on the rest. */
  collapsedColumns: TaskStatus[]
  searchQuery: string
  viewMode: 'kanban' | 'list' | 'reports' | 'files' | 'calendar' | 'timeline' | 'notes'
  lastTaskViewMode: 'kanban' | 'list' | 'timeline'
  listSort: ListSort
  listGroup: ListGroup
  hiddenStatuses: TaskStatus[]
  hiddenTags: string[]

  init: () => () => void
  loadTasks: () => Promise<void>
  loadAllTasks: () => Promise<void>
  loadLabels: () => Promise<void>
  createTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (input: UpdateTaskInput) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  setFilter: (filters: TaskFilters) => void
  setActiveLabel: (label: string | null) => void
  setActiveStatus: (status: TaskStatus | null) => void
  setActivePriority: (priority: TaskPriority | null) => void
  setActiveDue: (due: DueFilter | null) => void
  setAssignedToMe: (on: boolean) => void
  toggleStatusCollapsed: () => void
  togglePriorityCollapsed: () => void
  toggleColumnCollapsed: (status: TaskStatus) => void
  expandAllColumns: () => void
  setSearchQuery: (q: string) => void
  setViewMode: (mode: 'kanban' | 'list' | 'reports' | 'files' | 'calendar' | 'timeline' | 'notes') => void
  navigateToLabel: (labelId: string) => void
  setListSort: (sort: ListSort) => void
  setListGroup: (group: ListGroup) => void
  toggleHiddenStatus: (status: TaskStatus) => void
  toggleHiddenTag: (tagId: string) => void
}

function applyEvent(state: Pick<TaskStore, 'tasks' | 'allTasks' | 'activeLabel'>, event: DomainEvent) {
  const { tasks, allTasks, activeLabel } = state

  if (event.type === 'task:created') {
    const { task } = event
    const alreadyKnown = (arr: Task[]) => arr.some(t => t.id === task.id)
    const inFilter = !activeLabel || task.labels.some(l => l === activeLabel || l.startsWith(activeLabel + '/'))
    return {
      allTasks: alreadyKnown(allTasks) ? allTasks : [task, ...allTasks],
      tasks: alreadyKnown(tasks) ? tasks : inFilter ? [task, ...tasks] : tasks
    }
  }

  if (event.type === 'task:updated') {
    const { task } = event
    // Match exact label OR any child label (e.g. '30.Arch' matches '30.Arch/00.Chaos')
    const inFilter = !activeLabel || task.labels.some(l => l === activeLabel || l.startsWith(activeLabel + '/'))
    const updateOrRemove = (arr: Task[]) =>
      arr.some(t => t.id === task.id)
        ? arr.map(t => t.id === task.id ? task : t)
        : inFilter ? [...arr, task] : arr
    return {
      allTasks: allTasks.map(t => t.id === task.id ? task : t),
      tasks: inFilter
        ? updateOrRemove(tasks)
        : tasks.filter(t => t.id !== task.id)
    }
  }

  if (event.type === 'task:deleted') {
    const drop = (arr: Task[]) => arr.filter(t => t.id !== event.id)
    return { allTasks: drop(allTasks), tasks: drop(tasks) }
  }

  return {}
}

let semanticTimer: ReturnType<typeof setTimeout> | null = null

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  allTasks: [],
  labels: [],
  filters: {},
  activeLabel: null,
  activeStatus: null,
  activePriority: null,
  activeDue: null,
  assignedToMe: false,
  semanticTaskIds: [],
  semanticSearching: false,
  // Status/Priority panels default to collapsed; the last state is remembered.
  statusCollapsed: loadPref('sidebar.statusCollapsed', true),
  priorityCollapsed: loadPref('sidebar.priorityCollapsed', true),
  collapsedColumns: loadPref<TaskStatus[]>('kanban.collapsedColumns', []),
  searchQuery: '',
  viewMode: 'kanban',
  lastTaskViewMode: 'kanban',
  listSort: 'due',
  listGroup: 'none',
  hiddenStatuses: ['done'],
  hiddenTags: [],

  init: () => {
    const unsubTasks = window.api.on('domain-event', (raw: unknown) => {
      const event = raw as DomainEvent
      if (event.type === 'labels:changed') {
        get().loadLabels()
        return
      }
      set(s => applyEvent({ tasks: s.tasks, allTasks: s.allTasks, activeLabel: s.activeLabel }, event))
    })
    return unsubTasks
  },

  loadTasks: async () => {
    const { filters, activeLabel } = get()
    const f = activeLabel ? { ...filters, label: activeLabel } : filters
    const tasks = await window.api.tasks.list(f)
    set({ tasks })
  },

  loadAllTasks: async () => {
    const allTasks = await window.api.tasks.list({})
    set({ allTasks })
  },

  loadLabels: async () => {
    const labels = await window.api.labels.tree()
    set({ labels })
  },

  createTask: async (input) => window.api.tasks.create(input),

  updateTask: async (input) => {
    // Optimistic: move card immediately so the UI doesn't wait for the IPC round-trip
    set(s => ({
      tasks:    s.tasks.map(t    => t.id === input.id ? { ...t, ...input } : t),
      allTasks: s.allTasks.map(t => t.id === input.id ? { ...t, ...input } : t),
    }))
    await window.api.tasks.update(input)
    // Domain event from the server confirms and corrects if needed
  },

  deleteTask: async (id) => { await window.api.tasks.delete(id) },

  setFilter: (filters) => {
    set({ filters })
    get().loadTasks()
  },

  setActiveLabel: (label) => {
    set({ activeLabel: label })
    get().loadTasks()
  },

  setActiveStatus: (status) => set({ activeStatus: status }),

  setActivePriority: (priority) => set({ activePriority: priority }),

  setActiveDue: (due) => set({ activeDue: due }),

  setAssignedToMe: (on) => set({ assignedToMe: on }),

  toggleStatusCollapsed: () => set(s => {
    const statusCollapsed = !s.statusCollapsed
    savePref('sidebar.statusCollapsed', statusCollapsed)
    return { statusCollapsed }
  }),

  togglePriorityCollapsed: () => set(s => {
    const priorityCollapsed = !s.priorityCollapsed
    savePref('sidebar.priorityCollapsed', priorityCollapsed)
    return { priorityCollapsed }
  }),

  toggleColumnCollapsed: (status) => set(s => {
    const collapsedColumns = s.collapsedColumns.includes(status)
      ? s.collapsedColumns.filter(c => c !== status)
      : [...s.collapsedColumns, status]
    savePref('kanban.collapsedColumns', collapsedColumns)
    return { collapsedColumns }
  }),

  expandAllColumns: () => set(() => {
    savePref('kanban.collapsedColumns', [])
    return { collapsedColumns: [] }
  }),

  setSearchQuery: (q) => {
    set({ searchQuery: q })

    // Keyword filtering stays synchronous and instant; the semantic pass is
    // debounced so typing does not queue an embedding per keystroke.
    if (semanticTimer !== null) clearTimeout(semanticTimer)

    const query = q.trim()
    if (query.length < 3) {
      set({ semanticTaskIds: [], semanticSearching: false })
      return
    }

    set({ semanticSearching: true })
    semanticTimer = setTimeout(async () => {
      try {
        const hits = await window.api.search.semantic(query)
        // Ignore results for a query the user has already moved on from.
        if (get().searchQuery.trim() !== query) return
        set({
          semanticTaskIds: hits.filter(h => h.kind === 'task').map(h => h.id),
          semanticSearching: false,
        })
      } catch (e) {
        console.error('Semantic search failed:', e)
        set({ semanticTaskIds: [], semanticSearching: false })
      }
    }, 250)
  },
  setViewMode: (mode) => set(s => ({
    viewMode: mode,
    lastTaskViewMode: (mode === 'kanban' || mode === 'list' || mode === 'timeline') ? mode : s.lastTaskViewMode,
  })),
  navigateToLabel: (labelId) => {
    const { lastTaskViewMode } = get()
    set({ activeLabel: labelId, viewMode: lastTaskViewMode })
    get().loadTasks()
  },
  setListSort: (sort) => set({ listSort: sort }),
  setListGroup: (group) => set({ listGroup: group }),
  toggleHiddenStatus: (status) => set(s => ({
    hiddenStatuses: s.hiddenStatuses.includes(status)
      ? s.hiddenStatuses.filter(x => x !== status)
      : [...s.hiddenStatuses, status]
  })),
  toggleHiddenTag: (tagId) => set(s => ({
    hiddenTags: s.hiddenTags.includes(tagId)
      ? s.hiddenTags.filter(x => x !== tagId)
      : [...s.hiddenTags, tagId]
  })),
}))
