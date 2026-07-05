import { useState, useMemo } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import { KANBAN_COLUMNS, type Task, type TaskStatus } from '../../../../shared/types'
import KanbanColumn from './KanbanColumn'
import TaskDetailModal from './TaskDetailModal'
import ZeroStateView from '../shared/ZeroStateView'
import { flattenLabels, matchesSearch, matchesDue, matchesHiddenTags } from '../../utils/listHelpers'

export default function KanbanBoard() {
  const { tasks, labels, searchQuery, activeStatus, activePriority, activeDue, hiddenTags } = useTaskStore()
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  const flatLabels = useMemo(() => flattenLabels(labels), [labels])

  const visibleTasks = useMemo(() =>
    tasks.filter(t => {
      if (activeStatus   && t.status   !== activeStatus)   return false
      if (activePriority && t.priority !== activePriority) return false
      if (activeDue      && !matchesDue(t, activeDue))     return false
      if (matchesHiddenTags(t, hiddenTags)) return false
      if (searchQuery    && !matchesSearch(t, searchQuery, flatLabels)) return false
      return true
    }),
    [tasks, searchQuery, activeStatus, activePriority, activeDue, hiddenTags, flatLabels]
  )

  const tasksByStatus = (status: TaskStatus) => visibleTasks.filter(t => t.status === status)

  return (
    <>
      {visibleTasks.length === 0 ? (
        <ZeroStateView />
      ) : (
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
      )}

      {detailTask && (
        <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />
      )}
    </>
  )
}
