import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useOpsStore, type OpsFilterMode } from '../../stores/opsStore'
import { bandFor, isLive, assigneeCounts } from '../../utils/opsHelpers'
import { isDirectReport } from '../../../../shared/opsTeam'
import { OpsRow } from './OpsRow'
import { OpsSparkline } from './OpsSparkline'
import { OpsSettings } from './OpsSettings'
import type { OpsSignal } from '../../../../shared/types'

const FILTER_MODES: { value: OpsFilterMode; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'directs',   label: 'My directs' },
  { value: 'attention', label: 'Needs attention' },
]

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[10px] tracking-widest uppercase text-[#555555]">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="font-mono text-[10px] text-[#444444]">{count}</span>
        )}
        <div className="flex-1 h-px bg-[#272727]" />
      </div>
      {children}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] text-[#3a3a3a]">{children}</p>
}

export function OpsView() {
  const {
    signals, filterMode, filterPerson, refreshing, hasCredentials,
    loadSignals, refresh, trackSignal, setFilterMode, setFilterPerson,
  } = useOpsStore()
  const [personOpen, setPersonOpen] = useState(false)

  useEffect(() => { loadSignals() }, [loadSignals])

  const filtered = useMemo(() => signals.filter(s => {
    if (filterPerson && s.assignee_name !== filterPerson) return false
    if (filterMode === 'directs' && !isDirectReport(s)) return false
    if (filterMode === 'attention' && bandFor(s) !== 'attention') return false
    return true
  }), [signals, filterMode, filterPerson])

  const attention = filtered.filter(s => bandFor(s) === 'attention')
  const open = filtered.filter(s => bandFor(s) === 'open')
  const people = useMemo(() => assigneeCounts(signals.filter(isLive)), [signals])

  const renderRows = (rows: OpsSignal[]) =>
    rows.map((s, i) => (
      <OpsRow key={s.key} signal={s} isLast={i === rows.length - 1} onTrack={trackSignal} />
    ))

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-4 space-y-8">

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_MODES.map(m => (
            <button
              key={m.value}
              onClick={() => setFilterMode(m.value)}
              className={`font-mono text-[10px] px-3 py-1.5 rounded border transition-colors ${
                filterMode === m.value
                  ? 'border-[#c45d2e] text-[#c45d2e] bg-[#c45d2e]/10'
                  : 'border-[#333333] text-[#555555] hover:border-[#444444] hover:text-[#888888]'
              }`}
            >
              {m.label}
            </button>
          ))}

          <div className="relative">
            <button
              onClick={() => setPersonOpen(o => !o)}
              className={`font-mono text-[10px] px-3 py-1.5 rounded border transition-colors ${
                filterPerson
                  ? 'border-[#c45d2e] text-[#c45d2e] bg-[#c45d2e]/10'
                  : 'border-[#333333] text-[#555555] hover:border-[#444444] hover:text-[#888888]'
              }`}
            >
              {filterPerson ?? 'Anyone'} ▾
            </button>
            {personOpen && (
              <div className="absolute left-0 top-full mt-1 bg-[#252525] border border-[#383838] rounded shadow-xl z-50 min-w-[180px] py-1 max-h-64 overflow-y-auto">
                <button
                  onClick={() => { setFilterPerson(null); setPersonOpen(false) }}
                  className="w-full text-left font-mono text-[10px] px-3 py-1.5 text-[#888888] hover:bg-[#2a2a2a] transition-colors"
                >
                  Anyone
                </button>
                {people.map(p => (
                  <button
                    key={p.name}
                    onClick={() => { setFilterPerson(p.name); setPersonOpen(false) }}
                    className={`w-full flex items-center justify-between gap-3 font-mono text-[10px] px-3 py-1.5 hover:bg-[#2a2a2a] transition-colors ${
                      filterPerson === p.name ? 'text-[#c45d2e]' : 'text-[#a8a8a8]'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-[#555555]">{p.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <button
            onClick={refresh}
            disabled={refreshing}
            className="font-mono text-[10px] px-3 py-1.5 rounded border border-[#333333] text-[#555555] hover:border-[#444444] hover:text-[#888888] transition-colors disabled:opacity-40"
          >
            {refreshing ? 'Syncing…' : 'Refresh'}
          </button>
        </div>

        <OpsSettings configured={hasCredentials} onSaved={loadSignals} />

        <Section title="Needs attention" count={attention.length}>
          {attention.length === 0
            ? <Empty>Nothing needs your attention.</Empty>
            : renderRows(attention)}
        </Section>

        <Section title="Open" count={open.length}>
          {open.length === 0
            ? <Empty>No open incidents.</Empty>
            : renderRows(open)}
        </Section>

        <Section title="Pattern">
          <OpsSparkline signals={signals} />
        </Section>

      </div>
    </div>
  )
}
