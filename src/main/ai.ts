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

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TASK_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_task',
    description: 'Create a new task in Pepper. Returns the created task object.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:    { type: 'string', description: 'Task title' },
        status:   { type: 'string', enum: ['backlog', 'todo', 'in_progress', 'done'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        notes:    { type: 'string' },
        due_date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        labels:   { type: 'array', items: { type: 'string' }, description: 'Label IDs to attach' },
        assigned: { type: 'array', items: { type: 'string' }, description: 'Assignee names' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update one or more fields on an existing task. Only include fields that should change.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:       { type: 'string', description: 'Task ID from the task list' },
        title:    { type: 'string' },
        status:   { type: 'string', enum: ['backlog', 'todo', 'in_progress', 'done'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        notes:    { type: 'string' },
        due_date: { type: 'string', description: 'ISO date YYYY-MM-DD, or empty string to clear' },
        labels:   { type: 'array', items: { type: 'string' } },
        assigned: { type: 'array', items: { type: 'string' } },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Permanently delete a task by ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Task ID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_subtask',
    description: 'Create a sub-task (checklist item) under an existing parent task. Use this — NOT create_task — when the user asks to add sub-tasks, steps, or checklist items to a specific task.',
    input_schema: {
      type: 'object' as const,
      properties: {
        parent_task_id: { type: 'string', description: 'ID of the parent task' },
        title:          { type: 'string', description: 'Sub-task title' },
      },
      required: ['parent_task_id', 'title'],
    },
  },
]

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const DRAFT_PROMPT = (
  title: string,
  attachments: { name: string; content: string }[],
  links: { name: string; url: string }[]
) => {
  const docSection = attachments.length > 0
    ? `\n\n## Attached Documents\nUse these as primary context for the description:\n\n` +
      attachments.map(a => `### ${a.name}\n${a.content}`).join('\n\n')
    : ''

  const linkSection = links.length > 0
    ? `\n\n## Referenced Links\n` +
      links.map(l => `- **${l.name}**: ${l.url}`).join('\n')
    : ''

  const contextNote = (attachments.length > 0 || links.length > 0)
    ? '\n\nBase your description primarily on the attached documents and referenced links above. Extract specific details, goals, and context from them rather than generating generic content.'
    : ''

  return `You are a Chief-of-Staff assistant. Generate a detailed, structured task description in markdown for the following task. Be concise but specific and actionable.

Task: "${title}"${docSection}${linkSection}${contextNote}

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
}

const QUERY_SYSTEM_PROMPT = (tasksJson: string) =>
  `You are an AI assistant embedded in Pepper, a task management app for engineering leaders. You can answer questions AND take direct actions on tasks using the provided tools.

When the user asks you to create, update, move, or delete tasks, use the tools to make those changes immediately — don't ask for confirmation unless the action is irreversible and broad (e.g. deleting many tasks at once). After completing actions, briefly confirm what you did in plain language.

Today: ${new Date().toISOString().slice(0, 10)}

Current task data (JSON):
${tasksJson}`

// ---------------------------------------------------------------------------
// streamQuery — supports tool use loop
// ---------------------------------------------------------------------------

export async function streamQuery(
  messages: { role: 'user' | 'assistant'; content: string }[],
  tasksJson: string,
  onChunk: (text: string) => void,
  onAction: (description: string) => void,
  onToolCall: (name: string, input: Record<string, unknown>) => Promise<unknown>
): Promise<void> {
  const apiKey = readConfig().anthropicApiKey
  if (!apiKey) throw new Error('NO_API_KEY')

  const client = new Anthropic({ apiKey })

  // Internal messages array — may grow as tools are called
  const apiMessages: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }))

  // Loop until stop_reason is 'end_turn' (handles multi-step tool use)
  while (true) {
    const stream = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      stream: true,
      system: QUERY_SYSTEM_PROMPT(tasksJson),
      tools: TASK_TOOLS,
      messages: apiMessages,
    })

    // Accumulate content blocks from the stream
    const contentBlocks: Anthropic.ContentBlock[] = []
    let currentText = ''
    let currentToolId = ''
    let currentToolName = ''
    let currentToolJson = ''
    let inTool = false
    let stopReason = 'end_turn'

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start':
          if (event.content_block.type === 'text') {
            currentText = ''
            inTool = false
          } else if (event.content_block.type === 'tool_use') {
            currentToolId   = event.content_block.id
            currentToolName = event.content_block.name
            currentToolJson = ''
            inTool = true
          }
          break

        case 'content_block_delta':
          if (event.delta.type === 'text_delta' && !inTool) {
            currentText += event.delta.text
            onChunk(event.delta.text)
          } else if (event.delta.type === 'input_json_delta' && inTool) {
            currentToolJson += event.delta.partial_json
          }
          break

        case 'content_block_stop':
          if (!inTool) {
            contentBlocks.push({ type: 'text', text: currentText })
          } else {
            contentBlocks.push({
              type: 'tool_use',
              id: currentToolId,
              name: currentToolName,
              input: JSON.parse(currentToolJson || '{}'),
            })
            inTool = false
          }
          break

        case 'message_delta':
          if (event.delta.stop_reason) stopReason = event.delta.stop_reason
          break
      }
    }

    if (stopReason !== 'tool_use') break

    // Execute tool calls and collect results
    const toolUses = contentBlocks.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    apiMessages.push({ role: 'assistant', content: contentBlocks })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tool of toolUses) {
      const input = tool.input as Record<string, unknown>
      try {
        const result = await onToolCall(tool.name, input)
        onAction(describeAction(tool.name, input))
        toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: JSON.stringify(result) })
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: `Error: ${err instanceof Error ? err.message : 'unknown'}`,
          is_error: true,
        })
      }
    }

    apiMessages.push({ role: 'user', content: toolResults })
  }
}

function describeAction(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'create_task':
      return `Created "${input.title}"`
    case 'update_task': {
      const changes = Object.entries(input)
        .filter(([k]) => k !== 'id')
        .map(([k, v]) => `${k} → ${v}`)
        .join(', ')
      return `Updated task: ${changes}`
    }
    case 'delete_task':
      return `Deleted task ${input.id}`
    case 'create_subtask':
      return `Added sub-task "${input.title}"`
    default:
      return toolName
  }
}

// ---------------------------------------------------------------------------
// streamDraft — unchanged
// ---------------------------------------------------------------------------

export async function streamDraft(
  title: string,
  attachments: { name: string; content: string }[],
  links: { name: string; url: string }[],
  onChunk: (text: string) => void
): Promise<void> {
  const apiKey = readConfig().anthropicApiKey
  if (!apiKey) throw new Error('NO_API_KEY')

  const client = new Anthropic({ apiKey })
  const stream = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    stream: true,
    messages: [{ role: 'user', content: DRAFT_PROMPT(title, attachments, links) }]
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      onChunk(event.delta.text)
    }
  }
}
