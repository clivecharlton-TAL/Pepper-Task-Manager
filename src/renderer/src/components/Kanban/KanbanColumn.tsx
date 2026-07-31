import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState } from 'react'
import type { Task, TaskStatus } from '../../../../shared/types'
import TaskCard from './TaskCard'

const COLUMN_META: Record<TaskStatus, { colour: string; label: string }> = {
  backlog:     { colour: '#6b7280', label: 'BACKLOG' },
  todo:        { colour: '#4a9eca', label: 'TODO' },
  in_progress: { colour: '#d4a843', label: 'IN PROGRESS' },
  done:        { colour: '#4caf82', label: 'DONE' }
}

interface Props {
  id: TaskStatus
  label: string
  tasks: Task[]
  onOpenTask: (task: Task) => void
  isCollapsed: boolean
  onToggleCollapsed: () => void
}

export default function KanbanColumn({
  id, tasks, onOpenTask, isCollapsed, onToggleCollapsed
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const meta = COLUMN_META[id]
  const [doneExpanded, setDoneExpanded] = useState(false)

  const isDone = id === 'done'
  const visibleTasks = isDone && !doneExpanded ? [] : tasks

  // Collapsed: a narrow vertical strip that still accepts drops, so a card can
  // be dragged into a column that is out of focus without expanding it first.
  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        onClick={onToggleCollapsed}
        title={`Expand ${meta.label}`}
        className={`flex flex-col items-center w-10 flex-shrink-0 rounded cursor-pointer border transition-colors py-3 gap-3 ${
          isOver ? 'bg-[#2a2a2a] border-transparent' : 'border-[#2e2e2e] hover:bg-[#252525]'
        }`}
        style={isOver ? { borderColor: meta.colour + '60' } : {}}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.colour }} />
        <span
          className="font-mono text-[10px] px-1 py-0.5 rounded flex-shrink-0"
          style={{ backgroundColor: meta.colour + '22', color: meta.colour }}
        >
          {tasks.length}
        </span>
        <span
          className="font-mono text-[10px] tracking-widest uppercase whitespace-nowrap"
          style={{ color: meta.colour, writingMode: 'vertical-rl' }}
        >
          {meta.label}
        </span>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-1 min-w-[220px] max-w-[420px] rounded transition-colors ${
        isOver ? 'bg-[#2a2a2a]' : ''
      }`}
    >
      {/* Column header — the label toggles collapse */}
      <div className="flex items-center gap-2.5 px-1 pb-3 flex-shrink-0">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.colour }} />
        <button
          onClick={onToggleCollapsed}
          title={`Collapse ${meta.label}`}
          className="font-mono text-[10px] tracking-widest uppercase hover:opacity-70 transition-opacity"
          style={{ color: meta.colour }}
        >
          {meta.label}
        </button>
        <span
          className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded"
          style={{ backgroundColor: meta.colour + '22', color: meta.colour }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <SortableContext items={visibleTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto space-y-2 min-h-[80px]">
          {visibleTasks.map(task => <TaskCard key={task.id} task={task} onOpen={onOpenTask} />)}

          {/* Drop target always rendered so cards can be dragged into Done */}
          {(visibleTasks.length === 0) && (
            <div
              className="h-20 flex items-center justify-center font-mono text-[10px] tracking-widest uppercase text-[#333333] rounded border border-dashed border-[#333333] transition-colors"
              style={isOver ? { borderColor: meta.colour + '60' } : {}}
            >
              Drop here
            </div>
          )}

          {/* Collapsed done tasks toggle */}
          {isDone && tasks.length > 0 && (
            <button
              onClick={() => setDoneExpanded(e => !e)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded font-mono text-[10px] text-[#555555] hover:text-[#888888] hover:bg-[#2a2a2a] transition-colors"
            >
              <span className={`transition-transform ${doneExpanded ? 'rotate-90' : ''}`}>▶</span>
              {doneExpanded
                ? `Hide ${tasks.length} completed`
                : `Show ${tasks.length} completed`
              }
            </button>
          )}
        </div>
      </SortableContext>
    </div>
  )
}
