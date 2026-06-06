import { useState } from 'react'
import { useTaskStore } from '../../stores/taskStore'
import type { LabelNode, Task } from '../../../../shared/types'

function collectIds(node: LabelNode): string[] {
  return [node.id, ...node.children.flatMap(collectIds)]
}

function countTasks(node: LabelNode, tasks: Task[]): number {
  const ids = new Set(collectIds(node))
  return tasks.filter(t => t.labels.some(l => ids.has(l))).length
}

const depthTextClass = (depth: number, isActive: boolean) => {
  if (isActive) return 'text-[#c45d2e]'
  if (depth === 0) return 'text-[#d4d4d4] font-medium'
  if (depth === 1) return 'text-[#a8a8a8]'
  return 'text-[#888888]'
}

function LabelRow({ node, depth, tasks }: { node: LabelNode; depth: number; tasks: Task[] }) {
  const [expanded, setExpanded] = useState(false)
  const { activeLabel, setActiveLabel } = useTaskStore()
  const hasChildren = node.children.length > 0
  const isActive = activeLabel === node.id
  const count = countTasks(node, tasks)

  return (
    <div>
      <button
        onClick={() => { setActiveLabel(node.id); if (hasChildren) setExpanded(e => !e) }}
        className={`w-full flex items-center gap-2 py-1.5 px-2 rounded text-left transition-colors group ${
          isActive ? 'bg-[#3d2218]/60' : 'hover:bg-[#2a2a2a]'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {/* Chevron */}
        <span
          className={`font-mono text-[9px] transition-transform flex-shrink-0 ${
            hasChildren ? 'text-[#555555] group-hover:text-[#b0b0b0]' : 'opacity-0'
          } ${expanded ? 'rotate-90' : ''}`}
          onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
        >▶</span>

        {/* Colour dot */}
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: node.colour }} />

        {/* Name */}
        <span className={`font-mono text-[11px] tracking-wide truncate flex-1 transition-colors group-hover:text-[#f0f0f0] ${depthTextClass(depth, isActive)}`}>
          {node.name}
        </span>

        {/* Count badge — cumulative across this node and all descendants */}
        {count > 0 && (
          <span
            className="font-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ml-1"
            style={{ backgroundColor: node.colour + '22', color: node.colour }}
          >
            {count}
          </span>
        )}
      </button>

      {expanded && hasChildren && (
        <div>
          {node.children.map(child => <LabelRow key={child.id} node={child} depth={depth + 1} tasks={tasks} />)}
        </div>
      )}
    </div>
  )
}

export default function LabelTree() {
  const { labels, allTasks } = useTaskStore()
  if (!labels.length) return <div className="font-mono text-[11px] text-[#6b7280] px-3 py-2">Loading…</div>
  return (
    <div className="space-y-0.5">
      {labels.map(node => <LabelRow key={node.id} node={node} depth={0} tasks={allTasks} />)}
    </div>
  )
}
