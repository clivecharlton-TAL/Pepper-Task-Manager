import { useState, useMemo } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import { KANBAN_COLUMNS, type Task, type TaskStatus } from '../../../../shared/types'
import KanbanColumn from './KanbanColumn'
import TaskDetailModal from './TaskDetailModal'
import ZeroStateView from '../shared/ZeroStateView'
import { flattenLabels, matchesSearchSemantic, matchesDue, matchesHiddenTags, matchesAssignedToMe } from '../../utils/listHelpers'

export default function KanbanBoard() {
  const { tasks, labels, searchQuery, semanticTaskIds, activeStatus, activePriority, activeDue, assignedToMe, hiddenTags, collapsedColumns, toggleColumnCollapsed, expandAllColumns } = useTaskStore()
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

  const allCollapsed = KANBAN_COLUMNS.every(col => collapsedColumns.includes(col.id))

  // Matches can hide entirely inside collapsed columns, which otherwise looks
  // like the search found nothing.
  const hiddenByCollapse = collapsedColumns.reduce(
    (n, status) => n + visibleTasks.filter(t => t.status === status).length, 0
  )
  const allMatchesHidden = hiddenByCollapse > 0 && hiddenByCollapse === visibleTasks.length

  return (
    <>
      {visibleTasks.length === 0 ? (
        <ZeroStateView />
      ) : (
        <div className="flex-1 flex gap-4 p-4 overflow-x-auto overflow-y-hidden">
          {/* Escape hatch: with every column collapsed there is nothing to
              read, so offer a way back without hunting for a strip to click. */}
          {(allCollapsed || allMatchesHidden) && (
            <button
              onClick={expandAllColumns}
              className="flex-1 flex items-center justify-center gap-2 rounded border border-dashed border-[#333333] font-mono text-[10px] tracking-widest uppercase text-[#555555] hover:text-[#a8a8a8] hover:border-[#4a4a4a] transition-colors"
            >
              {allMatchesHidden && !allCollapsed
                ? `${hiddenByCollapse} match${hiddenByCollapse === 1 ? '' : 'es'} in collapsed columns — expand all`
                : 'Expand all columns'}
            </button>
          )}
          {KANBAN_COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              tasks={tasksByStatus(col.id)}
              onOpenTask={setDetailTask}
              isCollapsed={collapsedColumns.includes(col.id)}
              onToggleCollapsed={() => toggleColumnCollapsed(col.id)}
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
