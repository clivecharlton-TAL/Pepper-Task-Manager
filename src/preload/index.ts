import { contextBridge, ipcRenderer } from 'electron'
import type { OrgPerson, OrgPatch, OrgChange, SlidesCheck, OrgSyncReport } from '../shared/org'
import type { CreateTaskInput, UpdateTaskInput, TaskFilters, Task, LabelNode, ReportData, FileEntry, TaskAttachmentWithStatus, SubTask, TaskLink, Note, CreateNoteInput, UpdateNoteInput, NoteFilters, RecordingPermissionStatus, SemanticHit, OpsSignal } from '../shared/types'

const api = {
  tasks: {
    list: (filters?: TaskFilters): Promise<Task[]> => ipcRenderer.invoke('tasks:list', filters),
    get: (id: string): Promise<Task | null> => ipcRenderer.invoke('tasks:get', id),
    create: (input: CreateTaskInput): Promise<Task> => ipcRenderer.invoke('tasks:create', input),
    update: (input: UpdateTaskInput): Promise<Task | null> => ipcRenderer.invoke('tasks:update', input),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('tasks:delete', id)
  },
  labels: {
    tree: (): Promise<LabelNode[]> => ipcRenderer.invoke('labels:tree'),
    syncDrive: (): Promise<{ added: number }> => ipcRenderer.invoke('labels:sync-drive'),
    create: (id: string, name: string, parentId: string | null): Promise<void> => ipcRenderer.invoke('labels:create', id, name, parentId),
  },
  reports: {
    get: (rangeDays: number): Promise<ReportData> => ipcRenderer.invoke('reports:get', rangeDays)
  },
  subtasks: {
    list:   (taskId: string): Promise<SubTask[]>                                              => ipcRenderer.invoke('subtasks:list', taskId),
    create: (taskId: string, title: string): Promise<SubTask>                                 => ipcRenderer.invoke('subtasks:create', taskId, title),
    update: (id: string, patch: Partial<Pick<SubTask, 'title' | 'notes' | 'done' | 'assigned' | 'due_date' | 'sort_order'>>): Promise<SubTask | null> => ipcRenderer.invoke('subtasks:update', id, patch),
    delete: (id: string): Promise<void>                                                       => ipcRenderer.invoke('subtasks:delete', id),
    counts: (): Promise<Record<string, { done: number; total: number }>>                      => ipcRenderer.invoke('subtasks:counts'),
  },
  attachments: {
    list:   (taskId: string): Promise<TaskAttachmentWithStatus[]>                              => ipcRenderer.invoke('attachments:list', taskId),
    add:    (taskId: string, filePath: string): Promise<TaskAttachmentWithStatus | { error: string }> => ipcRenderer.invoke('attachments:add', taskId, filePath),
    remove: (id: string): Promise<void>                                                        => ipcRenderer.invoke('attachments:remove', id),
    counts: (): Promise<Record<string, number>>                                                => ipcRenderer.invoke('attachments:counts'),
    open:   (filePath: string): Promise<string>                                               => ipcRenderer.invoke('attachments:open', filePath),
    reveal: (filePath: string): Promise<void>                                                 => ipcRenderer.invoke('attachments:reveal', filePath),
  },
  links: {
    list:   (taskId: string): Promise<TaskLink[]>                              => ipcRenderer.invoke('links:list', taskId),
    add:    (taskId: string, url: string, name: string): Promise<TaskLink | { error: string }> => ipcRenderer.invoke('links:add', taskId, url, name),
    remove: (id: string): Promise<void>                                       => ipcRenderer.invoke('links:remove', id),
    open:   (url: string): Promise<void>                                      => ipcRenderer.invoke('links:open', url),
  },
  files: {
    list:   (relativePath: string): Promise<FileEntry[] | null>    => ipcRenderer.invoke('files:list', relativePath),
    open:   (relativePath: string): Promise<string>                => ipcRenderer.invoke('files:open', relativePath),
    reveal: (relativePath: string): Promise<void>                  => ipcRenderer.invoke('files:reveal', relativePath),
    mkdir:  (relativePath: string): Promise<{ created: boolean }>  => ipcRenderer.invoke('files:mkdir', relativePath),
  },
  ai: {
    hasKey:  (): Promise<boolean>  => ipcRenderer.invoke('ai:has-key'),
    saveKey: (key: string): Promise<void> => ipcRenderer.invoke('ai:save-key', key),
    draft:   (title: string, attachmentPaths: string[], links: { name: string; url: string }[]): Promise<void> =>
      ipcRenderer.invoke('ai:draft', title, attachmentPaths, links),
    onChunk: (fn: (chunk: string) => void): () => void => {
      const wrapped = (_e: Electron.IpcRendererEvent, chunk: string) => fn(chunk)
      ipcRenderer.on('ai:chunk', wrapped)
      return () => ipcRenderer.removeListener('ai:chunk', wrapped)
    },
    onDraftContext: (fn: (ctx: { read: {name: string; sizeKb: number}[]; skipped: {name: string; reason: string}[]; links: string[] }) => void): () => void => {
      const wrapped = (_e: Electron.IpcRendererEvent, ctx: Parameters<typeof fn>[0]) => fn(ctx)
      ipcRenderer.on('ai:draft-context', wrapped)
      return () => ipcRenderer.removeListener('ai:draft-context', wrapped)
    },
    query: (messages: { role: 'user' | 'assistant'; content: string }[]): Promise<void> =>
      ipcRenderer.invoke('ai:query', messages),
    onQueryChunk: (fn: (chunk: string) => void): () => void => {
      const wrapped = (_e: Electron.IpcRendererEvent, chunk: string) => fn(chunk)
      ipcRenderer.on('ai:query-chunk', wrapped)
      return () => ipcRenderer.removeListener('ai:query-chunk', wrapped)
    },
    onQueryAction: (fn: (action: string) => void): () => void => {
      const wrapped = (_e: Electron.IpcRendererEvent, action: string) => fn(action)
      ipcRenderer.on('ai:query-action', wrapped)
      return () => ipcRenderer.removeListener('ai:query-action', wrapped)
    },
    briefing: (meetingDetails: string): Promise<void> =>
      ipcRenderer.invoke('ai:briefing', meetingDetails),
    onBriefingChunk: (fn: (chunk: string) => void): () => void => {
      const wrapped = (_e: Electron.IpcRendererEvent, chunk: string) => fn(chunk)
      ipcRenderer.on('ai:briefing-chunk', wrapped)
      return () => ipcRenderer.removeListener('ai:briefing-chunk', wrapped)
    },
  },
  calendar: {
    getIcsUrl: (): Promise<string | undefined> => ipcRenderer.invoke('calendar:get-ics'),
    setIcsUrl: (url: string): Promise<void> => ipcRenderer.invoke('calendar:set-ics', url),
  },
  meetings: {
    getUpcoming: (dateString?: string): Promise<any> => ipcRenderer.invoke('meetings:upcoming', dateString),
  },
  search: {
    semantic: (query: string): Promise<SemanticHit[]> => ipcRenderer.invoke('search:semantic', query),
    reindex:  (): Promise<{ indexed: number; reused: number }> => ipcRenderer.invoke('search:reindex'),
  },
  notes: {
    list:   (filters?: NoteFilters): Promise<Note[]>       => ipcRenderer.invoke('notes:list', filters),
    get:    (id: string): Promise<Note | null>             => ipcRenderer.invoke('notes:get', id),
    create: (input: CreateNoteInput): Promise<Note>        => ipcRenderer.invoke('notes:create', input),
    update: (input: UpdateNoteInput): Promise<Note | null> => ipcRenderer.invoke('notes:update', input),
    delete: (id: string): Promise<boolean>                 => ipcRenderer.invoke('notes:delete', id),
  },
  recording: {
    permissions: (): Promise<RecordingPermissionStatus> => ipcRenderer.invoke('recording:permissions'),
    start: (noteId: string): Promise<{ noteId: string; wavPath: string }> => ipcRenderer.invoke('recording:start', noteId),
    stop: (): Promise<{ noteId: string; wavPath: string; transcript: string }> => ipcRenderer.invoke('recording:stop'),
  },
  wallpapers: {
    list: (): Promise<string[]> => ipcRenderer.invoke('wallpapers:list'),
  },
  ops: {
    list:    (): Promise<OpsSignal[]> => ipcRenderer.invoke('ops:list'),
    refresh: (): Promise<number>      => ipcRenderer.invoke('ops:refresh'),
    open:    (url: string): Promise<void> => ipcRenderer.invoke('ops:open', url),
    track:   (signal: { key: string; title: string; url: string }): Promise<{ task: Task; signal: OpsSignal | null }> =>
      ipcRenderer.invoke('ops:track', signal),
    // Boolean only — the API token never crosses into the renderer.
    hasCredentials:  (): Promise<boolean> => ipcRenderer.invoke('ops:has-credentials'),
    saveCredentials: (input: { jiraEmail: string; jiraApiToken: string; jiraSiteUrl: string; opsJql?: string }): Promise<void> =>
      ipcRenderer.invoke('ops:save-credentials', input),
  },
  org: {
    list:        (): Promise<OrgPerson[]> => ipcRenderer.invoke('org:list'),
    changes:     (): Promise<OrgChange[]> => ipcRenderer.invoke('org:changes'),
    add:         (input: Omit<OrgPerson, 'id' | 'sort_order' | 'perf_folder'>): Promise<{ person?: OrgPerson; report?: OrgSyncReport; error?: string }> =>
      ipcRenderer.invoke('org:add', input),
    update:      (id: string, patch: OrgPatch): Promise<{ person?: OrgPerson | null; report?: OrgSyncReport; error?: string }> =>
      ipcRenderer.invoke('org:update', id, patch),
    remove:      (id: string): Promise<{ report?: OrgSyncReport; error?: string }> => ipcRenderer.invoke('org:remove', id),
    resync:      (): Promise<OrgSyncReport> => ipcRenderer.invoke('org:resync'),
    checkSlides: (): Promise<SlidesCheck | { error: string }> => ipcRenderer.invoke('org:check-slides'),
    openSlides:  (): Promise<void> => ipcRenderer.invoke('org:open-slides'),
  },
  window: {
    hideQuickAdd: () => ipcRenderer.send('quick-add:hide'),
    showMain: () => ipcRenderer.send('main-window:show'),
    getContext: (): Promise<unknown> => ipcRenderer.invoke('quick-add:context'),
    getPendingOpenTaskId: (): Promise<string | null> => ipcRenderer.invoke('open-task:pending'),
  },
  on: (channel: string, fn: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_e, ...args) => fn(...args))
    return () => ipcRenderer.removeListener(channel, fn)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type AppApi = typeof api
