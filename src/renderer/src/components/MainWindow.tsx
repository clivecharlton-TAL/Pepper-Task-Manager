import { useState, useCallback, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core'
import Sidebar from './Sidebar/Sidebar'
import KanbanBoard from './Kanban/KanbanBoard'
import ListView from './ListView/ListView'
import ReportsView from './Reports/ReportsView'
import FilesView from './Files/FilesView'
import CalendarView from './Calendar/CalendarView'
import TopBar from './shared/TopBar'
import AIChatPanel from './AIChatPanel'
import TaskCard from './Kanban/TaskCard'
import { useTaskStore } from '../stores/taskStore'
import { useSubTaskCountStore } from '../stores/subTaskCountStore'
import { KANBAN_COLUMNS, type Task, type TaskStatus } from '../../../shared/types'

const MIN_WIDTH = 160
const MAX_WIDTH = 400

const appCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  if (hits.length > 0) {
    const subtaskHit = hits.find(h => String(h.id).startsWith('subtask-of-'))
    if (subtaskHit) return [subtaskHit]
    return hits
  }
  return rectIntersection(args)
}

export default function MainWindow() {
  const { viewMode, allTasks, updateTask, deleteTask } = useTaskStore()
  const { counts: subTaskCounts, setCount: setSubTaskCount } = useSubTaskCountStore()
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [isAIChatOpen, setIsAIChatOpen] = useState(false)
  const [draggingTask, setDraggingTask] = useState<Task | null>(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const onDragStart = ({ active }: DragStartEvent) => {
    setDraggingTask(allTasks.find(t => t.id === active.id) ?? null)
  }

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setDraggingTask(null)
    if (!over) return
    const taskId = active.id as string
    const overId = over.id as string

    // Dropped on a sidebar label — add label to task
    if (overId.startsWith('label:')) {
      const labelId = overId.slice('label:'.length)
      const task = allTasks.find(t => t.id === taskId)
      if (task && !task.labels.includes(labelId)) {
        updateTask({ id: taskId, labels: [...task.labels, labelId] })
      }
      return
    }

    // Dropped on a sub-task zone — convert task into a sub-task of the target
    if (overId.startsWith('subtask-of-')) {
      const parentId = overId.slice('subtask-of-'.length)
      const task = allTasks.find(t => t.id === taskId)
      if (!task || parentId === taskId) return
      await window.api.subtasks.create(parentId, task.title)
      deleteTask(taskId)
      const current = subTaskCounts[parentId] ?? { done: 0, total: 0 }
      setSubTaskCount(parentId, { done: current.done, total: current.total + 1 })
      return
    }

    // Kanban: dropped on a status column
    const colIds = KANBAN_COLUMNS.map(c => c.id)
    if (colIds.includes(overId as TaskStatus)) {
      updateTask({ id: taskId, status: overId as TaskStatus })
      return
    }

    // Kanban: dropped on another task → inherit that task's status
    const overTask = allTasks.find(t => t.id === overId)
    if (overTask) {
      updateTask({ id: taskId, status: overTask.status })
    }
  }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = ev.clientX - startX.current
      setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={appCollision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-screen bg-[#1c1c1e] overflow-hidden">
        <Sidebar width={sidebarWidth} />

        {/* Resize handle */}
        <div
          className="w-1 flex-shrink-0 cursor-col-resize hover:bg-[#c45d2e]/40 transition-colors active:bg-[#c45d2e]/60 z-10"
          style={{ background: 'transparent' }}
          onMouseDown={onMouseDown}
        />

        <div className="flex flex-col flex-1 min-w-0">
          <TopBar isAIChatOpen={isAIChatOpen} onToggleAIChat={() => setIsAIChatOpen(o => !o)} />
          {viewMode === 'kanban'   ? <KanbanBoard />   :
           viewMode === 'list'     ? <ListView />      :
           viewMode === 'reports'  ? <ReportsView />   :
           viewMode === 'files'    ? <FilesView />     :
                                     <CalendarView />}
        </div>
      </div>

      <AIChatPanel isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />

      <DragOverlay>
        {draggingTask && <TaskCard task={draggingTask} isDragging />}
      </DragOverlay>
    </DndContext>
  )
}
