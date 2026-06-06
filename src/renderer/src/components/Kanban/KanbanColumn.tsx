import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
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
}

export default function KanbanColumn({ id, tasks, onOpenTask }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const meta = COLUMN_META[id]

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 flex-shrink-0 rounded transition-colors ${
        isOver ? 'bg-[#2a2a2a]' : ''
      }`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2.5 px-1 pb-3 flex-shrink-0">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.colour }} />
        <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: meta.colour }}>
          {meta.label}
        </span>
        <span
          className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded"
          style={{ backgroundColor: meta.colour + '22', color: meta.colour }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto space-y-2 min-h-[80px]">
          {tasks.map(task => <TaskCard key={task.id} task={task} onOpen={onOpenTask} />)}
          {tasks.length === 0 && (
            <div
              className="h-20 flex items-center justify-center font-mono text-[10px] tracking-widest uppercase text-[#333333] rounded border border-dashed border-[#333333] transition-colors"
              style={isOver ? { borderColor: meta.colour + '60' } : {}}
            >
              Drop here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}
