import { useState, useMemo } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import { KANBAN_COLUMNS, type Task, type TaskStatus } from '../../../../shared/types'
import KanbanColumn from './KanbanColumn'
import TaskDetailModal from './TaskDetailModal'
import ZeroStateView from '../shared/ZeroStateView'
import { flattenLabels, matchesSearchSemantic, matchesDue, matchesHiddenTags, matchesAssignedToMe } from '../../utils/listHelpers'

export default function KanbanBoard() {
  const { tasks, labels, searchQuery, semanticTaskIds, activeStatus, activePriority, activeDue, assignedToMe, hiddenTags } = useTaskStore()
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  const flatLabels = useMemo(() => flattenLabels(labels), [labels])

  const visibleTasks = useMemo(() =>
    tasks.filter(t => {
      if (activeStatus   && t.status   !== activeStatus)   return false
      if (activePriority && t.priority !== activePriority) return false
      if (activeDue      && !matchesDue(t, activeDue))     return false
      if (assignedToMe   && !matchesAssignedToMe(t))       return false
      if (matchesHiddenTags(t, hiddenTags)) return false
      if (searchQuery    && !matchesSearchSemantic(t, searchQuery, flatLabels, semanticTaskIds)) return false
      return true
    }),
    [tasks, searchQuery, semanticTaskIds, activeStatus, activePriority, activeDue, assignedToMe, hiddenTags, flatLabels]
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
