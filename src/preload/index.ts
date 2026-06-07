import { contextBridge, ipcRenderer } from 'electron'
import type { CreateTaskInput, UpdateTaskInput, TaskFilters, Task, LabelNode, ReportData, FileEntry } from '../shared/types'

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
    syncDrive: (): Promise<{ added: number }> => ipcRenderer.invoke('labels:sync-drive')
  },
  reports: {
    get: (rangeDays: number): Promise<ReportData> => ipcRenderer.invoke('reports:get', rangeDays)
  },
  files: {
    list:   (relativePath: string): Promise<FileEntry[] | null>    => ipcRenderer.invoke('files:list', relativePath),
    open:   (relativePath: string): Promise<string>                => ipcRenderer.invoke('files:open', relativePath),
    reveal: (relativePath: string): Promise<void>                  => ipcRenderer.invoke('files:reveal', relativePath),
    mkdir:  (relativePath: string): Promise<{ created: boolean }>  => ipcRenderer.invoke('files:mkdir', relativePath),
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
