import { contextBridge, ipcRenderer } from 'electron'
import type { CreateTaskInput, UpdateTaskInput, TaskFilters, Task, LabelNode, ReportData, FileEntry, TaskAttachmentWithStatus, SubTask } from '../shared/types'

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
  files: {
    list:   (relativePath: string): Promise<FileEntry[] | null>    => ipcRenderer.invoke('files:list', relativePath),
    open:   (relativePath: string): Promise<string>                => ipcRenderer.invoke('files:open', relativePath),
    reveal: (relativePath: string): Promise<void>                  => ipcRenderer.invoke('files:reveal', relativePath),
    mkdir:  (relativePath: string): Promise<{ created: boolean }>  => ipcRenderer.invoke('files:mkdir', relativePath),
  },
  ai: {
    hasKey:  (): Promise<boolean>  => ipcRenderer.invoke('ai:has-key'),
    saveKey: (key: string): Promise<void> => ipcRenderer.invoke('ai:save-key', key),
    draft:   (title: string): Promise<void> => ipcRenderer.invoke('ai:draft', title),
    onChunk: (fn: (chunk: string) => void): () => void => {
      const wrapped = (_e: Electron.IpcRendererEvent, chunk: string) => fn(chunk)
      ipcRenderer.on('ai:chunk', wrapped)
      return () => ipcRenderer.removeListener('ai:chunk', wrapped)
    },
  },
  window: {
    hideQuickAdd: () => ipcRenderer.send('quick-add:hide'),
    showMain: () => ipcRenderer.send('main-window:show'),
    getContext: (): Promise<unknown> => ipcRenderer.invoke('quick-add:context'),
  },
  on: (channel: string, fn: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_e, ...args) => fn(...args))
    return () => ipcRenderer.removeListener(channel, fn)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type AppApi = typeof api
