import type { Task } from './types'

export type DueFilter = 'overdue' | 'today' | 'this_week'

export function matchesDue(task: Task, filter: DueFilter): boolean {
  if (!task.due_date || task.status === 'done') return false
  const due   = task.due_date.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const d     = new Date()
  d.setDate(d.getDate() + (7 - d.getDay()) % 7)
  const eow   = d.toISOString().slice(0, 10)
  if (filter === 'overdue')   return due < today
  if (filter === 'today')     return due === today
  if (filter === 'this_week') return due >= today && due <= eow
  return false
}
