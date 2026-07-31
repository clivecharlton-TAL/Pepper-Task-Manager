import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import {
  CallToolResultSchema,
  type CallToolResult,
  type ContentBlock,
  type Tool as McpTool,
} from '@modelcontextprotocol/sdk/types.js'
import Anthropic from '@anthropic-ai/sdk'

const MCP_CONFIG_PATH = join(app.getPath('userData'), 'mcp-servers.json')

interface McpServerConfig {
  command: string
  args: string[]
  env?: Record<string, string>
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>
}

const clients: Map<string, Client> = new Map()
const toolCache: Map<string, Anthropic.Tool[]> = new Map()

// process.env values are `string | undefined`, but the stdio transport requires
// a plain Record<string, string>. Drop the unset entries rather than casting.
function definedEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((e): e is [string, string] => e[1] !== undefined)
  )
}

export async function initMcpServers(): Promise<void> {
  if (!existsSync(MCP_CONFIG_PATH)) return

  try {
    const configRaw = readFileSync(MCP_CONFIG_PATH, 'utf-8')
    const config = JSON.parse(configRaw) as McpConfig

    for (const [serverName, serverConfig] of Object.entries(config.mcpServers || {})) {
      if (clients.has(serverName)) continue

      try {
        const transport = new StdioClientTransport({
          command: serverConfig.command,
          args: serverConfig.args,
          env: {
            ...definedEnv(process.env),
            ...(serverConfig.env || {})
          }
        })

        const client = new Client(
          { name: 'pepper-task-manager', version: '0.1.0' },
          { capabilities: {} }
        )

        await client.connect(transport)
        clients.set(serverName, client)

        // Load and cache tools immediately
        const toolsRes = await client.listTools()
        const anthropicTools: Anthropic.Tool[] = (toolsRes.tools || []).map((t: McpTool) => ({
          name: `mcp__${serverName}__${t.name}`,
          description: t.description || `Tool ${t.name} from MCP server ${serverName}`,
          input_schema: {
            type: 'object',
            properties: t.inputSchema?.properties ?? {},
            required: t.inputSchema?.required ?? []
          }
        }))
        toolCache.set(serverName, anthropicTools)

      } catch (e) {
        console.error(`Failed to connect to MCP server ${serverName}:`, e)
      }
    }
  } catch (e) {
    console.error('Failed to initialize MCP servers:', e)
  }
}

export function getMcpTools(): Anthropic.Tool[] {
  const allTools: Anthropic.Tool[] = []
  for (const tools of toolCache.values()) {
    allTools.push(...tools)
  }
  return allTools
}

/**
 * Close every connected server. Each transport owns a spawned child process,
 * so this must run on quit or those processes are orphaned.
 */
export async function shutdownMcpServers(): Promise<void> {
  await Promise.all(
    Array.from(clients.entries()).map(async ([serverName, client]) => {
      try {
        await client.close()
      } catch (e) {
        console.error(`Failed to close MCP server ${serverName}:`, e)
      }
    })
  )
  clients.clear()
  toolCache.clear()
}

export async function callMcpTool(name: string, input: Record<string, unknown>): Promise<string> {
  // Non-greedy server segment so the first '__' delimits it; the tool name may
  // itself contain '__'. A character class like [^__]+ would exclude single
  // underscores too, which wrongly rejects names such as 'google_drive'.
  const match = name.match(/^mcp__(.+?)__(.+)$/)
  if (!match) throw new Error(`Invalid MCP tool name format: ${name}`)

  const serverName = match[1]
  const toolName = match[2]

  const client = clients.get(serverName)
  if (!client) throw new Error(`MCP server not connected: ${serverName}`)

  // callTool's declared return is a union with the legacy-compatible shape, so
  // `content` widens to unknown. Passing CallToolResultSchema makes the SDK
  // validate against that schema at runtime; we then read just the two fields
  // we care about, whose shapes that validation guarantees.
  const result = await client.callTool({
    name: toolName,
    arguments: input
  }, CallToolResultSchema) as Pick<CallToolResult, 'content' | 'isError'>

  const text = result.content
    .map((c: ContentBlock) => (c.type === 'text' ? c.text : ''))
    .join('\n')

  if (result.isError) throw new Error(text || 'Unknown error')

  return text
}
