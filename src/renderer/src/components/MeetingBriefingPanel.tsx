import { useState, useEffect } from 'react'
import type { Meeting } from '../../../shared/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MeetingBriefingPanelProps {
  isOpen: boolean
  meeting: Meeting | null
  onClose: () => void
}

export default function MeetingBriefingPanel({ isOpen, meeting, onClose }: MeetingBriefingPanelProps) {
  const [briefing, setBriefing] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  // Generate briefing when the panel opens with a meeting
  useEffect(() => {
    if (isOpen && meeting) {
      setBriefing('')
      setIsLoading(true)

      const details = `Title: ${meeting.title}\nTime: ${new Date(meeting.start_time).toLocaleTimeString()} - ${new Date(meeting.end_time).toLocaleTimeString()}\nAttendees: ${meeting.attendees.join(', ')}\nDescription: ${meeting.description || 'None'}`

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
  }, [isOpen, meeting])

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
          {meeting ? (
            <div className="mb-6 bg-[#252528] rounded border border-[#333] p-3">
              <h2 className="text-[#f0f0f0] font-semibold text-[14px] mb-2">{meeting.title}</h2>
              <div className="font-mono text-[10px] text-[#888] space-y-1">
                <p>Time: {new Date(meeting.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                <p>Attendees: {meeting.attendees.join(', ')}</p>
              </div>
            </div>
          ) : null}

          {isLoading && !briefing ? (
            <div className="flex items-center gap-2 text-[#888] font-mono text-[11px] mt-4">
              <div className="w-3 h-3 border-2 border-[#c45d2e] border-t-transparent rounded-full animate-spin" />
              Synthesizing context...
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none text-[#d0d0d0] text-[13px] leading-relaxed [&>h1]:text-[16px] [&>h1]:font-semibold [&>h1]:mb-3 [&>h1]:mt-6 [&>h1]:text-[#f0f0f0] [&>h2]:text-[14px] [&>h2]:font-semibold [&>h2]:mb-2 [&>h2]:mt-5 [&>h2]:text-[#f0f0f0] [&>h3]:text-[13px] [&>h3]:font-semibold [&>h3]:mb-2 [&>h3]:mt-4 [&>h3]:text-[#e0e0e0] [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-3 [&>li]:mb-1 [&>pre]:bg-[#1e1e1e] [&>pre]:p-3 [&>pre]:rounded [&>pre]:mb-3 [&>code]:bg-[#1e1e1e] [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:font-mono [&>code]:text-[12px] [&>blockquote]:border-l-2 [&>blockquote]:border-[#333] [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:text-[#a0a0a0] [&>blockquote]:mb-3 [&>a]:text-[#c45d2e] [&>a]:underline [&>a]:underline-offset-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
