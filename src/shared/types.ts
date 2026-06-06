export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'

export interface Task {
  id: string
  title: string
  notes: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  labels: string[]
  linked_email_id: string | null
  linked_email_subject: string | null
  created_at: string
  updated_at: string
}

export interface Label {
  id: string
  name: string
  parent_id: string | null
  colour: string
  sort_order: number
}

export interface LabelNode extends Label {
  children: LabelNode[]
}

export interface CreateTaskInput {
  title: string
  notes?: string
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string
  labels?: string[]
  linked_email_id?: string
  linked_email_subject?: string
}

export interface UpdateTaskInput {
  id: string
  title?: string
  notes?: string
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string | null
  labels?: string[]
  linked_email_id?: string | null
  linked_email_subject?: string | null
}

export interface TaskFilters {
  label?: string
  status?: TaskStatus
  priority?: TaskPriority
  search?: string
}

export const KANBAN_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' }
]

export type DomainEvent =
  | { type: 'task:created'; task: Task }
  | { type: 'task:updated'; task: Task }
  | { type: 'task:deleted'; id: string }
  | { type: 'labels:changed'; added: number }
