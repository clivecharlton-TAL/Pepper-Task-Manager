import { useEffect, useState } from 'react'
import type { Meeting } from '../../../../shared/types'

export default function MeetingBanner({
  onOpenBriefing,
}: {
  onOpenBriefing: (meeting: Meeting) => void
}) {
  const [upcomingMeeting, setUpcomingMeeting] = useState<Meeting | null>(null)
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = window.api.on('domain-event', (e: any) => {
      if (e.type === 'meeting:upcoming') {
        const m = e.meeting as Meeting
        if (m.id !== dismissedId) {
          setUpcomingMeeting(m)
        }
      }
    })
    return unsub
  }, [dismissedId])

  if (!upcomingMeeting) return null

  // Format time (e.g. 10:00 AM)
  const timeString = new Date(upcomingMeeting.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="bg-[#c45d2e]/10 border-b border-[#c45d2e]/30 px-4 py-2 flex items-center justify-between font-mono text-[11px] text-[#e0e0e0]">
      <div className="flex items-center gap-3">
        <span className="text-[#c45d2e] font-bold tracking-wider">UPCOMING MEETING</span>
        <span className="text-[#a0a0a0]">•</span>
        <span>{timeString}</span>
        <span className="text-[#a0a0a0]">•</span>
        <span className="font-semibold text-white">{upcomingMeeting.title}</span>
      </div>
      
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => {
            onOpenBriefing(upcomingMeeting)
            setUpcomingMeeting(null) // Hide banner once opened
          }}
          className="bg-[#c45d2e] hover:bg-[#d66b3d] text-white px-3 py-1 rounded transition-colors tracking-wide"
        >
          Prepare Briefing
        </button>
        <button
          onClick={() => {
            setDismissedId(upcomingMeeting.id)
            setUpcomingMeeting(null)
          }}
          className="text-[#888888] hover:text-[#c0c0c0] p-1"
          title="Dismiss"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
