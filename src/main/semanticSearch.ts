import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { env, pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'
import { getTasks, getNotes } from './db'
import type { SemanticHit } from '../shared/types'

export type { SemanticHit }

// Bundled model only — never reach out to HuggingFace at runtime. Search must
// work offline, and task text must not leave the machine.
env.allowRemoteModels = false
env.allowLocalModels = true
env.localModelPath = app.isPackaged
  ? join(process.resourcesPath, 'models')
  : join(app.getAppPath(), 'resources', 'models')

const MODEL = 'all-MiniLM-L6-v2'
const CACHE_PATH = join(app.getPath('userData'), 'search-index.json')

/**
 * Cosine-similarity floor for a semantic hit to count as relevant.
 *
 * Calibrated against real data: genuine matches score 0.33-0.46, while
 * deliberately irrelevant queries peak around 0.18. Without a floor the
 * ranking always returns something, because every item has *some* similarity.
 */
const RELEVANCE_FLOOR = 0.30
const MAX_RESULTS = 20

interface CacheEntry {
  hash: string
  vector: number[]
}

type IndexCache = Record<string, CacheEntry>

let extractor: FeatureExtractionPipeline | null = null
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null
let index: IndexCache = {}
let indexLoaded = false
let indexing: Promise<void> | null = null

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', `Xenova/${MODEL}`, {
      quantized: true,
    }) as Promise<FeatureExtractionPipeline>
  }
  extractor = await extractorPromise
  return extractor
}

async function embed(text: string): Promise<number[]> {
  const model = await getExtractor()
  // Mean pooling + L2 normalisation means cosine similarity reduces to a dot
  // product, which keeps scoring cheap over the whole index.
  const output = await model(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}

function dot(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

function hashOf(text: string): string {
  return createHash('sha1').update(text).digest('hex')
}

function loadIndex(): void {
  if (indexLoaded) return
  indexLoaded = true
  if (!existsSync(CACHE_PATH)) return
  try {
    const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'))
    if (raw && typeof raw === 'object' && raw.model === MODEL) {
      index = raw.entries ?? {}
    }
    // A different model produces incompatible vectors — start clean.
  } catch {
    index = {}
  }
}

function saveIndex(): void {
  try {
    mkdirSync(join(app.getPath('userData')), { recursive: true })
    writeFileSync(CACHE_PATH, JSON.stringify({ model: MODEL, entries: index }))
  } catch (e) {
    console.error('Failed to persist search index:', e)
  }
}

/** Text used to represent an item in the index. */
function taskText(t: { title: string; notes: string | null }): string {
  return [t.title, t.notes ?? ''].filter(Boolean).join('\n')
}

function noteText(n: { title: string; body: string; transcript: string | null }): string {
  // Transcripts are the highest-value content for "we discussed this
  // somewhere" queries, so they are indexed alongside the note body.
  return [n.title, n.body, n.transcript ?? ''].filter(Boolean).join('\n')
}

/**
 * Embed anything new or changed. Existing vectors are reused via a content
 * hash, so a rebuild after editing one task costs one embedding, not 443.
 */
export async function buildIndex(): Promise<{ indexed: number; reused: number }> {
  if (indexing) {
    await indexing
    return { indexed: 0, reused: 0 }
  }

  let indexed = 0
  let reused = 0

  indexing = (async () => {
    loadIndex()

    const [tasks, notes] = await Promise.all([getTasks({}), getNotes({})])

    const items: { key: string; text: string }[] = [
      ...tasks.map(t => ({ key: `task:${t.id}`, text: taskText(t) })),
      ...notes.map(n => ({ key: `note:${n.id}`, text: noteText(n) })),
    ]

    const seen = new Set<string>()

    for (const item of items) {
      seen.add(item.key)
      const text = item.text.trim()
      if (!text) continue

      const hash = hashOf(text)
      if (index[item.key]?.hash === hash) {
        reused++
        continue
      }

      try {
        index[item.key] = { hash, vector: await embed(text) }
        indexed++
      } catch (e) {
        console.error(`Failed to embed ${item.key}:`, e)
      }
    }

    // Drop vectors for deleted items so the index cannot return ghosts.
    for (const key of Object.keys(index)) {
      if (!seen.has(key)) delete index[key]
    }

    if (indexed > 0) saveIndex()
  })()

  try {
    await indexing
  } finally {
    indexing = null
  }

  return { indexed, reused }
}

/**
 * Rank indexed items against a query. Returns only hits above the relevance
 * floor — an empty array is a valid, meaningful answer.
 */
export async function semanticSearch(query: string): Promise<SemanticHit[]> {
  const q = query.trim()
  if (q.length < 3) return []

  loadIndex()
  if (Object.keys(index).length === 0) await buildIndex()

  const queryVector = await embed(q)

  const hits: SemanticHit[] = []
  for (const [key, entry] of Object.entries(index)) {
    const score = dot(queryVector, entry.vector)
    if (score < RELEVANCE_FLOOR) continue
    const [kind, ...rest] = key.split(':')
    hits.push({ id: rest.join(':'), kind: kind as 'task' | 'note', score })
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS)
}

/** Warm the model and index in the background so the first search is fast. */
export function warmSemanticSearch(): void {
  buildIndex()
    .then(({ indexed, reused }) => {
      if (indexed > 0) console.log(`Search index: embedded ${indexed}, reused ${reused}`)
    })
    .catch(e => console.error('Search index build failed:', e))
}
