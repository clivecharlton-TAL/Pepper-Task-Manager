import { useState, useMemo } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addWeeks, addMonths, format, isToday, isSameMonth,
  parseISO, eachDayOfInterval, differenceInCalendarDays,
} from 'date-fns'
import type { Task, TaskPriority, LabelNode } from '../../../../shared/types'
import { useTaskStore } from '../../stores/taskStore'
import TaskDetailModal from '../Kanban/TaskDetailModal'
import { matchesHiddenTags, matchesAssignedToMe } from '../../utils/listHelpers'

const DATE_DROP_PREFIX = 'date:'

type SubView = 'month' | 'week' | 'agenda'

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_CHIP: Record<TaskPriority, { bg: string; border: string }> = {
  high:   { bg: 'rgba(252,40,71,0.14)',  border: '#FC2847' },
  medium: { bg: 'rgba(255,196,0,0.11)',  border: '#FFC400' },
  low:    { bg: 'rgba(48,209,88,0.09)',  border: '#30D158' },
}

const DAY_ABBRS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenLabels(nodes: LabelNode[]): LabelNode[] {
  const out: LabelNode[] = []
  const walk = (arr: LabelNode[]) => arr.forEach(n => { out.push(n); walk(n.children) })
  walk(nodes)
  return out
}

function getTasksForDate(tasks: Task[], dateStr: string): Task[] {
  return tasks.filter(t => t.due_date?.slice(0, 10) === dateStr)
}

// ── Task chip (compact, used in month + week cells) ───────────────────────────

function TaskChip({ task, onOpen, small = true }: { task: Task; onOpen: (t: Task) => void; small?: boolean }) {
  const isDone = task.status === 'done'
  const { bg, border } = PRIORITY_CHIP[task.priority]
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={e => { e.stopPropagation(); onOpen(task) }}
      className={`w-full text-left rounded flex items-center gap-1 hover:opacity-75 transition-opacity cursor-grab active:cursor-grabbing ${small ? 'px-1.5 py-[3px]' : 'px-2 py-1.5'}`}
      style={{ ...style, backgroundColor: isDone ? 'rgba(255,255,255,0.03)' : bg, borderLeft: `2px solid ${isDone ? '#333' : border}` }}
    >
      <span className={`flex-1 font-mono truncate leading-none ${small ? 'text-[10px]' : 'text-[11px]'} ${isDone ? 'line-through text-[#3a3a3a]' : 'text-[#cccccc]'}`}>
        {task.title}
      </span>
    </button>
  )
}

// ── Month: single day cell ────────────────────────────────────────────────────

const MAX_CHIPS = 3

function DayCell({ date, dateStr, tasks, inMonth, onOpen }: {
  date: Date; dateStr: string; tasks: Task[]; inMonth: boolean; onOpen: (t: Task) => void
}) {
  const today = isToday(date)
  const visible = tasks.slice(0, MAX_CHIPS)
  const overflow = tasks.length - MAX_CHIPS
  const { setNodeRef, isOver } = useDroppable({ id: `${DATE_DROP_PREFIX}${dateStr}` })

  return (
    <div
      ref={setNodeRef}
      className={`border-r border-b border-[#222222] flex flex-col p-1.5 gap-1 transition-colors ${
        isOver ? 'bg-[#c45d2e]/[0.12]' : today ? 'bg-[#c45d2e]/[0.06]' : ''
      }`}
    >
      {/* Day number */}
      <div className="flex justify-end mb-0.5">
        <span className={`font-mono text-[11px] flex items-center justify-center w-[18px] h-[18px] rounded-full leading-none flex-shrink-0 ${
          today
            ? 'bg-[#c45d2e] text-white font-bold text-[10px]'
            : inMonth ? 'text-[#666666]' : 'text-[#303030]'
        }`}>
          {format(date, 'd')}
        </span>
      </div>

      {/* Chips */}
      <div className="flex flex-col gap-0.5">
        {visible.map(t => <TaskChip key={t.id} task={t} onOpen={onOpen} small />)}
        {overflow > 0 && (
          <span className="font-mono text-[9px] text-[#444444] pl-1.5 leading-none py-0.5">+{overflow} more</span>
        )}
      </div>
    </div>
  )
}

// ── Month view ─────────────────────────────────────────────────────────────────

