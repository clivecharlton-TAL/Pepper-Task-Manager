import { useState, useMemo } from 'react'
import { useTaskStore, type DueFilter } from '../../stores/taskStore'
import { KANBAN_COLUMNS, type Task, type TaskStatus, type LabelNode } from '../../../../shared/types'
import KanbanColumn from './KanbanColumn'
import TaskDetailModal from './TaskDetailModal'

function flattenLabels(nodes: LabelNode[]): LabelNode[] {
  const out: LabelNode[] = []
  const walk = (arr: LabelNode[]) => arr.forEach(n => { out.push(n); walk(n.children) })
  walk(nodes)
  return out
}

function matchesSearch(task: Task, q: string, flat: LabelNode[]): boolean {
  const s = q.toLowerCase()
  if (task.title.toLowerCase().includes(s)) return true
  if (task.notes?.toLowerCase().includes(s)) return true
  if (task.labels.some(id => id.toLowerCase().includes(s))) return true
  if (task.labels.some(id => flat.find(l => l.id === id)?.name.toLowerCase().includes(s))) return true
  if ((task.assigned ?? []).some(name => name.toLowerCase().includes(s))) return true
  return false
}

function matchesDue(task: Task, filter: DueFilter): boolean {
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

export default function KanbanBoard() {
  const { tasks, labels, searchQuery, activeStatus, activePriority, activeDue } = useTaskStore()
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  const flatLabels = useMemo(() => flattenLabels(labels), [labels])

  const visibleTasks = useMemo(() =>
    tasks.filter(t => {
      if (activeStatus   && t.status   !== activeStatus)   return false
      if (activePriority && t.priority !== activePriority) return false
      if (activeDue      && !matchesDue(t, activeDue))     return false
      if (searchQuery    && !matchesSearch(t, searchQuery, flatLabels)) return false
      return true
    }),
    [tasks, searchQuery, activeStatus, activePriority, activeDue, flatLabels]
  )

  const tasksByStatus = (status: TaskStatus) => visibleTasks.filter(t => t.status === status)

  return (
    <>
      <div className="flex-1 flex gap-4 p-4 overflow-x-auto overflow-y-hidden">
        {KANBAN_COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            tasks={tasksByStatus(col.id)}
            onOpenTask={setDetailTask}
          />
        ))}
      </div>

      {detailTask && (
        <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />
      )}
    </>
  )
}
