import { useMemo, useState } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import {
  eachDayOfInterval,
  startOfDay,
  endOfDay,
  differenceInCalendarDays,
  format,
  isToday,
  isWeekend
} from 'date-fns'
import type { Task } from '../../../../shared/types'
import { flattenLabels, computeGroups, applySortFn, matchesSearch, matchesDue, matchesHiddenTags, matchesAssignedToMe, type Group } from '../../utils/listHelpers'

type TimelineRow =
  | { type: 'task'; task: Task }
  | { type: 'group-header'; group: Group; isCollapsed: boolean }

export default function TimelineView() {
  const { tasks, labels, searchQuery, listGroup, listSort, activeStatus, activePriority, activeDue, assignedToMe, hiddenStatuses, hiddenTags } = useTaskStore()
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const flatLabels = useMemo(() => flattenLabels(labels), [labels])
  const cmp = useMemo(() => applySortFn(listSort), [listSort])

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!t.due_date) return false
      if (hiddenStatuses.includes(t.status)) return false
      if (matchesHiddenTags(t, hiddenTags)) return false
      if (activeStatus && t.status !== activeStatus) return false
      if (activePriority && t.priority !== activePriority) return false
      if (activeDue && !matchesDue(t, activeDue)) return false
      if (assignedToMe && !matchesAssignedToMe(t)) return false
      if (searchQuery && !matchesSearch(t, searchQuery, flatLabels)) return false
      return true
    })
  }, [tasks, activeStatus, activePriority, activeDue, assignedToMe, searchQuery, flatLabels, hiddenStatuses, hiddenTags])

  const { timelineTasks, groups } = useMemo(() => {
    const sorted = [...filteredTasks].sort((a, b) => {
      const primary = cmp(a, b)
      if (primary !== 0) return primary
      const startA = new Date(a.created_at).getTime()
      const startB = new Date(b.created_at).getTime()
      return startA - startB
    })

    if (listGroup === 'none') {
      return { timelineTasks: sorted, groups: null }
    }

    const computed = computeGroups(sorted, listGroup, flatLabels)
    const allGroupedTasks = computed.flatMap(g => g.tasks)
    return { timelineTasks: allGroupedTasks, groups: computed }
  }, [filteredTasks, listGroup, flatLabels, cmp])

  const rows = useMemo(() => {
    if (!groups) {
      return timelineTasks.map(task => ({ type: 'task' as const, task }))
    }
    const result: TimelineRow[] = []
    groups.forEach(g => {
      const isCollapsed = collapsedGroups.has(g.id)
      result.push({ type: 'group-header', group: g, isCollapsed })
      if (!isCollapsed) {
        g.tasks.forEach(task => {
          result.push({ type: 'task', task })
        })
      }
    })
    return result
  }, [timelineTasks, groups, collapsedGroups])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const { timelineStart, timelineEnd, totalDays, days, monthGroups } = useMemo(() => {
    if (timelineTasks.length === 0) {
      const start = new Date()
      start.setDate(start.getDate() - 7)
      const end = new Date()
      end.setDate(end.getDate() + 21)
      return computeTimelineGrid(startOfDay(start), endOfDay(end))
    }

    const earliestCreated = new Date(Math.min(...timelineTasks.map(t => new Date(t.created_at).getTime())))
    const latestDue = new Date(Math.max(...timelineTasks.map(t => new Date(t.due_date!).getTime())))

    const startBound = new Date(earliestCreated)
    startBound.setDate(startBound.getDate() - 3)

    const endBound = new Date(latestDue)
    endBound.setDate(endBound.getDate() + 14) // Pad for right-side text

    return computeTimelineGrid(startOfDay(startBound), endOfDay(endBound))
  }, [timelineTasks])

  function computeTimelineGrid(start: Date, end: Date) {
    const daysArr = eachDayOfInterval({ start, end })

    // Group contiguous days into months
    const mGroups: { name: string; dayCount: number }[] = []
    let currentMonth = ''
    let count = 0

    daysArr.forEach(day => {
      const mName = format(day, 'MMMM yyyy')
      if (mName !== currentMonth) {
        if (currentMonth) mGroups.push({ name: currentMonth, dayCount: count })
        currentMonth = mName
        count = 1
      } else {
        count++
      }
    })
    if (currentMonth) mGroups.push({ name: currentMonth, dayCount: count })

    return {
      timelineStart: start,
      timelineEnd: end,
      totalDays: differenceInCalendarDays(end, start) + 1,
      days: daysArr,
      monthGroups: mGroups
    }
  }

  const DAY_WIDTH = 28
  const ROW_HEIGHT = 40

  const [colTask, setColTask] = useState(240)
  const [colStatus, setColStatus] = useState(120)
  const [colLabels, setColLabels] = useState(140)

  const LEFT_PANE_WIDTH = colTask + colStatus + colLabels

  const startResize = (
    e: React.MouseEvent,
    startW: number,
    setter: React.Dispatch<React.SetStateAction<number>>
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX

    const onMove = (ev: MouseEvent) => {
      setter(Math.max(60, startW + (ev.clientX - startX)))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
  }

  const calculateTaskPosition = (task: Task) => {
    const created = startOfDay(new Date(task.created_at))
    let daysFromStart = differenceInCalendarDays(created, timelineStart)
    if (daysFromStart < 0) daysFromStart = 0

    const due = startOfDay(new Date(task.due_date!))
    const durationDays = Math.max(1, differenceInCalendarDays(due, created) + 1)

    return {
      left: daysFromStart * DAY_WIDTH,
      width: durationDays * DAY_WIDTH
    }
  }

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'done':        return { color: '#4ade80', bg: 'bg-[#4ade80]/20', border: 'border-[#4ade80]', text: 'text-[#888]' }
      case 'in_progress': return { color: '#c45d2e', bg: 'bg-[#c45d2e]',    border: 'border-[#c45d2e]', text: 'text-[#f0f0f0]' }
      case 'todo':        return { color: '#60a5fa', bg: 'bg-[#60a5fa]/80', border: 'border-[#60a5fa]', text: 'text-[#b0b0b0]' }
      default:            return { color: '#71717a', bg: 'bg-[#71717a]/50', border: 'border-[#71717a]', text: 'text-[#a0a0a0]' }
    }
  }

  if (timelineTasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[#666] font-mono text-[11px] h-full">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-50">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        No tasks with due dates found for timeline.
      </div>
    )
  }

  const totalGridWidth = totalDays * DAY_WIDTH

  // Calculate "Today" line
  const now = new Date()
  const isTodayInGrid = now >= timelineStart && now <= timelineEnd
  const todayLeft = isTodayInGrid ? differenceInCalendarDays(now, timelineStart) * DAY_WIDTH + (DAY_WIDTH / 2) : -1

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#1c1c1e]">
      <div className="flex-1 overflow-auto custom-scrollbar flex bg-[#1c1c1e]">
        <div className="flex min-w-max">

          {/* Left Sticky Pane (Data Table) */}
          <div className="sticky left-0 z-30 bg-[#1c1c1e] flex flex-col border-r border-[#333] flex-shrink-0" style={{ width: LEFT_PANE_WIDTH }}>
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[#1a1a1c] border-b border-[#333] h-[60px] flex shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
               <div className="relative px-4 pb-3 flex items-end font-mono text-[10px] uppercase tracking-widest text-[#666] border-r border-[#333]/50" style={{ width: colTask }}>
                 Task name
                 <div className="absolute top-0 right-[-4px] bottom-0 w-2 cursor-col-resize hover:bg-[#c45d2e]/40 z-10" onMouseDown={(e) => startResize(e, colTask, setColTask)} />
               </div>
               <div className="relative px-4 pb-3 flex items-end font-mono text-[10px] uppercase tracking-widest text-[#666] border-r border-[#333]/50" style={{ width: colStatus }}>
                 Status
                 <div className="absolute top-0 right-[-4px] bottom-0 w-2 cursor-col-resize hover:bg-[#c45d2e]/40 z-10" onMouseDown={(e) => startResize(e, colStatus, setColStatus)} />
               </div>
               <div className="relative px-4 pb-3 flex items-end font-mono text-[10px] uppercase tracking-widest text-[#666]" style={{ width: colLabels }}>
                 Labels
                 <div className="absolute top-0 right-[-4px] bottom-0 w-2 cursor-col-resize hover:bg-[#c45d2e]/40 z-10" onMouseDown={(e) => startResize(e, colLabels, setColLabels)} />
               </div>
            </div>

            {/* Rows */}
            <div className="flex flex-col relative z-20 bg-[#1c1c1e]">
              {rows.map((row) => {
                if (row.type === 'group-header') {
                  const g = row.group
                  return (
                    <div key={`group-${g.id}`} className="flex items-center border-b border-[#333] bg-[#222225] cursor-pointer hover:bg-[#2a2a2c] transition-colors" style={{ height: ROW_HEIGHT }} onClick={() => toggleGroup(g.id)}>
                      <div className="px-4 flex items-center gap-2 h-full" style={{ width: LEFT_PANE_WIDTH }}>
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className={`text-[#666] transition-transform ${row.isCollapsed ? '-rotate-90' : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                        {g.color && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />}
                        <span className="font-mono text-[10px] tracking-widest uppercase text-[#888]">{g.header}</span>
                        <span className="font-mono text-[10px] text-[#555] ml-1">{g.tasks.length}</span>
                      </div>
                    </div>
                  )
                }

                const task = row.task
                const s = getStatusDisplay(task.status)
                return (
                  <div key={task.id} className="flex items-center border-b border-[#333]/50 group hover:bg-[#252528] transition-colors" style={{ height: ROW_HEIGHT }}>
                    <div className={`px-4 truncate text-[12px] border-r border-[#333]/30 h-full flex items-center group-hover:text-[#f0f0f0] transition-colors ${s.text}`} style={{ width: colTask }}>
                      {task.title}
                    </div>
                    <div className="px-4 flex items-center gap-2 border-r border-[#333]/30 h-full" style={{ width: colStatus }}>
                       <svg width="8" height="8" viewBox="0 0 8 8" className="flex-shrink-0"><circle cx="4" cy="4" r="4" fill={s.color}/></svg>
                       <span className="font-mono text-[10px] text-[#a0a0a0] capitalize truncate">{task.status.replace('_', ' ')}</span>
                    </div>
                    <div className="px-4 flex gap-1 h-full items-center overflow-hidden" style={{ width: colLabels }}>
                       {task.labels.map(l => (
                         <span key={l} className="bg-[#2a2a2c] text-[#a0a0a0] px-1.5 py-0.5 rounded text-[9px] font-mono truncate max-w-full flex-shrink-0 border border-[#333]">
                           {l.split('/').pop()}
                         </span>
                       ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Pane (Timeline Grid) */}
          <div className="relative flex flex-col z-0 bg-[#1c1c1e]">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-[#1a1a1c]/95 backdrop-blur border-b border-[#333] h-[60px] flex flex-col shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
              {/* Months row */}
              <div className="flex h-[30px] border-b border-[#333]/50">
                {monthGroups.map((mg, i) => (
                  <div key={i} className="font-mono text-[10px] text-[#888] uppercase tracking-widest px-3 truncate flex-shrink-0 border-r border-[#333]/50 h-full flex items-center" style={{ width: mg.dayCount * DAY_WIDTH }}>
                    {mg.name}
                  </div>
                ))}
              </div>
              {/* Days row */}
              <div className="flex h-[30px]">
                {days.map((day) => {
                  const isWknd = isWeekend(day)
                  const isTdy = isToday(day)
                  return (
                    <div
                      key={day.toISOString()}
                      className={`font-mono text-[9px] flex-shrink-0 border-r border-[#333]/30 h-full flex items-center justify-center
                        ${isWknd ? 'bg-[#252528]/50 text-[#555]' : 'text-[#888]'}
                        ${isTdy ? 'text-[#ef4444] font-bold bg-red-500/10' : ''}
                      `}
                      style={{ width: DAY_WIDTH }}
                    >
                      {format(day, 'd')}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Grid Body */}
            <div className="relative flex flex-col z-0">
              {/* Vertical Grid Lines (Background) */}
              <div className="absolute inset-0 flex pointer-events-none z-0">
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={`flex-shrink-0 border-r border-[#333]/30 h-full ${isWeekend(day) ? 'bg-[#252528]/30' : ''}`}
                    style={{ width: DAY_WIDTH }}
                  />
                ))}
              </div>

              {/* Today Vertical Line */}
              {isTodayInGrid && (
                <div
                  className="absolute top-0 bottom-0 border-l border-red-500/50 z-10 pointer-events-none"
                  style={{ left: todayLeft }}
                />
              )}

              {/* Task Rows */}
              <div className="relative z-10">
                {rows.map((row) => {
                  if (row.type === 'group-header') {
                    return (
                      <div key={`group-${row.group.id}`} className="w-full border-b border-[#333] bg-[#222225]/50 pointer-events-none" style={{ height: ROW_HEIGHT }} />
                    )
                  }

                  const task = row.task
                  const { left, width } = calculateTaskPosition(task)
                  const s = getStatusDisplay(task.status)
                  return (
                    <div key={task.id} className="relative w-full border-b border-[#333]/50 hover:bg-[#2a2a2c]/40 transition-colors group" style={{ height: ROW_HEIGHT }}>
                      {/* Colored Task Bar */}
                      <div
                        className={`absolute top-[8px] h-[24px] rounded-[3px] border ${s.bg} ${s.border} shadow-sm group-hover:brightness-110 transition-all`}
                        style={{ left, width }}
                        title={`Created: ${format(new Date(task.created_at), 'MMM d')}\nDue: ${format(new Date(task.due_date!), 'MMM d')}`}
                      />

                      {/* Task Title (Rendered beside the bar) */}
                      <div
                        className="absolute top-[12px] text-[11px] text-[#a0a0a0] group-hover:text-[#f0f0f0] transition-colors whitespace-nowrap pointer-events-none"
                        style={{ left: left + width + 8 }}
                      >
                        {task.title}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
