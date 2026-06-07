import { existsSync, readdirSync, statSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { shell } from 'electron'
import type { FileEntry } from '../shared/types'

const DRIVE_ROOT = join(homedir(), 'Library/CloudStorage/GoogleDrive/My Drive')

export function listFiles(relativePath: string): FileEntry[] | null {
  const absPath = relativePath ? join(DRIVE_ROOT, relativePath) : DRIVE_ROOT
  if (!existsSync(absPath)) return null

  let dirEntries: ReturnType<typeof readdirSync>
  try {
    dirEntries = readdirSync(absPath, { withFileTypes: true })
  } catch {
    return null
  }

  const result: FileEntry[] = []
  for (const entry of dirEntries) {
    if (entry.name.startsWith('.')) continue

    let size: number | null = null
    let modifiedAt: string | null = null
    try {
      const stat = statSync(join(absPath, entry.name))
      if (!entry.isDirectory()) size = stat.size
      modifiedAt = stat.mtime.toISOString()
    } catch {
      // placeholder or inaccessible — leave size/modifiedAt as null
    }

    result.push({
      name: entry.name,
      relativePath: relativePath ? `${relativePath}/${entry.name}` : entry.name,
      isDirectory: entry.isDirectory(),
      size,
      modifiedAt,
    })
  }

  const numPrefix = (name: string) => { const m = name.match(/^(\d+)/); return m ? parseInt(m[1], 10) : Infinity }
  return result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    const diff = numPrefix(a.name) - numPrefix(b.name)
    return diff !== 0 ? diff : a.name.localeCompare(b.name)
  })
}

export async function openFile(relativePath: string): Promise<string> {
  return shell.openPath(join(DRIVE_ROOT, relativePath))
}

export function revealFile(relativePath: string): void {
  shell.showItemInFolder(join(DRIVE_ROOT, relativePath))
}

export function createFolder(relativePath: string): { created: boolean } {
  const absPath = join(DRIVE_ROOT, relativePath)
  if (existsSync(absPath)) return { created: false }
  try {
    mkdirSync(absPath)
    return { created: true }
  } catch {
    return { created: false }
  }
}
