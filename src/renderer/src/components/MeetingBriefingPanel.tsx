import { useState, useEffect } from 'react'
import type { Meeting } from '../../../shared/types'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

interface MeetingBriefingPanelProps {
  isOpen: boolean
  onClose: () => void
}

const markdownComponents: Components = {
  a: ({ node, href, children, ...props }) => {
    if (!href) return <a {...props}>{children}</a>

    if (href.startsWith('https://label.internal/')) {
      const colour = href.replace('https://label.internal/', '')
      return (
        <span
          className="font-mono text-[11px] tracking-wide mx-1 inline-flex items-center gap-1.5 align-baseline"
          style={{ color: colour }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.5 1.5 L12.5 1.5 L12.5 6.5 L6.5 12.5 C5.5 13.5 4 13.5 3 12.5 L1.5 11 C0.5 10 0.5 8.5 1.5 7.5 L7.5 1.5 Z"/>
            <circle cx="9.5" cy="4.5" r="1" fill="currentColor" stroke="none"/>
          </svg>
          {children}
        </span>
      )
    }

    if (href.startsWith('https://task.internal/')) {
      return (
        <div className="flex items-start gap-2 mt-4 mb-1">
          <span className="inline-flex items-center gap-1.5 text-[#e0e0e0] font-medium cursor-default text-[13px]">
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" className="text-[#c45d2e] shrink-0 translate-y-[1px]">
              <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 7L6.5 8.5L9 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="flex-1 leading-snug">{children}</span>
          </span>
        </div>
      )
    }

    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    )
  }
}

export default function MeetingBriefingPanel({ isOpen, onClose }: MeetingBriefingPanelProps) {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [todayMeetings, setTodayMeetings] = useState<Meeting[]>([])
  const [briefing, setBriefing] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [icsUrl, setIcsUrl] = useState<string>('')
  const [isEditingIcs, setIsEditingIcs] = useState(false)

  // Reset state and fetch meetings when panel opens
  useEffect(() => {
    if (!isOpen) {
      setSelectedMeeting(null)
      setBriefing('')
      return
    }

    // Load ICS URL config
    window.api.calendar.getIcsUrl().then(url => {
      if (url) setIcsUrl(url)
    })

    // Fetch meetings
    window.api.meetings.getUpcoming().then(meetings => {
      if (meetings) setTodayMeetings(meetings)
    })
  }, [isOpen])

  // Generate briefing when a meeting is selected
  useEffect(() => {
    if (isOpen && selectedMeeting) {
      setBriefing('')
      setIsLoading(true)

      const details = `Title: ${selectedMeeting.title}\nTime: ${new Date(selectedMeeting.start_time).toLocaleTimeString()} - ${new Date(selectedMeeting.end_time).toLocaleTimeString()}\nAttendees: ${selectedMeeting.attendees.join(', ')}\nDescription: ${selectedMeeting.description || 'None'}`

      let accumulated = ''
      const unsub = window.api.ai.onBriefingChunk((chunk) => {
        accumulated += chunk
        setBriefing(accumulated)
        setIsLoading(false)
      })

      window.api.ai.briefing(details).catch(err => {
        setBriefing(`_Error generating briefing: ${err}_`)
        setIsLoading(false)
      })

      return () => {
        unsub()
      }
    }
  }, [isOpen, selectedMeeting])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div
        className={`fixed top-0 right-0 h-screen w-[400px] bg-[#1a1a1c] border-l border-[#333] shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333] shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[#c45d2e] tracking-widest text-[11px] uppercase">Meeting Briefing</span>
          </div>
          <button
            onClick={onClose}
            className="no-drag text-[#666] hover:text-[#fff] p-1 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {!selectedMeeting ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[#a0a0a0] font-mono text-[11px] uppercase tracking-wider">Today's Meetings</h3>
              </div>

              {todayMeetings.length === 0 && (
                <div className="text-center py-8 text-[#666] font-mono text-[11px]">
                  No meetings found on your local Calendar for today.
                </div>
              )}

              {todayMeetings.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMeeting(m)}
                  className="text-left bg-[#252528] border border-[#333] hover:border-[#c45d2e] rounded p-3 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[#f0f0f0] font-semibold text-[13px]">{m.title}</span>
                    <span className="text-[#888] font-mono text-[10px]">
                      {new Date(m.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[#a0a0a0] text-[12px] line-clamp-1 mb-2">
                    {m.description || 'No description'}
                  </div>
                  <div className="flex items-center gap-1.5 text-[#666] font-mono text-[10px]">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    {m.attendees?.length || 0} attendees
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="mb-6 bg-[#252528] rounded border border-[#333] p-3">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-[#f0f0f0] font-semibold text-[14px]">{selectedMeeting.title}</h2>
                  <button
                    onClick={() => setSelectedMeeting(null)}
                    className="text-[#666] hover:text-[#c45d2e] transition-colors font-mono text-[10px] uppercase tracking-wide border border-[#333] rounded px-1.5 py-0.5 hover:border-[#c45d2e]"
                  >
                    Back
                  </button>
                </div>
                <div className="font-mono text-[10px] text-[#888] space-y-1">
                  <p>Time: {new Date(selectedMeeting.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                  <details className="group">
                    <summary className="cursor-pointer hover:text-[#a0a0a0] transition-colors flex items-center gap-1 list-none outline-none">
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" className="opacity-50 group-open:rotate-90 transition-transform">
                        <path d="M3 1 L7 5 L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Attendees: {selectedMeeting.attendees.length}
                    </summary>
                    <div className="mt-2 pl-3 space-y-1">
                      {selectedMeeting.attendees.map((email, i) => (
                        <div key={i} className="text-[#666] truncate">{email}</div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>

              {isLoading && !briefing ? (
                <div className="flex items-center gap-2 text-[#888] font-mono text-[11px] mt-4">
                  <div className="w-3 h-3 border-2 border-[#c45d2e] border-t-transparent rounded-full animate-spin" />
                  Synthesizing context...
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none text-[#d0d0d0] text-[13px] leading-relaxed [&>h1]:text-[16px] [&>h1]:font-semibold [&>h1]:mb-3 [&>h1]:mt-6 [&>h1]:text-[#f0f0f0] [&>h2]:text-[14px] [&>h2]:font-semibold [&>h2]:mb-2 [&>h2]:mt-6 [&>h2]:text-[#f0f0f0] [&>h3]:text-[13px] [&>h3]:font-semibold [&>h3]:mb-2 [&>h3]:mt-4 [&>h3]:text-[#e0e0e0] [&>p]:mb-4 [&>ul]:list-none [&>ul]:pl-0 [&>ul]:mb-6 [&>ol]:list-none [&>ol]:pl-0 [&>ol]:mb-6 [&>li]:mb-5 [&>li]:pl-0 [&>pre]:bg-[#1e1e1e] [&>pre]:p-3 [&>pre]:rounded [&>pre]:mb-3 [&>code]:bg-[#1e1e1e] [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:font-mono [&>code]:text-[12px] [&>blockquote]:border-l-2 [&>blockquote]:border-[#333] [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:text-[#a0a0a0] [&>blockquote]:mb-4 [&>a]:text-[#c45d2e] [&>a]:underline [&>a]:underline-offset-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
                    {briefing}
                  </ReactMarkdown>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
