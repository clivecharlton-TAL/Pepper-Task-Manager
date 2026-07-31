import type { Task, LabelNode, TaskStatus, TaskPriority } from '../../../shared/types'
import { type ListSort, type ListGroup, type DueFilter } from '../stores/taskStore'
import { PRIORITY_RANK } from '../../../shared/taskPriority'
import { isMe } from '../../../shared/team'

export { matchesDue } from '../../../shared/dateFilters'
export { PRIORITY_RANK }

export function flattenLabels(nodes: LabelNode[]): LabelNode[] {
  const out: LabelNode[] = []
  const walk = (arr: LabelNode[]) => arr.forEach(n => { out.push(n); walk(n.children) })
  walk(nodes)
  return out
}

export function matchesSearch(task: Task, q: string, flat: LabelNode[]): boolean {
  const s = q.toLowerCase()
  if (task.title.toLowerCase().includes(s)) return true
  if (task.notes?.toLowerCase().includes(s)) return true
  if (task.labels.some(id => id.toLowerCase().includes(s))) return true
  if (task.labels.some(id => flat.find(l => l.id === id)?.name.toLowerCase().includes(s))) return true
  if ((task.assigned ?? []).some(name => name.toLowerCase().includes(s))) return true
  return false
}

export function matchesAssignedToMe(task: Task): boolean {
  return (task.assigned ?? []).some(isMe)
}

export function matchesHiddenTags(task: Task, hiddenTags: string[]): boolean {
  if (hiddenTags.length === 0) return false
  return task.labels.some(id => hiddenTags.includes(id))
}

export function sortByDue(a: Task, b: Task): number {
  if (!a.due_date && !b.due_date) return 0
  if (!a.due_date) return 1
  if (!b.due_date) return -1
  return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
}

export function applySortFn(sort: ListSort): (a: Task, b: Task) => number {
  switch (sort) {
    case 'priority': return (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    case 'created':  return (a, b) => (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : 0)
    case 'title':    return (a, b) => a.title.localeCompare(b.title)
    default:         return sortByDue
  }
}

export type Group = { id: string; header: string; tasks: Task[]; color?: string }

export function computeGroups(tasks: Task[], group: ListGroup, flat: LabelNode[]): Group[] {
  if (group === 'priority') {
    const defs: { value: TaskPriority; header: string; color: string }[] = [
      { value: 'high',   header: 'High',   color: '#FC2847' },
      { value: 'medium', header: 'Medium', color: '#FFC400' },
      { value: 'low',    header: 'Low',    color: '#30D158' },
    ]
    return defs
      .map(d => ({ id: `priority-${d.value}`, header: d.header, color: d.color, tasks: tasks.filter(t => t.priority === d.value) }))
      .filter(g => g.tasks.length > 0)
  }

  if (group === 'status') {
    const defs: { value: TaskStatus; header: string; color: string }[] = [
      { value: 'backlog',     header: 'Backlog',     color: '#6b7280' },
      { value: 'todo',        header: 'To Do',       color: '#4a9eca' },
      { value: 'in_progress', header: 'In Progress', color: '#d4a843' },
      { value: 'done',        header: 'Done',        color: '#4caf82' },
    ]
    return defs
      .map(d => ({ id: `status-${d.value}`, header: d.header, color: d.color, tasks: tasks.filter(t => t.status === d.value) }))
      .filter(g => g.tasks.length > 0)
  }

  if (group === 'label') {
    const map = new Map<string, Task[]>()
    const unlabelled: Task[] = []

    tasks.forEach(t => {
      if (t.labels.length === 0) {
        unlabelled.push(t)
        return
      }
      t.labels.forEach(lId => {
        if (!map.has(lId)) map.set(lId, [])
        map.get(lId)!.push(t)
      })
    })

    const groups: Group[] = Array.from(map.entries()).map(([lId, arr]) => {
      const def = flat.find(n => n.id === lId)
      return {
        id: `label-${lId}`,
        header: def ? def.name : lId.split('/').pop() || lId,
        color: def?.colour || '#888888',
        tasks: arr,
      }
    })

    groups.sort((a, b) => a.header.localeCompare(b.header))
    if (unlabelled.length > 0) {
      groups.push({ id: 'unlabelled', header: 'Unlabelled', color: '#666666', tasks: unlabelled })
    }
    return groups
  }

  return []
}
