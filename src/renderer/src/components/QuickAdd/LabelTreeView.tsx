import { useState, useRef, useEffect } from 'react'
import type { LabelNode } from '../../../../shared/types'

interface Props {
  labels: LabelNode[]
  selected: string[]
  onChange: (labels: string[]) => void
}

function TreeRow({
  node, selected, onToggle, depth, query
}: {
  node: LabelNode
  selected: string[]
  onToggle: (id: string) => void
  depth: number
  query: string
}) {
  const hasChildren = node.children.length > 0
  const isChecked = selected.includes(node.id)
  const [open, setOpen] = useState(depth === 0)

  useEffect(() => { if (query) setOpen(true) }, [query])

  const matches = (n: LabelNode): boolean =>
    n.name.toLowerCase().includes(query.toLowerCase()) ||
    n.children.some(matches)

  if (query && !matches(node)) return null

  return (
    <div>
      <div
        className={`flex items-center gap-2.5 py-2 px-3 cursor-pointer transition-colors rounded-lg mx-1 ${
          isChecked ? 'bg-[#3d2218]/60' : 'hover:bg-[#2a2a2a]'
        }`}
        style={{ paddingLeft: `${12 + depth * 18}px` }}
        onClick={() => onToggle(node.id)}
      >
        {/* Expand toggle */}
        <button
          className={`w-3 h-3 flex items-center justify-center flex-shrink-0 transition-transform ${
            hasChildren ? 'opacity-40 hover:opacity-100' : 'opacity-0 pointer-events-none'
          } ${open ? 'rotate-90' : ''}`}
          onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        >
          <span className="font-mono text-[9px] text-[#f0f0f0]">▶</span>
        </button>

        {/* Colour dot */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: node.colour }}
        />

        {/* Name */}
        <span className={`font-mono text-[12px] flex-1 truncate tracking-wide ${
          isChecked ? 'text-[#f0f0f0]' : 'text-[#a8a8c0]'
        }`}>
          {node.name}
        </span>

        {/* Check */}
        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all text-[10px] ${
          isChecked
            ? 'border-[#c45d2e] bg-[#c45d2e] text-[#f0f0f0]'
            : 'border-[#333333]'
        }`}>
          {isChecked && '✓'}
        </span>
      </div>

      {open && hasChildren && (
        <div className="border-l border-[#333333] ml-6 pl-0">
          {node.children.map(child => (
            <TreeRow
              key={child.id}
              node={child}
              selected={selected}
              onToggle={onToggle}
              depth={depth + 1}
              query={query}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function LabelTreeView({ labels, selected, onChange }: Props) {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] rounded-lg border border-[#333333]">
          <span className="font-mono text-[11px] text-[#6b7280]">›</span>
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            placeholder="Search labels..."
            className="flex-1 bg-transparent text-[12px] font-mono text-[#f0f0f0] placeholder-[#6b7280]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#6b7280] hover:text-[#f0f0f0] text-[11px]">✕</button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {labels.map(node => (
          <TreeRow
            key={node.id}
            node={node}
            selected={selected}
            onToggle={toggle}
            depth={0}
            query={query}
          />
        ))}
      </div>
    </div>
  )
}
