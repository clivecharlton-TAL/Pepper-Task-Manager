import { weeklyVolume } from '../../utils/opsHelpers'
import type { OpsSignal } from '../../../../shared/types'

/**
 * Incident volume per week. This is the band that matters most at CTO level:
 * any single incident belongs to ops, but a trend that never reaches zero is
 * a structural problem.
 */
export function OpsSparkline({ signals, weeks = 12 }: { signals: OpsSignal[]; weeks?: number }) {
  const data = weeklyVolume(signals, weeks)
  const maxVal = Math.max(1, ...data.map(d => d.count))
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const clearWeeks = data.filter(d => d.count === 0).length
  const BAR_H = 56

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-20 bg-[#1f1f1f] rounded-lg border border-[#2a2a2a]">
        <p className="font-mono text-[11px] text-[#3a3a3a]">No incidents in the last {weeks} weeks</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-end gap-1.5 h-16">
        {data.map(d => (
          <div key={d.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <div
              className="w-full rounded-sm"
              style={{
                height: `${Math.max(2, (d.count / maxVal) * BAR_H)}px`,
                backgroundColor: d.count === 0 ? '#2a2a2a' : '#c45d2e',
                opacity: d.count === 0 ? 1 : 0.75,
              }}
              title={`Week of ${d.label}: ${d.count}`}
            />
            <span className="font-mono text-[8px] text-[#444444] truncate w-full text-center">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 font-mono text-[10px] text-[#555555]">
        <span>{total} incidents / {weeks} weeks</span>
        <span className={clearWeeks === 0 ? 'text-[#FF9F0A]' : ''}>
          {clearWeeks === 0 ? 'no clear week' : `${clearWeeks} clear weeks`}
        </span>
      </div>
    </div>
  )
}
