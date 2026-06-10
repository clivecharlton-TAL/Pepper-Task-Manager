import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function AIChatPanel({ isOpen, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  useEffect(() => {
    if (isOpen) textareaRef.current?.focus()
  }, [isOpen])

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setStreaming(true)
    setStreamingContent('')

    let accumulated = ''
    const unsub = window.api.ai.onQueryChunk((chunk) => {
      accumulated += chunk
      setStreamingContent(accumulated)
    })

    try {
      await window.api.ai.query(newMessages)
      setMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
    } catch (err) {
      const errMsg = err instanceof Error && err.message === 'NO_API_KEY'
        ? 'No API key configured. Add your Anthropic API key in settings.'
        : 'Something went wrong. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }])
    } finally {
      unsub()
      setStreaming(false)
      setStreamingContent('')
    }
  }

  return (
    <div
      className={`fixed top-0 right-0 h-screen z-50 flex flex-col bg-[#242424] border-l border-[#333333] transition-transform duration-200 ease-in-out`}
      style={{ width: 360, transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 border-b border-[#333333] flex-shrink-0 drag-region"
        style={{ paddingTop: 14, paddingBottom: 10 }}
      >
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#c45d2e]">
            <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1"/>
            <path d="M4 4.5C4 3.67 4.67 3 5.5 3H6.5C7.33 3 8 3.67 8 4.5C8 5.33 7.33 6 6.5 6H6V7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            <circle cx="6" cy="9" r="0.5" fill="currentColor"/>
          </svg>
          <span className="font-mono text-[10px] tracking-widest uppercase text-[#4a4a4a]">AI Assistant</span>
        </div>
        <button
          onClick={onClose}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="text-[#4a4a4a] hover:text-[#888888] transition-colors text-[18px] leading-none"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="mt-8 px-2 space-y-3">
            <p className="font-mono text-[11px] text-[#3a3a3a] text-center">Ask anything about your tasks</p>
            <div className="space-y-1.5">
              {[
                'What tasks are overdue?',
                'Summarise my high priority tasks',
                "What's assigned to me this week?",
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); textareaRef.current?.focus() }}
                  className="w-full text-left px-3 py-2 bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg font-mono text-[11px] text-[#555555] hover:text-[#888888] hover:border-[#383838] transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] px-3 py-2 bg-[#c45d2e]/15 border border-[#c45d2e]/25 rounded-xl text-[13px] font-sans text-[#e0e0e0] leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[92%] text-[13px] font-sans text-[#b0b0b0] leading-relaxed prose-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {streaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[92%] text-[13px] font-sans text-[#b0b0b0] leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
            </div>
          </div>
        )}

        {streaming && !streamingContent && (
          <div className="flex justify-start">
            <span className="font-mono text-[11px] text-[#4a4a4a] animate-pulse">thinking…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[#333333] flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); autoResize() }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              e.stopPropagation()
            }}
            placeholder="Ask about your tasks…"
            rows={1}
            disabled={streaming}
            className="flex-1 bg-[#1e1e1e] border border-[#333333] rounded-lg px-3 py-2 text-[13px] font-sans text-[#d4d4d4] placeholder-[#3a3a3a] resize-none focus:outline-none focus:border-[#c45d2e]/50 leading-relaxed disabled:opacity-40"
            style={{ minHeight: 38, maxHeight: 120 }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="flex-shrink-0 px-3 py-2 bg-[#c45d2e] text-[#f0f0f0] rounded-lg font-mono text-[11px] hover:bg-[#d4692e] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
        {messages.length > 0 && !streaming && (
          <button
            onClick={() => setMessages([])}
            className="mt-2 font-mono text-[10px] text-[#3a3a3a] hover:text-[#666666] transition-colors"
          >
            clear conversation
          </button>
        )}
      </div>
    </div>
  )
}
