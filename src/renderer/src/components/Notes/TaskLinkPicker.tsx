import { useState, useRef, useEffect, useMemo } from 'react'
import type { Task } from '../../../../shared/types'

interface Props {
  tasks: Task[]
  selectedTaskId: string | null
  onChange: (taskId: string | null) => void
}

export default function TaskLinkPicker({ tasks, selectedTaskId, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null

  const filtered = useMemo(() => {
    if (!query) return tasks.slice(0, 50)
    const q = query.toLowerCase()
    return tasks.filter(t => t.title.toLowerCase().includes(q)).slice(0, 50)
  }, [tasks, query])

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[12px] rounded-lg px-2.5 py-1.5 w-full text-left transition-colors bg-[#3a3a3c] hover:bg-[#48484a]"
      >
        <span className="text-[#8e8e93] flex-shrink-0">Task</span>
        {selectedTask ? (
          <span className="text-[#f2f2f7] text-[11px] truncate flex-1 min-w-0">{selectedTask.title}</span>
        ) : (
          <span className="text-[#636366] text-[11px]">None linked</span>
        )}
        {selectedTask && (
          <button
            onClick={e => { e.stopPropagation(); onChange(null) }}
            className="text-[#636366] hover:text-[#f2f2f7] text-[12px] leading-none flex-shrink-0"
          >
            ×
          </button>
        )}
        <span className="ml-auto text-[#636366] text-[10px] flex-shrink-0">▾</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-[#1c1c1e] border border-[#48484a] rounded-xl shadow-2xl overflow-hidden z-50" style={{ width: '340px', maxHeight: '360px' }}>
          <div className="p-2 border-b border-[#2c2c2e]">
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              placeholder="Search tasks..."
              className="w-full text-[13px] text-[#f2f2f7] placeholder-[#636366] bg-[#2c2c2e] rounded-lg px-3 py-2"
            />
          </div>
          <div className="overflow-y-auto p-2 space-y-0.5" style={{ maxHeight: '280px' }}>
            {filtered.length === 0 ? (
              <div className="text-center py-4 text-[#636366] text-[12px]">No tasks found</div>
            ) : (
              filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onChange(t.id); setOpen(false); setQuery('') }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-[13px] truncate transition-colors ${
                    t.id === selectedTaskId ? 'bg-[#3a3a3c] text-[#f2f2f7]' : 'text-[#ebebf5cc] hover:bg-[#2c2c2e]'
                  }`}
                >
                  {t.title}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
