import { useEffect } from 'react'
import { useLocation } from './hooks/useLocation'
import MainWindow from './components/MainWindow'
import QuickAddPanel from './components/QuickAdd/QuickAddPanel'
import { useTaskStore } from './stores/taskStore'
import { useNoteStore } from './stores/noteStore'
import { useAttachmentCountStore } from './stores/attachmentCountStore'
import { useSubTaskCountStore } from './stores/subTaskCountStore'

export default function App() {
  const { isQuickAdd } = useLocation()
  const { labels, tasks, loadTasks, loadAllTasks, loadLabels, init } = useTaskStore()
  const { loadNotes, loadAllNotes, init: initNotes } = useNoteStore()
  const { loadCounts } = useAttachmentCountStore()
  const { loadCounts: loadSubTaskCounts } = useSubTaskCountStore()

  useEffect(() => {
    loadLabels()
    if (!isQuickAdd) {
      loadTasks()
      loadAllTasks()
      loadNotes()
      loadAllNotes()
      loadCounts()
      loadSubTaskCounts()
      const unsubTasks = init()
      const unsubNotes = initNotes()
      return () => { unsubTasks(); unsubNotes() }
    }
  }, [isQuickAdd])

  // Re-initialise if the store was reset by HMR (labels will be empty mid-session)
  useEffect(() => {
    if (!isQuickAdd && labels.length === 0) {
      loadLabels()
      loadTasks()
      loadAllTasks()
      loadNotes()
      loadAllNotes()
    }
  }, [labels.length, isQuickAdd])

  return isQuickAdd ? <QuickAddPanel /> : <MainWindow />
}
