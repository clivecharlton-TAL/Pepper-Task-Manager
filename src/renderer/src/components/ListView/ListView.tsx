import { useState, useMemo } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import type { Task } from '../../../../shared/types'
import ListRow from './ListRow'
import TaskDetailModal from '../Kanban/TaskDetailModal'
import ZeroStateView from '../shared/ZeroStateView'
import { matchesDue, flattenLabels, matchesSearch, applySortFn, computeGroups, type Group } from '../../utils/listHelpers'

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

  const isEmpty = groups !== null
    ? groups.length === 0
    : rows.length === 0 && doneTasks.length === 0

  if (isEmpty) {
    return (
      <>
        <ZeroStateView />
        {detailTask && <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />}
      </>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-4">

        {/* Grouped rendering */}
        {groups !== null ? (
          groups.length === 0 ? null : (
            groups.map(g => (
              <div key={g.id}>
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
            {rows.map((task, i) => (
              <ListRow
                key={task.id}
                task={task}
                flatLabels={flatLabels}
                onOpen={setDetailTask}
                isLast={i === rows.length - 1 && doneTasks.length === 0}
              />
            ))}

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
