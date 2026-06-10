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
  assigned: string[]
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
  assigned?: string[]
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
  assigned?: string[]
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

export interface VelocityPoint {
  week: string
  created: number
  completed: number
}

export interface CompletionTimeItem {
  label: string
  avgDays: number
  count: number
  colour: string
}

export interface SubTask {
  id: string
  task_id: string
  title: string
  notes: string | null
  done: boolean
  assigned: string | null
  due_date: string | null
  sort_order: number
  created_at: string
}

export interface TaskAttachment {
  id: string
  task_id: string
  path: string
  name: string
  added_at: string
}

export interface TaskAttachmentWithStatus extends TaskAttachment {
  exists: boolean
}

export interface FileEntry {
  name: string
  relativePath: string
  isDirectory: boolean
  size: number | null
  modifiedAt: string | null
}

export interface LabelBreakdownItem {
  label: string
  colour: string
  total: number
  done: number
  inProgress: number
  todo: number
  backlog: number
}

export interface ReportData {
  velocity: VelocityPoint[]
  completionTime: {
    byPriority: CompletionTimeItem[]
    byLabel: CompletionTimeItem[]
  }
  backlogHealth: {
    byStatus: { status: string; count: number }[]
    overdueCount: number
    avgAgeDays: number
    noDueDateCount: number
    totalOpen: number
  }
  labelBreakdown: LabelBreakdownItem[]
}
