import { ipcMain } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { getTasks, createTask, updateTask, deleteTask, getTask, getLabelTree, syncLabelsFromDrive, getReportData } from './db'
import { broadcast } from './events'
import type { CreateTaskInput, UpdateTaskInput, TaskFilters } from '../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('tasks:list', (_e, filters: TaskFilters) => getTasks(filters))
  ipcMain.handle('tasks:get', (_e, id: string) => getTask(id))

  ipcMain.handle('tasks:create', async (_e, input: CreateTaskInput) => {
    const task = await createTask(input)
    broadcast({ type: 'task:created', task })
    return task
  })

  ipcMain.handle('tasks:update', async (_e, input: UpdateTaskInput) => {
    const task = await updateTask(input)
    if (task) broadcast({ type: 'task:updated', task })
    return task
  })

  ipcMain.handle('tasks:delete', async (_e, id: string) => {
    const ok = await deleteTask(id)
    if (ok) broadcast({ type: 'task:deleted', id })
    return ok
  })

  ipcMain.handle('labels:tree', () => getLabelTree())

  ipcMain.handle('labels:sync-drive', async () => {
    const drivePath = join(homedir(), 'Library/CloudStorage/GoogleDrive/My Drive')
    const result = await syncLabelsFromDrive(drivePath)
    if (result.added > 0) broadcast({ type: 'labels:changed', added: result.added })
    return result
  })

  ipcMain.handle('reports:get', (_e, rangeDays: number) => getReportData(rangeDays))
}
