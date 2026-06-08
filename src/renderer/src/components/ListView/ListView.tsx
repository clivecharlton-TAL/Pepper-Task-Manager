import { useState, useMemo } from 'react'
import { useTaskStore, type DueFilter, type ListSort, type ListGroup } from '../../stores/taskStore'
import type { Task, LabelNode, TaskStatus, TaskPriority } from '../../../../shared/types'
import ListRow from './ListRow'
import TaskDetailModal from '../Kanban/TaskDetailModal'

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

function sortByDue(a: Task, b: Task): number {
  if (!a.due_date && !b.due_date) return 0
  if (!a.due_date) return 1
  if (!b.due_date) return -1
  return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }

function applySortFn(sort: ListSort): (a: Task, b: Task) => number {
  switch (sort) {
    case 'priority': return (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    case 'created':  return (a, b) => (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : 0)
    case 'title':    return (a, b) => a.title.localeCompare(b.title)
    default:         return sortByDue
  }
}

type Group = { header: string; tasks: Task[]; color?: string }

function computeGroups(tasks: Task[], group: ListGroup, flat: LabelNode[]): Group[] {
  if (group === 'priority') {
    const defs: { value: TaskPriority; header: string; color: string }[] = [
      { value: 'high',   header: 'High',   color: '#FC2847' },
      { value: 'medium', header: 'Medium', color: '#FFC400' },
      { value: 'low',    header: 'Low',    color: '#30D158' },
    ]
    return defs
      .map(d => ({ header: d.header, color: d.color, tasks: tasks.filter(t => t.priority === d.value) }))
      .filter(g => g.tasks.length > 0)
  }

  if (group === 'status') {
    const defs: { value: TaskStatus; header: string; color: string }[] = [
      { value: 'backlog',     header: 'Backlog',     color: '#6b7280' },
      { value: 'todo',        header: 'To Do',       color: '#4a9eca' },
      { value: 'in_progress', header: 'In Progress', color: '#d4a843' },
      { value: 'done',        header: 'Done',        color: '#4caf82' },
    ]
    return defs
      .map(d => ({ header: d.header, color: d.color, tasks: tasks.filter(t => t.status === d.value) }))
      .filter(g => g.tasks.length > 0)
  }

  if (group === 'label') {
    const buckets: Record<string, Task[]> = {}
    const unlabeled: Task[] = []
    for (const task of tasks) {
      if (task.labels.length === 0) { unlabeled.push(task); continue }
      const topId = task.labels[0].split('/')[0]
      ;(buckets[topId] ??= []).push(task)
    }
    const groups: Group[] = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, ts]) => ({
        header: flat.find(l => l.id === id)?.name ?? id,
        color:  flat.find(l => l.id === id)?.colour,
        tasks:  ts,
      }))
    if (unlabeled.length > 0) groups.push({ header: 'Unlabeled', tasks: unlabeled })
    return groups
  }

  return []
}

function GroupHeader({ header, color }: { header: string; color?: string }) {
  return (
    <div className="flex items-center gap-2.5 mt-5 mb-1 first:mt-2">
      {color && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
      <span className="font-mono text-[10px] tracking-widest uppercase text-[#555555]">{header}</span>
      <div className="flex-1 h-px bg-[#272727]" />
    </div>
  )
}

export default function ListView() {
  const { tasks, labels, searchQuery, activeStatus, activePriority, activeDue, listSort, listGroup } = useTaskStore()
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [showDone, setShowDone] = useState(false)

  const flatLabels = useMemo(() => flattenLabels(labels), [labels])
  const cmp = useMemo(() => applySortFn(listSort), [listSort])

  const filtered = useMemo(() => tasks.filter(t => {
    if (activePriority && t.priority !== activePriority) return false
    if (activeDue      && !matchesDue(t, activeDue))     return false
    if (searchQuery    && !matchesSearch(t, searchQuery, flatLabels)) return false
    return true
  }), [tasks, activePriority, activeDue, searchQuery, flatLabels])

  // --- grouped mode ---
  const groups = useMemo<Group[] | null>(() => {
    if (listGroup === 'none') return null
    const scopedTasks = (activeStatus ? filtered.filter(t => t.status === activeStatus) : filtered)
      .filter(t => t.status !== 'done')
    const computed = computeGroups(scopedTasks, listGroup, flatLabels)
    return computed.map(g => ({ ...g, tasks: [...g.tasks].sort(cmp) }))
  }, [listGroup, filtered, activeStatus, flatLabels, cmp])

  // --- flat mode (existing behaviour) ---
  const { activeTasks, doneTasks } = useMemo(() => {
    if (groups !== null) return { activeTasks: [], doneTasks: [] }

    if (activeStatus) {
      const sorted = [...filtered.filter(t => t.status === activeStatus)].sort(cmp)
      return { activeTasks: sorted, doneTasks: [] }
    }
    if (activeDue) {
      return { activeTasks: [...filtered].sort(cmp), doneTasks: [] }
    }
    const active = filtered.filter(t => t.status !== 'done')
    const done   = filtered.filter(t => t.status === 'done')
    return { activeTasks: [...active].sort(cmp), doneTasks: [...done].sort(cmp) }
  }, [groups, filtered, activeStatus, activeDue, cmp])

  const rows = showDone ? [...activeTasks, ...doneTasks] : activeTasks

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-4">

        {/* Grouped rendering */}
        {groups !== null ? (
          groups.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="font-mono text-[11px] text-[#3a3a3a]">No tasks</p>
            </div>
          ) : (
            groups.map(g => (
              <div key={g.header}>
                <GroupHeader header={g.header} color={g.color} />
                {g.tasks.map((task, i) => (
                  <ListRow
                    key={task.id}
                    task={task}
                    flatLabels={flatLabels}
                    onOpen={setDetailTask}
                    isLast={i === g.tasks.length - 1}
                  />
                ))}
              </div>
            ))
          )
        ) : (
          /* Flat rendering */
          <>
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

            {!activeStatus && doneTasks.length > 0 && (
              <button
                onClick={() => setShowDone(s => !s)}
                className="flex items-center gap-2 mt-3 px-2 py-1.5 rounded font-mono text-[10px] text-[#555555] hover:text-[#888888] hover:bg-[#2a2a2a] transition-colors"
              >
                <span className={`transition-transform ${showDone ? 'rotate-90' : ''}`}>▶</span>
                {showDone ? `Hide ${doneTasks.length} completed` : `Show ${doneTasks.length} completed`}
              </button>
            )}
          </>
        )}
      </div>

      {detailTask && (
        <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />
      )}
    </div>
  )
}
