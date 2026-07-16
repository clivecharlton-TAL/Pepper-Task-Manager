import { app, systemPreferences } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { RecordingPermissionStatus } from '../shared/types'

export interface RecordingHandle {
  noteId: string
  wavPath: string
}

let activeChild: ChildProcess | null = null
let activeHandle: RecordingHandle | null = null

function recordingsDir(): string {
  const dir = join(app.getPath('userData'), 'recordings')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function helperPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'native', 'pepper-audio-capture')
    : join(app.getAppPath(), 'native', 'pepper-audio-capture', 'pepper-audio-capture')
}

export function checkPermissions(): RecordingPermissionStatus {
  const toStatus = (v: string): 'granted' | 'denied' | 'not-determined' =>
    v === 'granted' ? 'granted' : v === 'not-determined' ? 'not-determined' : 'denied'
  return {
    microphone: toStatus(systemPreferences.getMediaAccessStatus('microphone')),
    screen: toStatus(systemPreferences.getMediaAccessStatus('screen')),
  }
}

export function getActiveRecording(): RecordingHandle | null {
  return activeHandle
}

export async function startRecording(noteId: string): Promise<RecordingHandle> {
  if (activeChild) throw new Error('A recording is already in progress')

  if (!existsSync(helperPath())) {
    throw new Error(`Recording helper not found at ${helperPath()}`)
  }

  const wavPath = join(recordingsDir(), `${noteId}-${Date.now()}.wav`)
  const handle: RecordingHandle = { noteId, wavPath }

  const child = spawn(helperPath(), ['start', '--output', wavPath])
  activeChild = child
  activeHandle = handle

  return new Promise((resolve, reject) => {
    let settled = false
    let stderrBuf = ''

    child.stdout.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        let msg: { status?: string; message?: string } = {}
        try { msg = JSON.parse(trimmed) } catch { continue }
        if (msg.status === 'recording' && !settled) {
          settled = true
          resolve(handle)
        } else if (msg.status === 'error' && !settled) {
          settled = true
          activeChild = null
          activeHandle = null
          reject(new Error(msg.message ?? 'Recording helper reported an error'))
        }
      }
    })

    child.stderr.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString('utf8') })

    child.on('error', (err) => {
      activeChild = null
      activeHandle = null
      if (!settled) { settled = true; reject(err) }
    })

    child.on('close', (code, signal) => {
      if (activeChild === child) { activeChild = null; activeHandle = null }
      if (!settled) {
        settled = true
        reject(new Error(`Recording helper exited early (code ${code}, signal ${signal}): ${stderrBuf.trim()}`))
      }
    })
  })
}

export async function stopRecording(): Promise<{ wavPath: string; noteId: string }> {
  const child = activeChild
  const handle = activeHandle
  if (!child || !handle) throw new Error('No recording in progress')

  await new Promise<void>((resolve) => {
    const killTimer = setTimeout(() => { child.kill('SIGKILL') }, 5000)
    child.once('close', () => { clearTimeout(killTimer); resolve() })
    child.kill('SIGTERM')
  })

  activeChild = null
  activeHandle = null
  return { wavPath: handle.wavPath, noteId: handle.noteId }
}
