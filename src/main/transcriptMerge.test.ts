import { describe, it, expect } from 'vitest'
import { mergeTranscriptWithSpeakers } from './transcriptMerge'
import type { WhisperSegment } from './transcription'
import type { DiarizationSegment } from './diarization'

describe('mergeTranscriptWithSpeakers', () => {
  it('falls back to plain join when diarization is empty', () => {
    const whisper: WhisperSegment[] = [
      { from: 0, to: 1000, text: 'Hello there.' },
      { from: 1000, to: 2000, text: 'How are you?' },
    ]
    expect(mergeTranscriptWithSpeakers(whisper, [])).toBe('Hello there. How are you?')
  })

  it('returns empty string for empty transcript', () => {
    expect(mergeTranscriptWithSpeakers([], [])).toBe('')
  })

  it('falls back to plain join when only one speaker is detected', () => {
    const whisper: WhisperSegment[] = [
      { from: 0, to: 1000, text: 'Hello there.' },
      { from: 1000, to: 2000, text: 'How are you?' },
    ]
    const diar: DiarizationSegment[] = [
      { startMs: 0, endMs: 1000, speaker: 'Speaker 1' },
      { startMs: 1000, endMs: 2000, speaker: 'Speaker 1' },
    ]
    expect(mergeTranscriptWithSpeakers(whisper, diar)).toBe('Hello there. How are you?')
  })

  it('labels and paragraphs by speaker change using max-overlap assignment', () => {
    const whisper: WhisperSegment[] = [
      { from: 0, to: 1000, text: 'Good morning everyone.' },
      { from: 1000, to: 2000, text: "Let's start." },
      { from: 3000, to: 4000, text: 'Sure, here are the numbers.' },
    ]
    const diar: DiarizationSegment[] = [
      { startMs: 0, endMs: 2000, speaker: 'Speaker 1' },
      { startMs: 3000, endMs: 4000, speaker: 'Speaker 2' },
    ]
    expect(mergeTranscriptWithSpeakers(whisper, diar)).toBe(
      "Speaker 1:\nGood morning everyone. Let's start.\n\nSpeaker 2:\nSure, here are the numbers."
    )
  })

  it('assigns the greatest-overlap speaker when a segment straddles a boundary', () => {
    const whisper: WhisperSegment[] = [
      { from: 0, to: 1000, text: 'A.' },
      // straddles the 1500ms boundary but overlaps Speaker 2 more (1500-2500 = 1000ms vs 500ms)
      { from: 1000, to: 2500, text: 'B.' },
    ]
    const diar: DiarizationSegment[] = [
      { startMs: 0, endMs: 1500, speaker: 'Speaker 1' },
      { startMs: 1500, endMs: 3000, speaker: 'Speaker 2' },
    ]
    expect(mergeTranscriptWithSpeakers(whisper, diar)).toBe('Speaker 1:\nA.\n\nSpeaker 2:\nB.')
  })

  it('inherits the previous speaker when a segment has no diarization overlap', () => {
    const whisper: WhisperSegment[] = [
      { from: 0, to: 1000, text: 'A.' },
      { from: 5000, to: 6000, text: 'gap segment' },
      { from: 8000, to: 9000, text: 'B.' },
    ]
    const diar: DiarizationSegment[] = [
      { startMs: 0, endMs: 1000, speaker: 'Speaker 1' },
      { startMs: 8000, endMs: 9000, speaker: 'Speaker 2' },
    ]
    expect(mergeTranscriptWithSpeakers(whisper, diar)).toBe(
      'Speaker 1:\nA. gap segment\n\nSpeaker 2:\nB.'
    )
  })
})
