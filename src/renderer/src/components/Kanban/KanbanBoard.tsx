import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection
} from '@dnd-kit/core'
import { useState, useMemo } from 'react'
import { useTaskStore, type DueFilter } from '../../stores/taskStore'
import { KANBAN_COLUMNS, type Task, type TaskStatus, type LabelNode } from '../../../../shared/types'
import KanbanColumn from './KanbanColumn'
import TaskCard from './TaskCard'
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
  // label IDs are full hierarchy paths — one check covers name, parent, and full path
  if (task.labels.some(id => id.toLowerCase().includes(s))) return true
  // also check display names (handles numeric-prefix-stripped searches)
  if (task.labels.some(id => flat.find(l => l.id === id)?.name.toLowerCase().includes(s))) return true
  return false
}

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

// pointerWithin wins when the cursor is clearly inside a column; falls back to
// rect intersection so drops at the very edge of a column still register.
const kanbanCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : rectIntersection(args)
}

export default function KanbanBoard() {
  const { tasks, labels, updateTask, searchQuery, activeStatus, activePriority, activeDue } = useTaskStore()
  const [draggingId, setDraggingId] = useState<string | null>(null)
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const draggingTask = draggingId ? tasks.find((t) => t.id === draggingId) ?? null : null

  const tasksByStatus = (status: TaskStatus) => visibleTasks.filter((t) => t.status === status)

  const onDragStart = ({ active }: DragStartEvent) => {
    setDraggingId(active.id as string)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null)
    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string

    // If dropped on a column id directly
    const colIds = KANBAN_COLUMNS.map((c) => c.id)
    if (colIds.includes(overId as TaskStatus)) {
      updateTask({ id: taskId, status: overId as TaskStatus })
      return
    }

    // If dropped on another task, use that task's status
    const overTask = tasks.find((t) => t.id === overId)
    if (overTask) {
      updateTask({ id: taskId, status: overTask.status })
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex-1 flex gap-4 p-4 overflow-x-auto overflow-y-hidden">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            tasks={tasksByStatus(col.id)}
            onOpenTask={setDetailTask}
          />
        ))}
      </div>

      <DragOverlay>
        {draggingTask && <TaskCard task={draggingTask} isDragging />}
      </DragOverlay>

      {detailTask && (
        <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />
      )}
    </DndContext>
  )
}
