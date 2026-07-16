import { app } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'

const execFileAsync = promisify(execFile)

function whisperCliPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'native', 'whisper-cli')
    : join(app.getAppPath(), 'resources', 'native', 'whisper-cli')
}

function modelPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'models', 'ggml-base.en.bin')
    : join(app.getAppPath(), 'resources', 'models', 'ggml-base.en.bin')
}

export interface WhisperSegment {
  from: number
  to: number
  text: string
}

interface WhisperJsonOutput {
  transcription: { offsets: { from: number; to: number }; text: string }[]
}

export async function transcribeAudio(wavPath: string): Promise<WhisperSegment[]> {
  const cli = whisperCliPath()
  const model = modelPath()
  if (!existsSync(cli)) throw new Error(`whisper-cli not found at ${cli}`)
  if (!existsSync(model)) throw new Error(`Whisper model not found at ${model}`)

  const outputBase = wavPath.replace(/\.wav$/i, '')
  const jsonPath = `${outputBase}.json`

  try {
    await execFileAsync(cli, ['-m', model, '-f', wavPath, '-oj', '-of', outputBase], {
      timeout: 20 * 60 * 1000,
    })
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string }
    if (err.killed || err.signal === 'SIGTERM') {
      throw new Error('Transcription timed out')
    }
    throw new Error(`Transcription failed: ${err.message}`)
  }

  if (!existsSync(jsonPath)) throw new Error('Transcription did not produce output')

  const raw = readFileSync(jsonPath, 'utf8')
  try { unlinkSync(jsonPath) } catch { /* best-effort cleanup */ }

  const parsed = JSON.parse(raw) as WhisperJsonOutput
  return parsed.transcription.map(seg => ({
    from: seg.offsets.from,
    to: seg.offsets.to,
    text: seg.text.trim(),
  }))
}
