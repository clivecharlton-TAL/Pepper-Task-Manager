import { useState, useMemo } from 'react'
import { useTaskStore, type DueFilter } from '../../stores/taskStore'
import type { Task, LabelNode } from '../../../../shared/types'
import ListRow from './ListRow'
import TaskDetailModal from '../Kanban/TaskDetailModal'

function matchesDue(task: Task, filter: DueFilter): boolean {
  if (!task.due_date) return false
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
  return false
}

function sortByDue(a: Task, b: Task): number {
  if (!a.due_date && !b.due_date) return 0
  if (!a.due_date) return 1
  if (!b.due_date) return -1
  return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
}

export default function ListView() {
  const { tasks, labels, searchQuery, activeStatus, activePriority, activeDue } = useTaskStore()
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [showDone, setShowDone] = useState(false)

  const flatLabels = useMemo(() => flattenLabels(labels), [labels])

  const { activeTasks, doneTasks } = useMemo(() => {
    const filtered = tasks.filter(t => {
      if (activePriority && t.priority !== activePriority) return false
      if (activeDue      && !matchesDue(t, activeDue))     return false
      if (searchQuery    && !matchesSearch(t, searchQuery, flatLabels)) return false
      return true
    })

    if (activeStatus) {
      const sorted = [...filtered.filter(t => t.status === activeStatus)].sort(sortByDue)
      return { activeTasks: sorted, doneTasks: [] }
    }

    // When a due filter is active, show done tasks inline (they're already time-scoped)
    if (activeDue) {
      return { activeTasks: [...filtered].sort(sortByDue), doneTasks: [] }
    }

    const active = filtered.filter(t => t.status !== 'done')
    const done   = filtered.filter(t => t.status === 'done')
    return { activeTasks: [...active].sort(sortByDue), doneTasks: [...done].sort(sortByDue) }
  }, [tasks, searchQuery, activeStatus, activePriority, activeDue, flatLabels])

  const rows = showDone ? [...activeTasks, ...doneTasks] : activeTasks

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-4">
        {rows.length === 0 && doneTasks.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="font-mono text-[11px] text-[#3a3a3a]">No tasks</p>
          </div>
        ) : (
          rows.map((task, i) => (
            <ListRow
              key={task.id}
              task={task}
              flatLabels={flatLabels}
              onOpen={setDetailTask}
              isLast={i === rows.length - 1 && doneTasks.length === 0}
            />
          ))
        )}

        {/* Completed toggle */}
        {!activeStatus && doneTasks.length > 0 && (
          <button
            onClick={() => setShowDone(s => !s)}
            className="flex items-center gap-2 mt-3 px-2 py-1.5 rounded font-mono text-[10px] text-[#555555] hover:text-[#888888] hover:bg-[#2a2a2a] transition-colors"
          >
            <span className={`transition-transform ${showDone ? 'rotate-90' : ''}`}>▶</span>
            {showDone ? `Hide ${doneTasks.length} completed` : `Show ${doneTasks.length} completed`}
          </button>
        )}
      </div>

      {detailTask && (
        <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />
      )}
    </div>
  )
}