function MonthView({ tasks, currentDate, onOpen }: { tasks: Task[]; currentDate: Date; onOpen: (t: Task) => void }) {
  const monthStart  = startOfMonth(currentDate)
  const monthEnd    = endOfMonth(currentDate)
  const gridStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd     = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days        = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const numRows     = days.length / 7

  return (
    <div className="flex flex-col flex-1 overflow-hidden border-l border-t border-[#222222]">
      {/* Day name header */}
      <div className="grid grid-cols-7 border-b border-[#222222] flex-shrink-0">
        {DAY_ABBRS.map(d => (
          <div key={d} className="py-2 text-center font-mono text-[9px] tracking-widest uppercase text-[#333333] border-r border-[#222222] last:border-r-0">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-7 flex-1 overflow-y-auto"
        style={{ gridTemplateRows: `repeat(${numRows}, minmax(90px, 1fr))` }}
      >
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          return (
            <DayCell
              key={dateStr}
              date={day}
              dateStr={dateStr}
              tasks={getTasksForDate(tasks, dateStr)}
              inMonth={isSameMonth(day, currentDate)}
              onOpen={onOpen}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Week: single day column ───────────────────────────────────────────────────

function WeekDayColumn({ dateStr, tasks, today, onOpen }: {
  dateStr: string; tasks: Task[]; today: boolean; onOpen: (t: Task) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${DATE_DROP_PREFIX}${dateStr}` })

  return (
    <div
      ref={setNodeRef}
      className={`border-r border-b border-[#222222] p-2 flex flex-col gap-1 min-h-[200px] transition-colors ${
        isOver ? 'bg-[#c45d2e]/[0.12]' : today ? 'bg-[#c45d2e]/[0.04]' : ''
      }`}
    >
      {tasks.map(t => <TaskChip key={t.id} task={t} onOpen={onOpen} small={false} />)}
    </div>
  )
}

// ── Week view ──────────────────────────────────────────────────────────────────

function WeekView({ tasks, currentDate, onOpen }: { tasks: Task[]; currentDate: Date; onOpen: (t: Task) => void }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate, { weekStartsOn: 1 }) })

  return (
    <div className="flex flex-col flex-1 overflow-hidden border-l border-t border-[#222222]">
      {/* Day column headers */}
      <div className="grid grid-cols-7 border-b border-[#222222] flex-shrink-0">
        {days.map(day => {
          const today = isToday(day)
          return (
            <div key={day.toISOString()} className={`py-3 border-r border-[#222222] last:border-r-0 flex flex-col items-center gap-0.5 ${today ? 'bg-[#c45d2e]/[0.06]' : ''}`}>
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#333333]">{format(day, 'EEE')}</span>
              <span className={`font-mono text-[20px] font-bold leading-none ${today ? 'text-[#c45d2e]' : 'text-[#666666]'}`}>
                {format(day, 'd')}
              </span>
              <span className="font-mono text-[9px] text-[#333333]">{format(day, 'MMM')}</span>
            </div>
          )
        })}
      </div>

      {/* Task columns */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          return (
            <WeekDayColumn
              key={dateStr}
              dateStr={dateStr}
              tasks={getTasksForDate(tasks, dateStr)}
              today={isToday(day)}
              onOpen={onOpen}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Agenda row ────────────────────────────────────────────────────────────────

function AgendaRow({ task, onOpen, showDate }: { task: Task; onOpen: (t: Task) => void; showDate?: boolean }) {
  const { border } = PRIORITY_CHIP[task.priority]
  const isDone = task.status === 'done'
  const isOverdue = !isDone && task.due_date && task.due_date.slice(0, 10) < format(new Date(), 'yyyy-MM-dd')

  return (
    <div
      onClick={() => onOpen(task)}
      className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-[#242424] cursor-pointer transition-colors group"
    >
      <div className="w-0.5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: isDone ? '#2a2a2a' : border }} />

      <div className="flex-1 min-w-0">
        <div className={`font-mono text-[12px] leading-snug ${isDone ? 'line-through text-[#3a3a3a]' : isOverdue ? 'text-[#f0f0f0]' : 'text-[#d0d0d0]'}`}>
          {task.title}
        </div>
        {showDate && task.due_date && (
          <div className="font-mono text-[10px] text-[#FC2847] mt-0.5">
            Was due {format(parseISO(task.due_date), 'MMM d')}
          </div>
        )}
      </div>

      <span className="font-mono text-[9px] uppercase tracking-widest text-[#333333] flex-shrink-0 group-hover:text-[#555555] transition-colors">
        {task.status.replace('_', ' ')}
      </span>
    </div>
  )
}

// ── Agenda view ───────────────────────────────────────────────────────────────

function AgendaView({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const overdue = useMemo(() =>
    tasks.filter(t => t.due_date && t.due_date.slice(0, 10) < todayStr && t.status !== 'done')
      .sort((a, b) => a.due_date! < b.due_date! ? -1 : 1),
    [tasks, todayStr]
  )

  const upcoming = useMemo(() =>
    tasks.filter(t => t.due_date && t.due_date.slice(0, 10) >= todayStr)
      .sort((a, b) => a.due_date! < b.due_date! ? -1 : 1),
    [tasks, todayStr]
  )

  // Group upcoming by date
  const groups = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const t of upcoming) {
      const ds = t.due_date!.slice(0, 10)
      ;(map[ds] ??= []).push(t)
    }
    return Object.entries(map).sort(([a], [b]) => a < b ? -1 : 1).map(([ds, ts]) => ({
      dateStr: ds,
      date: parseISO(ds),
      tasks: ts,
    }))
  }, [upcoming])

  if (overdue.length === 0 && upcoming.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p className="font-mono text-[11px] text-[#3a3a3a]">No upcoming tasks with due dates</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-5 space-y-7 max-w-3xl mx-auto w-full">
      {overdue.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <span className="font-mono text-[9px] tracking-widest uppercase text-[#FC2847]">Overdue</span>
            <div className="flex-1 h-px bg-[#FC2847]/20" />
            <span className="font-mono text-[9px] text-[#FC2847]">{overdue.length}</span>
          </div>
          <div className="space-y-0.5">
            {overdue.map(t => <AgendaRow key={t.id} task={t} onOpen={onOpen} showDate />)}
          </div>
        </section>
      )}

      {groups.map(g => {
        const today = isToday(g.date)
        const daysOut = differenceInCalendarDays(g.date, new Date())
        const label = today
          ? `Today · ${format(g.date, 'EEE, MMM d')}`
          : daysOut === 1
            ? `Tomorrow · ${format(g.date, 'EEE, MMM d')}`
            : format(g.date, 'EEEE · MMM d')

        return (
          <section key={g.dateStr}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`font-mono text-[9px] tracking-widest uppercase ${today ? 'text-[#c45d2e]' : 'text-[#555555]'}`}>
                {label}
              </span>
              <div className={`flex-1 h-px ${today ? 'bg-[#c45d2e]/25' : 'bg-[#222222]'}`} />
              <span className={`font-mono text-[9px] ${today ? 'text-[#c45d2e]' : 'text-[#333333]'}`}>{g.tasks.length}</span>
            </div>
            <div className="space-y-0.5">
              {g.tasks.map(t => <AgendaRow key={t.id} task={t} onOpen={onOpen} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ── Unscheduled sidebar ───────────────────────────────────────────────────────

function UnscheduledRow({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { border } = PRIORITY_CHIP[task.priority]
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#252525] transition-colors group cursor-grab active:cursor-grabbing"
    >
      <div className="w-0.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: border }} />
      <span className="font-mono text-[10px] text-[#666666] truncate flex-1 group-hover:text-[#c0c0c0] transition-colors leading-snug">
        {task.title}
      </span>
    </button>
  )
}

function UnscheduledSidebar({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  return (
    <div className="w-52 flex-shrink-0 border-l border-[#222222] flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-[#222222] flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#444444]">Unscheduled</span>
        <span className="font-mono text-[9px] text-[#333333]">{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
        {tasks.map(task => <UnscheduledRow key={task.id} task={task} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

// ── Calendar header ───────────────────────────────────────────────────────────

function CalendarHeader({ subView, onSubView, currentDate, onNavigate }: {
  subView: SubView
  onSubView: (s: SubView) => void
  currentDate: Date
  onNavigate: (d: Date) => void
}) {
  const heading = subView === 'month'
    ? format(currentDate, 'MMMM yyyy')
    : subView === 'week'
      ? (() => {
          const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
          const we = endOfWeek(currentDate, { weekStartsOn: 1 })
          return isSameMonth(ws, we)
            ? `${format(ws, 'MMM d')} – ${format(we, 'd, yyyy')}`
            : `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`
        })()
      : 'Upcoming'

  const goBack = () => {
    if (subView === 'month') onNavigate(addMonths(currentDate, -1))
    else if (subView === 'week') onNavigate(addWeeks(currentDate, -1))
  }
  const goForward = () => {
    if (subView === 'month') onNavigate(addMonths(currentDate, 1))
    else if (subView === 'week') onNavigate(addWeeks(currentDate, 1))
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-[#252525] flex-shrink-0">
      {/* Prev / Next */}
      {subView !== 'agenda' && (
        <div className="flex items-center gap-0.5">
          <button onClick={goBack} className="p-1.5 rounded text-[#555555] hover:text-[#e0e0e0] hover:bg-[#2a2a2a] transition-colors">
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
              <path d="M5 1L1 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={goForward} className="p-1.5 rounded text-[#555555] hover:text-[#e0e0e0] hover:bg-[#2a2a2a] transition-colors">
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
              <path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Heading */}
      <span className="font-mono text-[13px] text-[#c0c0c0] font-medium w-52 flex-shrink-0">{heading}</span>

      {/* Today */}
      {subView !== 'agenda' && (
        <button
          onClick={() => onNavigate(new Date())}
          className="font-mono text-[10px] px-2.5 py-1 rounded border border-[#2e2e2e] text-[#555555] hover:border-[#444444] hover:text-[#888888] transition-colors"
        >
          Today
        </button>
      )}

      <div className="flex-1" />

      {/* Sub-view switcher */}
      <div className="flex items-center bg-[#232323] border border-[#2e2e2e] rounded p-0.5 gap-0.5">
        {(['month', 'week', 'agenda'] as SubView[]).map(sv => (
          <button
            key={sv}
            onClick={() => onSubView(sv)}
            className={`font-mono text-[10px] px-2.5 py-1 rounded capitalize transition-colors ${
              subView === sv ? 'bg-[#363636] text-[#c45d2e]' : 'text-[#555555] hover:text-[#a0a0a0]'
            }`}
          >
            {sv}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CalendarView() {
  const { tasks, labels, activePriority, activeStatus, assignedToMe, searchQuery, hiddenTags } = useTaskStore()
  const [subView, setSubView] = useState<SubView>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  const flatLabels = useMemo(() => flattenLabels(labels), [labels])

  const filtered = useMemo(() => tasks.filter(t => {
    if (activePriority && t.priority !== activePriority) return false
    if (activeStatus  && t.status   !== activeStatus)   return false
    if (assignedToMe  && !matchesAssignedToMe(t))       return false
    if (matchesHiddenTags(t, hiddenTags)) return false
    if (searchQuery) {
      const s = searchQuery.toLowerCase()
      if (!t.title.toLowerCase().includes(s) &&
          !t.notes?.toLowerCase().includes(s) &&
          !t.labels.some(id => id.toLowerCase().includes(s)) &&
          !t.labels.some(id => flatLabels.find(l => l.id === id)?.name.toLowerCase().includes(s))) {
        return false
      }
    }
    return true
  }), [tasks, activePriority, activeStatus, assignedToMe, searchQuery, flatLabels, hiddenTags])

  const scheduledTasks   = useMemo(() => filtered.filter(t => t.due_date), [filtered])
  const unscheduledTasks = useMemo(() => filtered.filter(t => !t.due_date && t.status !== 'done'), [filtered])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <CalendarHeader
        subView={subView}
        onSubView={setSubView}
        currentDate={currentDate}
        onNavigate={setCurrentDate}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {subView === 'month'  && <MonthView  tasks={scheduledTasks} currentDate={currentDate} onOpen={setDetailTask} />}
          {subView === 'week'   && <WeekView   tasks={scheduledTasks} currentDate={currentDate} onOpen={setDetailTask} />}
          {subView === 'agenda' && <AgendaView tasks={scheduledTasks} onOpen={setDetailTask} />}
        </div>

        {unscheduledTasks.length > 0 && (
          <UnscheduledSidebar tasks={unscheduledTasks} onOpen={setDetailTask} />
        )}
      </div>

      {detailTask && <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />}
    </div>
  )
}
