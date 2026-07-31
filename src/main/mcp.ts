import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
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
            ...process.env,
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
        const anthropicTools: Anthropic.Tool[] = (toolsRes.tools || []).map(t => ({
          name: `mcp__${serverName}__${t.name}`,
          description: t.description || `Tool ${t.name} from MCP server ${serverName}`,
          input_schema: {
            type: 'object',
            properties: (t.inputSchema as any)?.properties || {},
            required: (t.inputSchema as any)?.required || []
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

export async function callMcpTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  const match = name.match(/^mcp__([^__]+)__(.+)$/)
  if (!match) throw new Error(`Invalid MCP tool name format: ${name}`)

  const serverName = match[1]
  const toolName = match[2]

  const client = clients.get(serverName)
  if (!client) throw new Error(`MCP server not connected: ${serverName}`)

  const result = await client.callTool({
    name: toolName,
    arguments: input as any
  })

  if (result.isError) {
    throw new Error(result.content.map(c => c.type === 'text' ? c.text : 'Unknown error').join('\n'))
  }

  return result.content.map(c => c.type === 'text' ? c.text : '').join('\n')
}
