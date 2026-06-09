import { useEffect } from 'react'
import { useLocation } from './hooks/useLocation'
import MainWindow from './components/MainWindow'
import QuickAddPanel from './components/QuickAdd/QuickAddPanel'
import { useTaskStore } from './stores/taskStore'
import { useAttachmentCountStore } from './stores/attachmentCountStore'

export default function App() {
  const { isQuickAdd } = useLocation()
  const { labels, tasks, loadTasks, loadAllTasks, loadLabels, init } = useTaskStore()
  const { loadCounts } = useAttachmentCountStore()

  useEffect(() => {
    loadLabels()
    if (!isQuickAdd) {
      loadTasks()
      loadAllTasks()
      loadCounts()
      return init()
    }
  }, [isQuickAdd])

  // Re-initialise if the store was reset by HMR (labels will be empty mid-session)
  useEffect(() => {
    if (!isQuickAdd && labels.length === 0) {
      loadLabels()
      loadTasks()
      loadAllTasks()
    }
  }, [labels.length, isQuickAdd])

  return isQuickAdd ? <QuickAddPanel /> : <MainWindow />
}
