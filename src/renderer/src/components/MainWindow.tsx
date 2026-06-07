import { useState, useCallback, useRef } from 'react'
import Sidebar from './Sidebar/Sidebar'
import KanbanBoard from './Kanban/KanbanBoard'
import ListView from './ListView/ListView'
import ReportsView from './Reports/ReportsView'
import FilesView from './Files/FilesView'
import TopBar from './shared/TopBar'
import { useTaskStore } from '../stores/taskStore'

const MIN_WIDTH = 160
const MAX_WIDTH = 400

export default function MainWindow() {
  const { viewMode } = useTaskStore()
  const [sidebarWidth, setSidebarWidth] = useState(208)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = ev.clientX - startX.current
      setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  return (
    <div className="flex h-screen bg-[#1c1c1e] overflow-hidden">
      <Sidebar width={sidebarWidth} />

      {/* Resize handle */}
      <div
        className="w-1 flex-shrink-0 cursor-col-resize hover:bg-[#c45d2e]/40 transition-colors active:bg-[#c45d2e]/60 z-10"
        style={{ background: 'transparent' }}
        onMouseDown={onMouseDown}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        {viewMode === 'kanban' ? <KanbanBoard /> : viewMode === 'list' ? <ListView /> : viewMode === 'reports' ? <ReportsView /> : <FilesView />}
      </div>
    </div>
  )
}
