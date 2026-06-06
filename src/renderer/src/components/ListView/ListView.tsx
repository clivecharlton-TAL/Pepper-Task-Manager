import { useState, useMemo } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import type { Task, LabelNode } from '../../../../shared/types'
import ListRow from './ListRow'
import TaskDetailModal from '../Kanban/TaskDetailModal'

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
  const { tasks, labels, searchQuery, activeStatus, activePriority } = useTaskStore()
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  const flatLabels = useMemo(() => flattenLabels(labels), [labels])

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter(t => {
      if (activeStatus   && t.status   !== activeStatus)   return false
      if (activePriority && t.priority !== activePriority) return false
      if (searchQuery    && !matchesSearch(t, searchQuery, flatLabels)) return false
      return true
    })
    return [...filtered].sort(sortByDue)
  }, [tasks, searchQuery, activeStatus, activePriority, flatLabels])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-4">
        {visibleTasks.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="font-mono text-[11px] text-[#3a3a3a]">No tasks</p>
          </div>
        ) : (
          visibleTasks.map((task, i) => (
            <ListRow
              key={task.id}
              task={task}
              flatLabels={flatLabels}
              onOpen={setDetailTask}
              isLast={i === visibleTasks.length - 1}
            />
          ))
        )}
      </div>

      {detailTask && (
        <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />
      )}
    </div>
  )
}
