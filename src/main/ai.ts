import Anthropic from '@anthropic-ai/sdk'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const CONFIG_PATH = join(app.getPath('userData'), 'config.json')

function readConfig(): Record<string, string> {
  if (!existsSync(CONFIG_PATH)) return {}
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) } catch { return {} }
}

export function hasApiKey(): boolean {
  return !!(readConfig().anthropicApiKey)
}

export function saveApiKey(key: string): void {
  const cfg = readConfig()
  cfg.anthropicApiKey = key.trim()
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2))
}

const DRAFT_PROMPT = (title: string) => `You are a Chief-of-Staff assistant. Generate a detailed, structured task description in markdown for the following task. Be concise but specific and actionable.

Task: "${title}"

Write the description with this structure:

## Overview
A clear 1–2 sentence explanation of what this task involves and why it matters.

## Objectives
- Key goals and expected deliverables

## Approach
- Recommended steps or methodology to complete this task

## Definition of Done
- Clear, measurable success criteria

Use clean markdown: headers (##), bullet points, and **bold** for emphasis where needed. Do not repeat the task title as a heading. Tailor the language to a senior engineering leadership context.`

const QUERY_SYSTEM_PROMPT = (tasksJson: string) =>
  `You are an AI assistant embedded in Pepper, a task management app. Answer questions about the user's tasks concisely and helpfully. Format responses in markdown where appropriate.

Current task data (JSON):
${tasksJson}`

export async function streamQuery(
  messages: { role: 'user' | 'assistant'; content: string }[],
  tasksJson: string,
  onChunk: (text: string) => void
): Promise<void> {
  const apiKey = readConfig().anthropicApiKey
  if (!apiKey) throw new Error('NO_API_KEY')

  const client = new Anthropic({ apiKey })
  const stream = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    stream: true,
    system: QUERY_SYSTEM_PROMPT(tasksJson),
    messages,
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      onChunk(event.delta.text)
    }
  }
}

export async function streamDraft(title: string, onChunk: (text: string) => void): Promise<void> {
  const apiKey = readConfig().anthropicApiKey
  if (!apiKey) throw new Error('NO_API_KEY')

  const client = new Anthropic({ apiKey })
  const stream = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    stream: true,
    messages: [{ role: 'user', content: DRAFT_PROMPT(title) }]
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      onChunk(event.delta.text)
    }
  }
}
