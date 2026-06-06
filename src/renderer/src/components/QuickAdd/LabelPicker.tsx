import { useState, useRef, useEffect } from 'react'
import type { LabelNode } from '../../../../shared/types'

interface Props {
  labels: LabelNode[]
  selected: string[]
  onChange: (labels: string[]) => void
}

interface TreeNodeProps {
  node: LabelNode
  selected: string[]
  onToggle: (id: string) => void
  query: string
}

function nodeMatchesQuery(node: LabelNode, query: string): boolean {
  if (!query) return true
  if (node.name.toLowerCase().includes(query.toLowerCase())) return true
  return node.children.some((c) => nodeMatchesQuery(c, query))
}

function TreeNode({ node, selected, onToggle, query }: TreeNodeProps) {
  const hasChildren = node.children.length > 0
  const isSelected = selected.includes(node.id)
  const isVisible = nodeMatchesQuery(node, query)
  const [expanded, setExpanded] = useState(hasChildren && !!query ? true : node.children.length > 0 && node.children.length <= 4)

  // Auto-expand when searching
  useEffect(() => {
    if (query) setExpanded(true)
  }, [query])

  if (!isVisible) return null

  const visibleChildren = node.children.filter((c) => nodeMatchesQuery(c, query))

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors group ${
          isSelected ? 'bg-[#3a3a3c]' : 'hover:bg-[#2c2c2e]'
        }`}
        onClick={() => onToggle(node.id)}
      >
        {/* Expand chevron — only shown for nodes with children */}
        <button
          className={`w-4 h-4 flex items-center justify-center flex-shrink-0 text-[10px] text-[#636366] transition-transform ${
            hasChildren ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } ${expanded ? 'rotate-90' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
        >
          ▶
        </button>

        {/* Colour dot */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: node.colour }}
        />

        {/* Label name */}
        <span className={`text-[13px] flex-1 truncate ${isSelected ? 'text-[#f2f2f7] font-medium' : 'text-[#ebebf5cc]'}`}>
          {node.name}
        </span>

        {/* Checkmark */}
        <span
          className={`w-4 h-4 rounded flex items-center justify-center text-[11px] flex-shrink-0 transition-all ${
            isSelected
              ? 'bg-[#007AFF] text-white'
              : 'border border-[#48484a] text-transparent group-hover:border-[#636366]'
          }`}
        >
          ✓
        </span>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="pl-5 border-l border-[#3a3a3c] ml-5 mt-0.5 mb-0.5">
          {visibleChildren.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selected={selected}
              onToggle={onToggle}
              query={query}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function LabelPicker({ labels, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closePicker()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  const openPicker = () => {
    setOpen(true)
    window.api.window.expandQuickAdd()
  }

  const closePicker = () => {
    setOpen(false)
    setQuery('')
    window.api.window.collapseQuickAdd()
  }

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  const getLabel = (id: string): LabelNode | undefined => {
    const walk = (nodes: LabelNode[]): LabelNode | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n
        const found = walk(n.children)
        if (found) return found
      }
    }
    return walk(labels)
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      {/* Trigger button */}
      <button
        onClick={() => open ? closePicker() : openPicker()}
        className="flex items-center gap-1.5 text-[12px] rounded-lg px-2.5 py-1.5 w-full text-left transition-colors bg-[#3a3a3c] hover:bg-[#48484a]"
      >
        <span className="text-[#8e8e93] flex-shrink-0">Label</span>
        {selected.length === 0 ? (
          <span className="text-[#636366] text-[11px]">None selected</span>
        ) : (
          <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
            {selected.slice(0, 3).map((id) => {
              const l = getLabel(id)
              if (!l) return null
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 font-medium flex-shrink-0"
                  style={{ backgroundColor: l.colour + '25', color: l.colour }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.colour }} />
                  {l.name}
                </span>
              )
            })}
            {selected.length > 3 && (
              <span className="text-[11px] text-[#636366]">+{selected.length - 3}</span>
            )}
          </div>
        )}
        <span className="ml-auto text-[#636366] text-[10px] flex-shrink-0">▾</span>
      </button>

      {/* Tree dropdown — opens upward */}
      {open && (
        <div className="absolute top-full left-0 mt-2 bg-[#1c1c1e] border border-[#48484a] rounded-xl shadow-2xl overflow-hidden z-50"
          style={{ width: '340px', maxHeight: '420px' }}
        >
          {/* Search */}
          <div className="p-2 border-b border-[#2c2c2e]">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Search labels..."
              className="w-full text-[13px] text-[#f2f2f7] placeholder-[#636366] bg-[#2c2c2e] rounded-lg px-3 py-2"
            />
          </div>

          {/* Selection summary */}
          {selected.length > 0 && (
            <div className="px-3 py-1.5 border-b border-[#2c2c2e] flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-[#636366]">{selected.length} selected</span>
              <button
                onClick={() => onChange([])}
                className="text-[11px] text-[#FC2847] hover:underline ml-auto"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Tree */}
          <div className="overflow-y-auto p-2 space-y-0.5" style={{ maxHeight: '320px' }}>
            {labels.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                selected={selected}
                onToggle={toggle}
                query={query}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
