import { ipcMain, shell } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { getTasks, createTask, updateTask, deleteTask, getTask, getLabelTree, syncLabelsFromDrive, getReportData, createLabel, listAttachments, addAttachment, removeAttachment, countAttachments, listSubTasks, createSubTask, updateSubTask, deleteSubTask, countSubTasks, listLinks, addLink, removeLink } from './db'
import { listFiles, openFile, revealFile, createFolder } from './files'
import { hasApiKey, saveApiKey, streamDraft, streamQuery } from './ai'
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

  ipcMain.handle('labels:create', async (_e, id: string, name: string, parentId: string | null) => {
    await createLabel(id, name, parentId)
    broadcast({ type: 'labels:changed', added: 1 })
  })

  ipcMain.handle('labels:sync-drive', async () => {
    const drivePath = join(homedir(), 'Library/CloudStorage/GoogleDrive/My Drive')
    const result = await syncLabelsFromDrive(drivePath)
    if (result.added > 0) broadcast({ type: 'labels:changed', added: result.added })
    return result
  })

  ipcMain.handle('reports:get', (_e, rangeDays: number) => getReportData(rangeDays))

  ipcMain.handle('ai:has-key', () => hasApiKey())
  ipcMain.handle('ai:save-key', (_e, key: string) => { saveApiKey(key) })
  ipcMain.handle('ai:draft', async (event, title: string) => {
    await streamDraft(title, (chunk) => {
      if (!event.sender.isDestroyed()) event.sender.send('ai:chunk', chunk)
    })
  })

  ipcMain.handle('ai:query', async (event, messages: { role: 'user' | 'assistant'; content: string }[]) => {
    const tasks = await getTasks()
    const tasksJson = JSON.stringify(tasks)
    await streamQuery(messages, tasksJson, (chunk) => {
      if (!event.sender.isDestroyed()) event.sender.send('ai:query-chunk', chunk)
    })
  })

  ipcMain.handle('subtasks:list',   (_e, taskId: string) => listSubTasks(taskId))
  ipcMain.handle('subtasks:create', (_e, taskId: string, title: string) => createSubTask(taskId, title))
  ipcMain.handle('subtasks:update', (_e, id: string, patch: Parameters<typeof updateSubTask>[1]) => updateSubTask(id, patch))
  ipcMain.handle('subtasks:delete', (_e, id: string) => deleteSubTask(id))
  ipcMain.handle('subtasks:counts', () => countSubTasks())

  ipcMain.handle('attachments:list',   (_e, taskId: string) => listAttachments(taskId))
  ipcMain.handle('attachments:add',    (_e, taskId: string, filePath: string) => addAttachment(taskId, filePath))
  ipcMain.handle('attachments:remove', (_e, id: string) => removeAttachment(id))
  ipcMain.handle('attachments:counts', () => countAttachments())
  ipcMain.handle('attachments:open',   (_e, filePath: string) => shell.openPath(filePath))
  ipcMain.handle('attachments:reveal', (_e, filePath: string) => { shell.showItemInFolder(filePath); return null })

  ipcMain.handle('links:list',   (_e, taskId: string) => listLinks(taskId))
  ipcMain.handle('links:add',    (_e, taskId: string, url: string, name: string) => addLink(taskId, url, name))
  ipcMain.handle('links:remove', (_e, id: string) => removeLink(id))
  ipcMain.handle('links:open',   (_e, url: string) => shell.openExternal(url))

  ipcMain.handle('files:list', (_e, relativePath: string) => listFiles(relativePath))
  ipcMain.handle('files:open', (_e, relativePath: string) => openFile(relativePath))
  ipcMain.handle('files:reveal', (_e, relativePath: string) => { revealFile(relativePath); return null })
  ipcMain.handle('files:mkdir', async (_e, relativePath: string) => {
    const result = createFolder(relativePath)
    if (result.created) {
      const parts = relativePath.split('/')
      const name = parts[parts.length - 1]
      const parentId = parts.length > 1 ? parts.slice(0, -1).join('/') : null
      await createLabel(relativePath, name, parentId)
      broadcast({ type: 'labels:changed', added: 1 })
    }
    return result
  })
}
