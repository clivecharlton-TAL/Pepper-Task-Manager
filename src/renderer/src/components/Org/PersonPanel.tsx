import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ROOT_ID, TIERS, STRIPES, descendantIds, managerChain, emailOf,
  type OrgPerson, type OrgTier,
} from '../../../../shared/org'
import { Avatar } from './OrgCard'

export type Draft = Omit<OrgPerson, 'id' | 'sort_order' | 'perf_folder'>

interface Props {
  mode: 'edit' | 'new'
  person: OrgPerson | null      // null in 'new' mode
  initial: Draft
  people: OrgPerson[]
  hue: string
  busy: boolean
  onSave: (draft: Draft) => void
  onRemove: () => void
  onAddReport: () => void
  onClose: () => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[9.5px] tracking-widest uppercase text-[#5a5a5a]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

const input = 'w-full bg-[#1c1c1e] border border-[#333] rounded-md px-2.5 py-1.5 text-[12.5px] text-[#e8e8e8] placeholder-[#4a4a4a] focus:outline-none focus:border-[#c45d2e]/70 transition-colors'

export default function PersonPanel({ mode, person, initial, people, hue, busy, onSave, onRemove, onAddReport, onClose }: Props) {
  const [d, setD] = useState<Draft>(initial)
  const [confirming, setConfirming] = useState(false)
  useEffect(() => { setD(initial); setConfirming(false) }, [person?.id, mode, initial])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }))
  const dirty = JSON.stringify(d) !== JSON.stringify(initial)
  const canSave = (d.vacancy || d.name.trim().length > 1) && d.role.trim().length > 0 && !!d.manager_id

  // A person can't report to themselves or to anyone in their own team.
  const managerOptions = useMemo(() => {
    const blocked = person ? descendantIds(people, person.id) : new Set<string>()
    return people
      .filter(p => !p.vacancy && p.id !== person?.id && !blocked.has(p.id))
      .sort((a, b) => (a.id === ROOT_ID ? -1 : b.id === ROOT_ID ? 1 : a.name.localeCompare(b.name)))
  }, [people, person])

  const directReports = person ? people.filter(p => p.manager_id === person.id).length : 0
  const totalTeam = person ? descendantIds(people, person.id).size : 0
  const chain = person ? managerChain(people, person.id) : []
  const newManager = people.find(p => p.id === d.manager_id)
  const isDirect = d.manager_id === ROOT_ID
  const isRoot = person?.id === ROOT_ID

  const preview: OrgPerson = { ...d, id: person?.id ?? 'new', sort_order: 0, perf_folder: null, name: d.name || 'New person' }

  return (
    <aside className="w-[340px] flex-shrink-0 border-l border-[#2c2c2e] bg-[#1f1f21]/95 backdrop-blur flex flex-col org-pop">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#2a2a2a] relative">
        <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${hue}, transparent)` }} />
        <button onClick={onClose} className="absolute right-3 top-3 w-7 h-7 rounded-md text-[#666] hover:text-[#ddd] hover:bg-white/5 flex items-center justify-center" title="Close">
          <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        <div className="flex items-center gap-3.5">
          <Avatar person={preview} hue={hue} px={48} />
          <div className="min-w-0">
            <div className="font-mono text-[9.5px] tracking-widest uppercase" style={{ color: hue }}>
              {mode === 'new' ? 'New person' : d.vacancy ? 'Vacant role' : d.tier}
            </div>
            <div className="text-[15px] font-semibold text-[#f2f2f2] leading-tight truncate">{d.vacancy ? 'Vacancy' : (d.name || 'New person')}</div>
            <div className="text-[11.5px] text-[#8a8a8a] leading-snug truncate">{d.role || 'Role'}</div>
          </div>
        </div>
        {mode === 'edit' && chain.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1 text-[10.5px] text-[#666]">
            {[...chain].reverse().map((m, i) => (
              <span key={m.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-[#444]">›</span>}{m.name.split(' ')[0]}
              </span>
            ))}
            <span className="text-[#444]">›</span><span className="text-[#aaa]">{person?.name.split(' ')[0]}</span>
          </div>
        )}
        {mode === 'edit' && !isRoot && (
          <div className="mt-3 flex gap-4 font-mono text-[10px] text-[#777]">
            <span><span className="text-[#ddd]">{directReports}</span> direct</span>
            <span><span className="text-[#ddd]">{totalTeam}</span> in team</span>
            {person?.perf_folder && <span className="truncate" title={`Drive: 60.People-Leadership/10.Performance-Management/${person.perf_folder}`}>Drive · {person.perf_folder}</span>}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <span className={`w-8 h-[18px] rounded-full relative transition-colors ${d.vacancy ? 'bg-[#c45d2e]' : 'bg-[#3a3a3a]'}`}>
            <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all ${d.vacancy ? 'left-[16px]' : 'left-[2px]'}`} />
          </span>
          <input type="checkbox" className="hidden" checked={d.vacancy} disabled={isRoot} onChange={e => set('vacancy', e.target.checked)} />
          <span className="text-[12px] text-[#bbb]">Vacant role</span>
        </label>

        {!d.vacancy && (
          <Field label="Name">
            <input className={input} value={d.name} autoFocus={mode === 'new'} placeholder="First Last" onChange={e => set('name', e.target.value)} />
          </Field>
        )}
        <Field label="Role">
          <input className={input} value={d.role} placeholder="Eng Manager 2" onChange={e => set('role', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tier">
            <select className={input} value={d.tier} disabled={isRoot} onChange={e => set('tier', e.target.value as OrgTier)}>
              {(isRoot ? ['CTO'] : TIERS).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Team">
            <input className={input} value={d.team} placeholder="Catalogue" onChange={e => set('team', e.target.value)} />
          </Field>
        </div>

        {!isRoot && (
          <Field label="Reports to">
            <select className={input} value={d.manager_id ?? ''} onChange={e => set('manager_id', e.target.value)}>
              {managerOptions.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
            </select>
          </Field>
        )}

        {isDirect && (
          <Field label="Stripe">
            <div className="flex flex-wrap gap-1.5">
              {STRIPES.map(s => (
                <button key={s} type="button" onClick={() => set('stripe', d.stripe === s ? null : s)}
                  className={`font-mono text-[10px] px-2 py-1 rounded border transition-colors ${
                    d.stripe === s ? 'border-[#c45d2e] text-[#e08a5c] bg-[#c45d2e]/10' : 'border-[#333] text-[#777] hover:text-[#bbb]'
                  }`}>{s}</button>
              ))}
            </div>
          </Field>
        )}

        {!d.vacancy && (
          <>
            <Field label="Contractor via (leave blank if employee)">
              <input className={input} value={d.contractor ?? ''} placeholder="Company name" onChange={e => set('contractor', e.target.value || null)} />
            </Field>
            <Field label="Email">
              <input className={input} value={d.email ?? ''} placeholder={emailOf({ name: d.name || 'first last', email: null })} onChange={e => set('email', e.target.value || null)} />
            </Field>
          </>
        )}

        {mode === 'edit' && isDirect && !d.vacancy && !person?.perf_folder && (
          <p className="text-[10.5px] text-[#777] leading-relaxed">A Drive folder, Finder tag and Gmail label are made under 60.People-Leadership/10.Performance-Management when you save.</p>
        )}
        {mode === 'new' && isDirect && !d.vacancy && (
          <p className="text-[10.5px] text-[#777] leading-relaxed">New direct report: Pepper also makes their Drive folder, Finder tag and Gmail label.</p>
        )}
        {mode === 'edit' && newManager && d.manager_id !== initial.manager_id && (
          <p className="text-[11px] text-[#d4a843] leading-relaxed">Moves {d.vacancy ? 'this role' : d.name.split(' ')[0]} and their whole team ({totalTeam}) under {newManager.name}.</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-[#2a2a2a] space-y-2.5">
        {confirming ? (
          <div className="rounded-lg border border-[#FC2847]/30 bg-[#FC2847]/[0.06] p-3 org-pop">
            <p className="text-[11.5px] text-[#ddd] leading-relaxed">
              Remove {d.vacancy ? 'this vacant role' : <b>{person?.name}</b>}?
              {directReports > 0 && <> Their {directReports} direct report{directReports > 1 ? 's' : ''} will move to {people.find(p => p.id === person?.manager_id)?.name}.</>}
              {' '}Their Drive folder is kept.
            </p>
            <div className="flex gap-2 mt-2.5">
              <button disabled={busy} onClick={onRemove} className="text-[11.5px] px-3 py-1.5 rounded-md bg-[#FC2847]/80 hover:bg-[#FC2847] text-white transition-colors">Remove</button>
              <button onClick={() => setConfirming(false)} className="text-[11.5px] px-3 py-1.5 rounded-md text-[#aaa] hover:bg-white/5">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              disabled={!canSave || (!dirty && mode === 'edit') || busy}
              onClick={() => onSave({ ...d, name: d.vacancy ? 'Vacancy' : d.name.trim(), role: d.role.trim(), team: d.team.trim() })}
              className="text-[12px] font-medium px-4 py-1.5 rounded-md bg-[#c45d2e] hover:bg-[#d46a38] text-white disabled:opacity-30 disabled:hover:bg-[#c45d2e] transition-colors"
            >{busy ? 'Saving…' : mode === 'new' ? 'Add to org' : 'Save'}</button>
            {mode === 'edit' && !d.vacancy && (
              <button onClick={onAddReport} className="text-[12px] px-3 py-1.5 rounded-md border border-[#333] text-[#bbb] hover:border-[#555] hover:text-white transition-colors">+ Report</button>
            )}
            <span className="flex-1" />
            {mode === 'edit' && !isRoot && (
              <button onClick={() => setConfirming(true)} className="text-[11.5px] px-2 py-1.5 rounded-md text-[#888] hover:text-[#FC2847] transition-colors">Remove</button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
