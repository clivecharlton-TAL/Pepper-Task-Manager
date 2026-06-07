import { existsSync, readdirSync, statSync } from 'fs'
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

  return result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function openFile(relativePath: string): Promise<string> {
  return shell.openPath(join(DRIVE_ROOT, relativePath))
}

export function revealFile(relativePath: string): void {
  shell.showItemInFolder(join(DRIVE_ROOT, relativePath))
}
