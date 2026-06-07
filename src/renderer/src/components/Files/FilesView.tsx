import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import type { FileEntry } from '../../../../shared/types'
import { useTaskStore } from '../../stores/taskStore'

// ── Icons ─────────────────────────────────────────────────────────────────────

function FolderIcon() {
  return (
    <svg width="15" height="13" viewBox="0 0 15 13" fill="currentColor" className="flex-shrink-0 text-[#FFC400]">
      <path d="M0 2.5C0 1.67 .67 1 1.5 1H5.5L7 2.5H13.5C14.33 2.5 15 3.17 15 4V11C15 11.83 14.33 12.5 13.5 12.5H1.5C.67 12.5 0 11.83 0 11V2.5Z"/>
    </svg>
  )
}

function FileTypeIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  let color = '#6b7280'
  if (ext === 'pdf') color = '#FC2847'
  else if (['doc','docx','txt','md'].includes(ext)) color = '#4a9eca'
  else if (['xls','xlsx','csv'].includes(ext)) color = '#30D158'
  else if (['ppt','pptx'].includes(ext)) color = '#FF9300'
  else if (['jpg','jpeg','png','gif','svg','webp','heic'].includes(ext)) color = '#BF5AF2'
  else if (['mp4','mov','m4v','avi'].includes(ext)) color = '#FF6B6B'
  else if (['mp3','m4a','wav','aac'].includes(ext)) color = '#4a9eca'
  else if (['zip','tar','gz','rar'].includes(ext)) color = '#888888'

  return (
    <svg width="12" height="15" viewBox="0 0 12 15" fill="none" className="flex-shrink-0">
      <path d="M1.5 0C.67 0 0 .67 0 1.5V13.5C0 14.33.67 15 1.5 15H10.5C11.33 15 12 14.33 12 13.5V4.5L7.5 0H1.5Z" fill={color} opacity=".65"/>
      <path d="M7.5 0L12 4.5H7.5V0Z" fill={color} opacity=".35"/>
    </svg>
  )
}

function RevealIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
      <rect x=".5" y="3.5" width="8" height="8" rx=".8" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M4 .5H11.5V8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.5.5 5 7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes === 0)    return '0 B'
  if (bytes < 1024)   return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'MMM d, yy') } catch { return '—' }
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const segments = path ? path.split('/') : []
  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      <button
        onClick={() => onNavigate('')}
        className={`font-mono text-[10px] transition-colors flex-shrink-0 ${
          segments.length === 0 ? 'text-[#c45d2e]' : 'text-[#555555] hover:text-[#c45d2e]'
        }`}
      >
        My Drive
      </button>
      {segments.map((seg, i) => {
        const segPath = segments.slice(0, i + 1).join('/')
        const isLast = i === segments.length - 1
        return (
          <span key={segPath} className="flex items-center gap-1 min-w-0">
            <span className="font-mono text-[10px] text-[#333333] flex-shrink-0">/</span>
            {isLast ? (
              <span className="font-mono text-[10px] text-[#c45d2e] truncate max-w-[200px]">{seg}</span>
            ) : (
              <button
                onClick={() => onNavigate(segPath)}
                className="font-mono text-[10px] text-[#555555] hover:text-[#c45d2e] transition-colors truncate max-w-[160px]"
              >
                {seg}
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function FilesView() {
  const { activeLabel, loadLabels } = useTaskStore()
  const [currentPath, setCurrentPath] = useState(activeLabel ?? '')
  const [entries, setEntries] = useState<FileEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  // Navigate to the new label's folder when the selection changes
  useEffect(() => {
    if (activeLabel !== null) setCurrentPath(activeLabel)
  }, [activeLabel])

  // Load directory whenever the path changes
  useEffect(() => {
    setLoading(true)
    setMissing(false)
    window.api.files.list(currentPath).then(result => {
      if (result === null) {
        setMissing(true)
        setEntries(null)
      } else {
        setEntries(result)
      }
      setLoading(false)
    })
  }, [currentPath])

  const handleClick = async (entry: FileEntry) => {
    if (entry.isDirectory) {
      setCurrentPath(entry.relativePath)
    } else {
      await window.api.files.open(entry.relativePath)
    }
  }

  const handleReveal = async (e: React.MouseEvent, entry: FileEntry) => {
    e.stopPropagation()
    await window.api.files.reveal(entry.relativePath)
  }

  const startCreatingFolder = () => {
    setNewFolderName('')
    setCreatingFolder(true)
    setTimeout(() => newFolderInputRef.current?.focus(), 0)
  }

  const cancelCreatingFolder = () => {
    setCreatingFolder(false)
    setNewFolderName('')
  }

  const confirmNewFolder = async () => {
    const name = newFolderName.trim()
    if (!name) { cancelCreatingFolder(); return }
    const relativePath = currentPath ? `${currentPath}/${name}` : name
    const result = await window.api.files.mkdir(relativePath)
    cancelCreatingFolder()
    if (result.created) {
      // Refresh file list — the labels:changed event from main handles sidebar
      const updated = await window.api.files.list(currentPath)
      if (updated !== null) setEntries(updated)
      // Also re-sync labels in the store in case the event hasn't fired yet
      await loadLabels()
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-4">

        {/* Breadcrumb bar */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#272727]">
          {currentPath && (
            <button
              onClick={() => {
                const parent = currentPath.includes('/') ? currentPath.slice(0, currentPath.lastIndexOf('/')) : ''
                setCurrentPath(parent)
              }}
              className="flex-shrink-0 text-[#555555] hover:text-[#f0f0f0] transition-colors"
              title="Go up"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M8 2.5L4 6.5L8 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <Breadcrumb path={currentPath} onNavigate={setCurrentPath} />
          <div className="flex-1" />
          <button
            onClick={startCreatingFolder}
            title="New folder"
            className="flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] text-[#555555] hover:text-[#f0f0f0] border border-[#333333] hover:border-[#444444] rounded transition-colors flex-shrink-0"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <rect x="4" y="0" width="2" height="10" rx="1"/>
              <rect x="0" y="4" width="10" height="2" rx="1"/>
            </svg>
            New Folder
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-32">
            <p className="font-mono text-[11px] text-[#3a3a3a]">Loading…</p>
          </div>
        )}

        {/* Folder not found */}
        {!loading && missing && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="font-mono text-[11px] text-[#3a3a3a]">Folder not found in Google Drive</p>
            <p className="font-mono text-[10px] text-[#2e2e2e]">{currentPath || 'My Drive'}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !missing && entries?.length === 0 && !creatingFolder && (
          <div className="flex items-center justify-center h-32">
            <p className="font-mono text-[11px] text-[#3a3a3a]">Empty folder</p>
          </div>
        )}

        {/* File list */}
        {!loading && !missing && (entries !== null) && (entries.length > 0 || creatingFolder) && (
          <div>
            {/* Column header */}
            <div className="flex items-center gap-3 px-3 mb-1">
              <div className="w-4 flex-shrink-0" />
              <div className="flex-1 font-mono text-[9px] uppercase tracking-widest text-[#3a3a3a]">Name</div>
              <div className="w-20 text-right font-mono text-[9px] uppercase tracking-widest text-[#3a3a3a] flex-shrink-0">Size</div>
              <div className="w-24 text-right font-mono text-[9px] uppercase tracking-widest text-[#3a3a3a] flex-shrink-0">Modified</div>
              <div className="w-6 flex-shrink-0" />
            </div>

            {/* Inline new-folder row */}
            {creatingFolder && (
              <div>
                <div className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg bg-[#242424]">
                  <div className="w-4 flex items-center justify-center flex-shrink-0">
                    <FolderIcon />
                  </div>
                  <input
                    ref={newFolderInputRef}
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); confirmNewFolder() }
                      if (e.key === 'Escape') cancelCreatingFolder()
                      e.stopPropagation()
                    }}
                    onBlur={cancelCreatingFolder}
                    placeholder="Folder name"
                    className="flex-1 bg-transparent font-mono text-[12px] text-[#f0f0f0] placeholder-[#3a3a3a] focus:outline-none border-b border-[#c45d2e]/60"
                  />
                </div>
                {entries && entries.length > 0 && <div className="h-px bg-[#272727]" />}
              </div>
            )}

            {entries && entries.map((entry, i) => (
              <div key={entry.relativePath} className="group">
                <div
                  className="flex items-center gap-3 py-2.5 px-3 -mx-3 cursor-pointer rounded-lg hover:bg-[#242424] transition-colors"
                  onClick={() => handleClick(entry)}
                >
                  {/* Icon */}
                  <div className="w-4 flex items-center justify-center flex-shrink-0">
                    {entry.isDirectory ? <FolderIcon /> : <FileTypeIcon name={entry.name} />}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <span className={`font-mono text-[12px] truncate block ${
                      entry.isDirectory ? 'text-[#e0e0e0]' : 'text-[#b0b0b0]'
                    }`}>
                      {entry.name}
                    </span>
                  </div>

                  {/* Size */}
                  <div className="w-20 text-right font-mono text-[10px] text-[#444444] flex-shrink-0">
                    {entry.isDirectory ? '—' : formatSize(entry.size)}
                  </div>

                  {/* Modified */}
                  <div className="w-24 text-right font-mono text-[10px] text-[#444444] flex-shrink-0">
                    {formatDate(entry.modifiedAt)}
                  </div>

                  {/* Reveal in Finder */}
                  <button
                    onClick={e => handleReveal(e, entry)}
                    title="Reveal in Finder"
                    className="w-6 flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[#555555] hover:text-[#f0f0f0]"
                  >
                    <RevealIcon />
                  </button>
                </div>
                {i < entries.length - 1 && <div className="h-px bg-[#272727]" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
