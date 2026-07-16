import type { WhisperSegment } from './transcription'
import type { DiarizationSegment } from './diarization'

function overlapMs(seg: WhisperSegment, diar: DiarizationSegment): number {
  return Math.max(0, Math.min(seg.to, diar.endMs) - Math.max(seg.from, diar.startMs))
}

function plainJoin(segments: WhisperSegment[]): string {
  return segments.map(s => s.text).join(' ').trim()
}

export function mergeTranscriptWithSpeakers(
  whisperSegments: WhisperSegment[],
  diarizationSegments: DiarizationSegment[]
): string {
  if (whisperSegments.length === 0) return ''
  if (diarizationSegments.length === 0) return plainJoin(whisperSegments)

  const labeled: { speaker: string; text: string }[] = []
  let lastSpeaker: string | null = null

  for (const seg of whisperSegments) {
    let best: DiarizationSegment | null = null
    let bestOverlap = 0
    for (const diar of diarizationSegments) {
      const overlap = overlapMs(seg, diar)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        best = diar
      }
    }
    const speaker: string = best?.speaker ?? lastSpeaker ?? 'Speaker 1'
    lastSpeaker = speaker
    labeled.push({ speaker, text: seg.text })
  }

  const allSameSpeaker = labeled.every(l => l.speaker === labeled[0].speaker)
  if (allSameSpeaker) return plainJoin(whisperSegments)

  const paragraphs: { speaker: string; texts: string[] }[] = []
  for (const { speaker, text } of labeled) {
    const current = paragraphs[paragraphs.length - 1]
    if (current && current.speaker === speaker) {
      current.texts.push(text)
    } else {
      paragraphs.push({ speaker, texts: [text] })
    }
  }

  return paragraphs
    .map(p => `${p.speaker}:\n${p.texts.join(' ').trim()}`)
    .join('\n\n')
}
