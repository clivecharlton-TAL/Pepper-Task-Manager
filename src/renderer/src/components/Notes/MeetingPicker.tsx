import { useState, useEffect } from 'react'
import type { Meeting } from '../../../../shared/types'

interface Props {
  meetings: Meeting[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
  onSelect: (meeting: Meeting) => void
}

export function MeetingList({ meetings, isLoading, error, onRetry, onSelect }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[#888] font-mono text-[11px] py-3">
        <div className="w-3 h-3 border-2 border-[#c45d2e] border-t-transparent rounded-full animate-spin" />
        Loading calendar...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <span className="text-[#e0765a] font-mono text-[11px]">{error}</span>
        <button
          onClick={onRetry}
          className="text-[#c45d2e] hover:text-[#e0765a] font-mono text-[10px] uppercase tracking-wider border border-[#c45d2e]/40 hover:border-[#c45d2e] rounded px-3 py-1.5 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-4 text-[#666] font-mono text-[11px]">
        No meetings found for this date.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {meetings.map(m => (
        <button
          key={m.id}
          onClick={() => onSelect(m)}
          className="text-left bg-[#252528] border border-[#333] hover:border-[#c45d2e] rounded p-2.5 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[#f0f0f0] font-medium text-[12px] truncate">{m.title}</span>
            <span className="text-[#888] font-mono text-[10px] flex-shrink-0 ml-2">
              {new Date(m.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

interface MeetingPickerProps {
  onSelect: (meeting: Meeting) => void
  onClose: () => void
}

export default function MeetingPicker({ onSelect, onClose }: MeetingPickerProps) {
  const [viewDate, setViewDate] = useState(new Date())
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    window.api.meetings.getUpcoming(viewDate.toISOString()).then(result => {
      setIsLoading(false)
      setMeetings(result ?? [])
    }).catch(err => {
      setIsLoading(false)
      setMeetings([])
      setError(`Could not read your local Calendar: ${err?.message ?? err}`)
    })
  }, [viewDate, nonce])

  const isToday = new Date().toDateString() === viewDate.toDateString()
  const headerText = isToday
    ? "Today's meetings"
    : viewDate.toLocaleDateString([], { month: 'short', day: 'numeric' })

  return (
    <div className="bg-[#1c1c1e] border border-[#333] rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { const d = new Date(viewDate); d.setDate(d.getDate() - 1); setViewDate(d) }}
            className="text-[#666] hover:text-[#f0f0f0] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#a0a0a0] min-w-[100px] text-center">{headerText}</span>
          <button
            onClick={() => { const d = new Date(viewDate); d.setDate(d.getDate() + 1); setViewDate(d) }}
            className="text-[#666] hover:text-[#f0f0f0] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
        <button onClick={onClose} className="font-mono text-[10px] text-[#666] hover:text-[#f0f0f0] transition-colors">
          Cancel
        </button>
      </div>

      <MeetingList
        meetings={meetings}
        isLoading={isLoading}
        error={error}
        onRetry={() => setNonce(n => n + 1)}
        onSelect={onSelect}
      />
    </div>
  )
}
