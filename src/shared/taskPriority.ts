import type { TaskPriority } from './types'

export const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }
export const PRIORITY_GLYPH: Record<TaskPriority, string> = { high: '●', medium: '◐', low: '○' }
