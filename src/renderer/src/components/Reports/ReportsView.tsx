import { useState, useEffect } from 'react'
import type { ReportData, VelocityPoint, CompletionTimeItem, LabelBreakdownItem } from '../../../../shared/types'
import { useTaskStore } from '../../stores/taskStore'

const RANGE_OPTIONS = [
  { label: '7d',  value: 7  },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: 'All', value: 0  },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#555555]">{title}</span>
        <div className="flex-1 h-px bg-[#272727]" />
      </div>
      {children}
    </div>
  )
}

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="bg-[#232323] border border-[#2e2e2e] rounded-lg p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#555555] mb-2">{label}</div>
      <div className="font-mono text-3xl font-bold leading-none" style={{ color: color ?? '#c0c0c0' }}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-[#444444] mt-1">{sub}</div>}
    </div>
  )
}

function VelocityChart({ data }: { data: VelocityPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-28 bg-[#1f1f1f] rounded-lg border border-[#2a2a2a]">
        <p className="font-mono text-[11px] text-[#3a3a3a]">No data — complete some tasks to see trends</p>
      </div>
    )
  }
  const maxVal = Math.max(1, ...data.map(d => Math.max(d.created, d.completed)))
  const BAR_H = 80
  return (
    <div>
      <div className="flex items-end gap-1.5 h-24">
        {data.map(d => (
          <div key={d.week} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <div className="flex items-end gap-0.5 w-full">
              <div
                className="flex-1 rounded-sm"
                style={{ height: `${Math.max(2, (d.created / maxVal) * BAR_H)}px`, backgroundColor: '#4a9eca', opacity: 0.65 }}
                title={`Created: ${d.created}`}
              />
              <div
                className="flex-1 rounded-sm"
                style={{ height: `${Math.max(2, (d.completed / maxVal) * BAR_H)}px`, backgroundColor: '#30D158', opacity: 0.85 }}
                title={`Completed: ${d.completed}`}
              />
            </div>
            <span className="font-mono text-[8px] text-[#444444] truncate w-full text-center">
              {`W${d.week.split('-W')[1] ?? d.week}`}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#555555]">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#4a9eca', opacity: 0.65 }} />
          Created
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#555555]">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#30D158', opacity: 0.85 }} />
          Completed
        </span>
      </div>
    </div>
  )
}

function HorizontalBar({ label, value, max, colour, sub }: { label: string; value: number; max: number; colour: string; sub: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 2
  return (
    <div className="flex items-center gap-3">
      <div className="font-mono text-[10px] text-[#888888] w-20 flex-shrink-0 capitalize truncate">{label}</div>
      <div className="flex-1 h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colour }} />
      </div>
      <div className="font-mono text-[10px] text-[#888888] w-14 text-right flex-shrink-0">{sub}</div>
    </div>
  )
}

function StatusBar({ byStatus }: { byStatus: { status: string; count: number }[] }) {
  const total = byStatus.reduce((s, r) => s + r.count, 0)
  if (total === 0) return null
  const STATUS_COLORS: Record<string, string> = {
    backlog: '#6b7280', todo: '#4a9eca', in_progress: '#d4a843', done: '#4caf82',
  }
  const ORDER = ['backlog', 'todo', 'in_progress', 'done']
  const sorted = [...byStatus].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))
  return (
    <div className="mt-4">
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {sorted.map(r => r.count > 0 && (
          <div
            key={r.status}
            className="h-full"
            style={{ width: `${(r.count / total) * 100}%`, backgroundColor: STATUS_COLORS[r.status] }}
            title={`${r.status.replace('_', ' ')}: ${r.count}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {sorted.map(r => r.count > 0 && (
          <span key={r.status} className="flex items-center gap-1 font-mono text-[9px] text-[#555555]">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: STATUS_COLORS[r.status] }} />
            {r.status.replace('_', ' ')} {r.count}
          </span>
        ))}
      </div>
    </div>
  )
}

function CompletionTimeSection({ byPriority, byLabel }: { byPriority: CompletionTimeItem[]; byLabel: CompletionTimeItem[] }) {
  if (byPriority.length === 0 && byLabel.length === 0) {
    return <p className="font-mono text-[11px] text-[#3a3a3a]">No completed tasks in this range</p>
  }
  const maxDays = Math.max(1, ...[...byPriority, ...byLabel].map(i => i.avgDays))
  return (
    <div className="space-y-5">
      {byPriority.length > 0 && (
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#444444] mb-2">By Priority</div>
          <div className="space-y-2">
            {byPriority.map(item => (
              <HorizontalBar key={item.label} label={item.label} value={item.avgDays} max={maxDays} colour={item.colour} sub={`${item.avgDays}d avg`} />
            ))}
          </div>
        </div>
      )}
      {byLabel.length > 0 && (
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#444444] mb-2">By Label</div>
          <div className="space-y-2">
            {byLabel.map(item => (
              <HorizontalBar
                key={item.label}
                label={item.label.replace(/^\d+\./, '')}
                value={item.avgDays}
                max={maxDays}
                colour={item.colour}
                sub={`${item.avgDays}d avg`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LabelBreakdownTable({ data, onLabelClick }: { data: LabelBreakdownItem[]; onLabelClick: (labelId: string) => void }) {
  if (data.length === 0) return <p className="font-mono text-[11px] text-[#3a3a3a]">No tasks</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="text-[#444444] text-[9px] uppercase tracking-widest border-b border-[#2a2a2a]">
            <th className="text-left pb-2 font-normal pr-3">Label</th>
            <th className="text-right pb-2 font-normal px-3">Total</th>
            <th className="text-right pb-2 font-normal px-3" style={{ color: '#4caf82' }}>Done</th>
            <th className="text-right pb-2 font-normal px-3" style={{ color: '#d4a843' }}>Active</th>
            <th className="text-right pb-2 font-normal px-3" style={{ color: '#4a9eca' }}>Todo</th>
            <th className="text-right pb-2 font-normal px-3" style={{ color: '#6b7280' }}>Backlog</th>
            <th className="text-right pb-2 font-normal">Done %</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.label} className="border-t border-[#272727] hover:bg-[#242424] transition-colors">
              <td className="py-2 pr-3">
                <button
                  onClick={() => onLabelClick(row.label)}
                  className="flex items-center gap-2 text-left group/label"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.colour }} />
                  <span className="text-[#c45d2e] text-[10px] flex-shrink-0">↗</span>
                  <span className="text-[#c0c0c0] group-hover/label:text-[#f0f0f0] transition-colors truncate max-w-[200px]">{row.label}</span>
                </button>
              </td>
              <td className="text-right px-3 text-[#888888]">{row.total}</td>
              <td className="text-right px-3" style={{ color: '#4caf82' }}>{row.done}</td>
              <td className="text-right px-3" style={{ color: '#d4a843' }}>{row.inProgress}</td>
              <td className="text-right px-3" style={{ color: '#4a9eca' }}>{row.todo}</td>
              <td className="text-right px-3" style={{ color: '#6b7280' }}>{row.backlog}</td>
              <td className="text-right text-[#555555]">
                {row.total > 0 ? `${Math.round((row.done / row.total) * 100)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ReportsView() {
  const { navigateToLabel } = useTaskStore()
  const [range, setRange] = useState(30)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    window.api.reports.get(range).then(d => { setData(d); setLoading(false) })
  }, [range])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-6 space-y-8">
        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`font-mono text-[10px] px-3 py-1.5 rounded border transition-colors ${
                range === opt.value
                  ? 'border-[#c45d2e] text-[#c45d2e] bg-[#c45d2e]/10'
                  : 'border-[#333333] text-[#555555] hover:border-[#444444] hover:text-[#888888]'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {loading && <span className="font-mono text-[10px] text-[#333333] ml-2">Loading…</span>}
        </div>

        {data && (
          <>
            <Section title="Velocity">
              <VelocityChart data={data.velocity} />
            </Section>

            <div className="grid grid-cols-2 gap-6">
              <Section title="Backlog Health">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Open" value={data.backlogHealth.totalOpen} />
                  <StatCard
                    label="Overdue"
                    value={data.backlogHealth.overdueCount}
                    color={data.backlogHealth.overdueCount > 0 ? '#FC2847' : undefined}
                  />
                  <StatCard label="Avg Age" value={`${data.backlogHealth.avgAgeDays}d`} sub="open tasks" />
                  <StatCard label="No Due Date" value={data.backlogHealth.noDueDateCount} color="#FFC400" />
                </div>
                <StatusBar byStatus={data.backlogHealth.byStatus} />
              </Section>

              <Section title="Completion Time">
                <CompletionTimeSection
                  byPriority={data.completionTime.byPriority}
                  byLabel={data.completionTime.byLabel}
                />
              </Section>
            </div>

            <Section title="Label Breakdown">
              <LabelBreakdownTable data={data.labelBreakdown} onLabelClick={navigateToLabel} />
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
