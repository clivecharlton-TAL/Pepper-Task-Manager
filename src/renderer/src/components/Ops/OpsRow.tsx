import type { OpsSignal } from '../../../../shared/types'
import { bandFor, daysSince } from '../../utils/opsHelpers'

const BAND_COLOUR: Record<string, string> = {
  attention: '#FF9F0A',
  open: '#4a9eca',
  resolved: '#4caf82',
}

function IconExternal() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 1.5H1.5v7h7v-2M6 1.5h2.5V4M8.5 1.5L4.5 5.5" />
    </svg>
  )
}

export function OpsRow({ signal, isLast, onTrack }: {
  signal: OpsSignal
  isLast: boolean
  onTrack: (signal: OpsSignal) => void
}) {
  const band = bandFor(signal)
  const colour = BAND_COLOUR[band] ?? '#6b7280'
  const age = daysSince(signal.issue_updated_at)
  const tracked = !!signal.tracked_task_id

  return (
    <div className="group">
      <div
        onClick={() => window.api.ops.open(signal.url)}
        className="flex items-start gap-3 py-3 px-3 -mx-3 cursor-pointer rounded-lg transition-colors hover:bg-[#242424]"
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
          style={{ backgroundColor: colour }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-mono text-[10px] flex-shrink-0" style={{ color: colour }}>{signal.key}</span>
            <span className="text-[13px] font-sans leading-snug text-[#f0f0f0] truncate">{signal.title}</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap font-mono text-[10px] text-[#666666]">
            <span>{signal.status}</span>
            {signal.assignee_name && <span className="text-[#888888]">{signal.assignee_name}</span>}
            <span className={age > 7 ? 'text-[#FF9F0A]' : ''}>{age}d</span>
            {tracked && <span className="text-[#4caf82]">tracked</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!tracked && (
            <button
              onClick={e => { e.stopPropagation(); onTrack(signal) }}
              className="opacity-0 group-hover:opacity-100 font-mono text-[10px] px-2 py-0.5 rounded border border-[#383838] text-[#888888] hover:border-[#c45d2e] hover:text-[#c45d2e] transition-all"
            >
              Track this
            </button>
          )}
          <span className="text-[#3a3a3a] group-hover:text-[#666666] transition-colors mt-1">
            <IconExternal />
          </span>
        </div>
      </div>

      {!isLast && <div className="h-px bg-[#272727] mx-0" />}
    </div>
  )
}
