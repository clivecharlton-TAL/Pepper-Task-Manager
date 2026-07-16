import { app } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'

const execFileAsync = promisify(execFile)

export interface DiarizationSegment {
  startMs: number
  endMs: number
  speaker: string
}

function diarizationCliPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'native', 'sherpa-onnx-offline-speaker-diarization')
    : join(app.getAppPath(), 'resources', 'native', 'sherpa-onnx-offline-speaker-diarization')
}

function segmentationModelPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'models', 'sherpa-pyannote-segmentation-3.0.onnx')
    : join(app.getAppPath(), 'resources', 'models', 'sherpa-pyannote-segmentation-3.0.onnx')
}

function embeddingModelPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'models', '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx')
    : join(app.getAppPath(), 'resources', 'models', '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx')
}

const SEGMENT_LINE = /^([\d.]+)\s+--\s+([\d.]+)\s+speaker_(\d+)/

export async function diarizeAudio(wavPath: string): Promise<DiarizationSegment[]> {
  const cli = diarizationCliPath()
  const segModel = segmentationModelPath()
  const embModel = embeddingModelPath()
  if (!existsSync(cli)) throw new Error(`Diarization CLI not found at ${cli}`)
  if (!existsSync(segModel)) throw new Error(`Segmentation model not found at ${segModel}`)
  if (!existsSync(embModel)) throw new Error(`Embedding model not found at ${embModel}`)

  let stdout: string
  try {
    ;({ stdout } = await execFileAsync(cli, [
      '--clustering.cluster-threshold=0.5',
      `--segmentation.pyannote-model=${segModel}`,
      `--embedding.model=${embModel}`,
      wavPath,
    ], { timeout: 20 * 60 * 1000 }))
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string }
    if (err.killed || err.signal === 'SIGTERM') {
      throw new Error('Diarization timed out')
    }
    throw new Error(`Diarization failed: ${err.message}`)
  }

  const speakerIds = new Map<string, number>()
  const segments: DiarizationSegment[] = []

  for (const line of stdout.split('\n')) {
    const match = SEGMENT_LINE.exec(line.trim())
    if (!match) continue
    const [, fromSec, toSec, speakerId] = match
    if (!speakerIds.has(speakerId)) speakerIds.set(speakerId, speakerIds.size + 1)
    segments.push({
      startMs: Math.round(parseFloat(fromSec) * 1000),
      endMs: Math.round(parseFloat(toSec) * 1000),
      speaker: `Speaker ${speakerIds.get(speakerId)}`,
    })
  }

  if (segments.length === 0) throw new Error('Diarization produced no segments')

  segments.sort((a, b) => a.startMs - b.startMs)
  return segments
}
