import { ipcMain, shell } from 'electron'
import { join, extname } from 'path'
import { homedir } from 'os'
import { readFileSync, statSync, existsSync, readdirSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
import Anthropic from '@anthropic-ai/sdk'
import { getTasks, createTask, updateTask, deleteTask, getTask, getLabelTree, syncLabelsFromDrive, getReportData, createLabel, listAttachments, addAttachment, removeAttachment, countAttachments, listSubTasks, createSubTask, updateSubTask, deleteSubTask, countSubTasks, listLinks, addLink, removeLink } from './db'
import { listFiles, openFile, revealFile, createFolder } from './files'
import { hasApiKey, saveApiKey, getCalendarIcsUrl, saveCalendarIcsUrl, streamDraft, streamQuery, streamBriefing } from './ai'
import { broadcast } from './events'
import { fetchUpcomingMeetings } from './meetings'
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
  ipcMain.handle('calendar:get-ics', () => getCalendarIcsUrl())
  ipcMain.handle('calendar:set-ics', (_e, url: string) => saveCalendarIcsUrl(url))
  ipcMain.handle('ai:draft', async (
    event,
    title: string,
    attachmentPaths: string[],
    linkRefs: { name: string; url: string }[]
  ) => {
    const TEXT_EXTS = new Set(['.txt','.md','.markdown','.csv','.json','.js','.ts','.jsx','.tsx','.py','.html','.css','.xml','.yaml','.yml','.sh','.log','.conf','.toml','.ini','.sql'])
    const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
    const PDF_EXTS = new Set(['.pdf'])
    const GOOGLE_EXTS = new Set(['.gdoc', '.gsheet', '.gslides'])
    const MAX_BYTES = 30_000

    const read: { name: string; sizeKb: number }[] = []
    const skipped: { name: string; reason: string }[] = []
    const contentBlocksForAI: Anthropic.MessageParam['content'] = []
    const googleUrlsToFetch: { name: string; url: string }[] = []

    for (const p of attachmentPaths ?? []) {
      const name = p.split('/').pop() ?? p
      try {
        if (!existsSync(p)) {
          skipped.push({ name, reason: 'file not found' })
          continue
        }

        const ext = extname(p).toLowerCase()
        const stats = statSync(p)
        const sizeKb = Math.round(stats.size / 102.4) / 10

        if (GOOGLE_EXTS.has(ext)) {
          const raw = readFileSync(p, 'utf-8')
          try {
            const parsed = JSON.parse(raw)
            if (parsed.url) {
              googleUrlsToFetch.push({ name, url: parsed.url })
              read.push({ name, sizeKb }) // Mark as read since we will fetch it
            } else {
              skipped.push({ name, reason: 'invalid google shortcut file' })
            }
          } catch {
            skipped.push({ name, reason: 'invalid google shortcut file (not JSON)' })
          }
        } else if (TEXT_EXTS.has(ext)) {
          const raw = readFileSync(p, 'utf-8')
          const content = stats.size > MAX_BYTES ? raw.slice(0, MAX_BYTES) + '\n…[truncated]' : raw
          contentBlocksForAI.push({ type: 'text', text: `### ${name}\n${content}` })
          read.push({ name, sizeKb })
        } else if (IMAGE_EXTS.has(ext)) {
          const buffer = readFileSync(p)
          let media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
          if (ext === '.png') media_type = 'image/png'
          else if (ext === '.gif') media_type = 'image/gif'
          else if (ext === '.webp') media_type = 'image/webp'

          contentBlocksForAI.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type,
              data: buffer.toString('base64'),
            },
          })
          read.push({ name, sizeKb })
        } else if (PDF_EXTS.has(ext)) {
          const buffer = readFileSync(p)
          contentBlocksForAI.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: buffer.toString('base64'),
            },
            // Claude uses 'document' blocks for PDF parsing (supported in claude-3-5-sonnet-20241022)
          } as any)
          read.push({ name, sizeKb })
        } else {
          skipped.push({ name, reason: 'format not supported' })
        }
      } catch (error) {
        skipped.push({ name, reason: `read error: ${(error as Error).message}` })
      }
    }

    // Check linkRefs for Google Workspace URLs
    for (const link of linkRefs ?? []) {
      if (link.url.includes('docs.google.com') || link.url.includes('sheets.google.com') || link.url.includes('slides.google.com')) {
        if (!googleUrlsToFetch.some(g => g.url === link.url)) {
          googleUrlsToFetch.push({ name: link.name, url: link.url })
        }
      }
    }

    if (!event.sender.isDestroyed()) {
      event.sender.send('ai:draft-context', {
        read,
        skipped,
        links: (linkRefs ?? []).map(l => l.name),
      })
    }

    if (googleUrlsToFetch.length > 0) {
      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:chunk', `_Fetching ${googleUrlsToFetch.length} Google Workspace document(s) via Claude CLI..._\n\n`)
      }

      await Promise.all(googleUrlsToFetch.map(async (doc) => {
        try {
          if (!event.sender.isDestroyed()) {
            event.sender.send('ai:chunk', `_Reading ${doc.name}..._\n`)
          }

          const { stdout } = await execAsync(`claude -p "Read the content of this Google Workspace document and output ONLY the raw text, nothing else. Do not use any markdown formatting or pleasantries, just output the exact text content: ${doc.url}" --bare`, {
            env: { ...process.env, PATH: '/usr/local/bin:/opt/homebrew/bin:' + (process.env.PATH || '') }
          })

          contentBlocksForAI.push({ type: 'text', text: `### Google Document: ${doc.name}\nURL: ${doc.url}\n\n${stdout.trim()}` })
        } catch (error) {
          console.error(`Failed to fetch Google Workspace doc ${doc.url}:`, error)
          if (!event.sender.isDestroyed()) {
            event.sender.send('ai:chunk', `_Failed to read ${doc.name}._\n`)
          }
        }
      }))

      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:chunk', `\n`)
      }
    }

    await streamDraft(title, contentBlocksForAI, linkRefs ?? [], (chunk) => {
      if (!event.sender.isDestroyed()) event.sender.send('ai:chunk', chunk)
    })
  })

  ipcMain.handle('ai:query', async (event, messages: { role: 'user' | 'assistant'; content: string }[]) => {
    const tasks = await getTasks()
    const tasksJson = JSON.stringify(tasks)

    const send = (channel: string, payload: unknown) => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, payload)
    }

    await streamQuery(
      messages,
      tasksJson,
      (chunk)   => send('ai:query-chunk', chunk),
      (action)  => send('ai:query-action', action),
      async (toolName, input) => {
        switch (toolName) {
          case 'create_task': {
            const task = await createTask(input as CreateTaskInput)
            broadcast({ type: 'task:created', task })
            return { success: true, task }
          }
          case 'update_task': {
            const { id, ...patch } = input as { id: string } & Partial<UpdateTaskInput>
            const task = await updateTask({ id, ...patch })
            if (task) broadcast({ type: 'task:updated', task })
            return { success: !!task, task }
          }
          case 'delete_task': {
            const ok = await deleteTask(input.id as string)
            if (ok) broadcast({ type: 'task:deleted', id: input.id as string })
            return { success: ok }
          }
          case 'create_subtask': {
            const subtask = await createSubTask(input.parent_task_id as string, input.title as string)
            return { success: true, subtask }
          }
          default:
            return { error: `Unknown tool: ${toolName}` }
        }
      }
    )
  })

  ipcMain.handle('ai:briefing', async (event, meetingDetails: string) => {
    // Need to get all labels to inject into tasksJson so AI knows the label colors
    const labels = await getLabelTree()
    // Flatten labels for easy color lookup by name
    const labelMap: Record<string, string> = {}
    const flatten = (nodes: any[]) => {
      nodes.forEach(n => {
        labelMap[n.name] = n.colour
        if (n.children) flatten(n.children)
      })
    }
    flatten(labels)

    const tasks = await getTasks()
    const activeTasks = tasks.filter(t => t.status !== 'done').map(t => ({
      ...t,
      // Pass both label ID and resolved name+colour so the AI can format it properly
      labels_resolved: t.labels.map(id => {
        // Find label recursively
        let foundName = id
        let foundColour = '#888888'
        const search = (nodes: any[]) => {
          for (const n of nodes) {
            if (n.id === id || n.name === id) {
              foundName = n.name
              foundColour = n.colour
              return true
            }
            if (n.children && search(n.children)) return true
          }
          return false
        }
        search(labels)
        return { name: foundName, colour: foundColour }
      })
    }))

    const tasksJson = JSON.stringify(activeTasks)

    await streamBriefing(meetingDetails, tasksJson, (chunk) => {
      if (!event.sender.isDestroyed()) event.sender.send('ai:briefing-chunk', chunk)
    })
  })

  ipcMain.handle('meetings:upcoming', async (_e, dateString?: string) => {
    try {
      const meetings = await fetchUpcomingMeetings(dateString)
      return meetings
    } catch (error) {
      console.error('Error fetching meetings:', error)
      return null
    }
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

  ipcMain.handle('wallpapers:list', () => {
    const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
    const dir = join(homedir(), 'Wallpapers')
    if (!existsSync(dir)) return []
    try {
      return readdirSync(dir)
        .filter(f => IMAGE_EXTS.has(extname(f).toLowerCase()))
        .map(f => `file://${join(dir, f)}`)
    } catch {
      return []
    }
  })
}
