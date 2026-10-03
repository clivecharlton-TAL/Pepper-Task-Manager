import { useMemo, useState, useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { useOrgStore } from '../../stores/orgStore'
import {
  ROOT_ID, STRIPES, canMove, childrenOf, descendantIds,
  type OrgPerson, type SlidesCheck, type OrgSyncReport,
} from '../../../../shared/org'
import { OrgCard, type DropState } from './OrgCard'
import PersonPanel, { type Draft } from './PersonPanel'
import { hueFor, STRIPE_COLOURS, NEUTRAL } from './orgTheme'

type Side = { kind: 'edit'; id: string } | { kind: 'new'; managerId: string; preset?: Partial<Draft> } | { kind: 'history' } | { kind: 'slides' } | null
type Toast = { tone: 'ok' | 'warn' | 'error'; lines: string[] } | null

const STRIPE_ORDER = [...STRIPES, null]

function summarise(report: OrgSyncReport | undefined, action: string): Toast {
  if (!report) return { tone: 'ok', lines: [action] }
  const lines = [action]
  lines.push(report.teamMd === 'updated' ? 'team.md updated' : report.teamMd === 'unchanged' ? 'team.md already current' : `team.md: ${report.teamMd}`)
  for (const f of report.foldersCreated) lines.push(`Drive folder ${f} + Finder tag + Gmail label created`)
  lines.push('Change logged')
  lines.push(...report.warnings)
  const bad = report.warnings.length > 0 || !['updated', 'unchanged'].includes(report.teamMd)
  return { tone: bad ? 'warn' : 'ok', lines }
}

function ToolButton({ children, onClick, active, title }: { children: ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className={`font-mono text-[10.5px] px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 ${
        active ? 'border-[#c45d2e] text-[#e08a5c] bg-[#c45d2e]/10' : 'border-[#333] text-[#8a8a8a] hover:border-[#4a4a4a] hover:text-[#ddd]'
      }`}>{children}</button>
  )
}

export default function OrgView() {
  const { people, changes, loaded, load } = useOrgStore()
  const [side, setSide] = useState<Side>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const [slides, setSlides] = useState<SlidesCheck | { error: string } | 'loading' | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState<number | null>(null) // null until first fit

  // Scale with a transform (not CSS zoom): Electron 31's Chromium reports
  // zoomed rects inconsistently, which would break drop targets. The outer
  // box is sized to the scaled content so scrolling still works.
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setNatural({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [loaded])
  const fitZoom = useCallback(() => {
    const c = canvasRef.current
    if (!c || !natural.w) return 1
    // Readability beats seeing everything: never auto-shrink below 70%.
    return Math.max(0.7, Math.min(1, (c.clientWidth - 16) / natural.w))
  }, [natural.w])
  useEffect(() => {
    if (zoom === null && natural.w) setZoom(fitZoom())
  }, [natural.w, zoom, fitZoom])
  // Keep the CTO card in view: centre horizontally whenever the scale changes.
  useEffect(() => {
    const c = canvasRef.current
    if (c && zoom) c.scrollLeft = (c.scrollWidth - c.clientWidth) / 2
  }, [zoom])
  const z = zoom ?? 1
  const stepZoom = (d: number) => setZoom(Math.round(Math.max(0.45, Math.min(1.25, z + d)) * 100) / 100)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const byId = useMemo(() => new Map(people.map(p => [p.id, p])), [people])
  const root = byId.get(ROOT_ID)
  const directs = useMemo(() => {
    const ds = childrenOf(people, ROOT_ID)
    return STRIPE_ORDER.flatMap(s => ds.filter(d => (d.stripe ?? null) === s || (s === null && !STRIPES.includes(d.stripe as never))))
  }, [people])

  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!q) return null
    return new Set(people.filter(p => `${p.name} ${p.role} ${p.team}`.toLowerCase().includes(q)).map(p => p.id))
  }, [people, q])
  // While searching, show any branch that holds a match.
  const branchHasMatch = useCallback((id: string) => {
    if (!matches) return false
    return matches.has(id) || [...descendantIds(people, id)].some(d => matches.has(d))
  }, [matches, people])

  const notify = (t: Toast) => {
    setToast(t)
    window.setTimeout(() => setToast(cur => (cur === t ? null : cur)), t?.tone === 'ok' ? 4500 : 9000)
  }

  const run = async (action: string, fn: () => Promise<{ report?: OrgSyncReport; error?: string }>) => {
    setBusy(true)
    try {
      const res = await fn()
      if (res.error) notify({ tone: 'error', lines: [res.error] })
      else notify(summarise(res.report, action))
      await load()
      return !res.error
    } catch (e) {
      notify({ tone: 'error', lines: [(e as Error).message] })
      return false
    } finally {
      setBusy(false)
    }
  }

  // ─── Drag and drop: drop a card on another card to change who they report to ──
  const dropStateFor = (targetId: string): DropState => {
    if (!dragId || overId !== targetId) return 'none'
    const target = byId.get(targetId)
    if (!target || target.vacancy) return 'invalid'
    if (byId.get(dragId)?.manager_id === targetId) return 'none'
    return canMove(people, dragId, targetId) ? 'valid' : 'invalid'
  }

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.data.current?.personId ?? ''))
  const onDragOver = (e: DragOverEvent) => setOverId(e.over ? String(e.over.data.current?.personId ?? '') : null)
  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.data.current?.personId ?? '')
    const target = e.over ? String(e.over.data.current?.personId ?? '') : ''
    setDragId(null); setOverId(null)
    const person = byId.get(id), boss = byId.get(target)
    if (!person || !boss || person.manager_id === target) return
    if (boss.vacancy || !canMove(people, id, target)) {
      notify({ tone: 'error', lines: [`${person.name} can't report to ${boss.name} — that's inside their own team.`] })
      return
    }
    // Moving to/from the CTO changes what a stripe means; clear it when leaving.
    const patch = target === ROOT_ID ? { manager_id: target } : { manager_id: target, stripe: null }
    await run(`Moved ${person.vacancy ? 'vacancy' : person.name} under ${boss.name}`, () => window.api.org.update(id, patch))
  }

  // ─── Panels ──────────────────────────────────────────────────────────────
  const selected = side?.kind === 'edit' ? byId.get(side.id) ?? null : null
  const initialDraft = useMemo<Draft | null>(() => {
    if (side?.kind === 'edit' && selected) {
      const { id: _i, sort_order: _s, perf_folder: _p, ...rest } = selected
      return rest
    }
    if (side?.kind === 'new') {
      return {
        name: '', role: '', tier: side.managerId === ROOT_ID ? 'Director' : 'EM1', team: '',
        stripe: null, manager_id: side.managerId, vacancy: false, contractor: null, email: null,
        ...side.preset,
      }
    }
    return null
  }, [side, selected])

  const panelHue = selected ? hueFor(selected, people)
    : side?.kind === 'new' ? (side.managerId === ROOT_ID ? NEUTRAL : hueFor(byId.get(side.managerId) ?? root!, people))
    : NEUTRAL

  const save = async (d: Draft) => {
    if (side?.kind === 'new') {
      const ok = await run(`Added ${d.vacancy ? 'a vacancy' : d.name}`, () => window.api.org.add(d))
      if (ok) setSide(null)
    } else if (selected) {
      await run(`Saved ${d.vacancy ? 'vacancy' : d.name}`, () => window.api.org.update(selected.id, d))
    }
  }

  const remove = async () => {
    if (!selected) return
    const ok = await run(`Removed ${selected.vacancy ? 'vacancy' : selected.name}`, () => window.api.org.remove(selected.id))
    if (ok) setSide(null)
  }

  const runSlidesCheck = async () => {
    setSide({ kind: 'slides' })
    setSlides('loading')
    setSlides(await window.api.org.checkSlides())
  }

  // ─── Rendering ───────────────────────────────────────────────────────────
  const toggle = (id: string) => setCollapsed(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const cardProps = (p: OrgPerson) => ({
    person: p,
    hue: hueFor(p, people),
    selected: side?.kind === 'edit' && side.id === p.id,
    matched: !!matches?.has(p.id),
    dimmed: !!matches && !branchHasMatch(p.id),
    dropState: dropStateFor(p.id),
    teamCount: descendantIds(people, p.id).size,
    collapsed: collapsed.has(p.id) && !branchHasMatch(p.id),
    onToggle: () => toggle(p.id),
    onClick: () => setSide({ kind: 'edit', id: p.id }),
  })

  const renderBranch = (id: string): ReactNode => {
    const kids = childrenOf(people, id)
    if (!kids.length || (collapsed.has(id) && !branchHasMatch(id))) return null
    return (
      <ul className="org-tree">
        {kids.map(k => (
          <li key={k.id} style={{ ['--org-line' as string]: `${hueFor(k, people)}40` }}>
            <OrgCard {...cardProps(k)} />
            {renderBranch(k.id)}
          </li>
        ))}
      </ul>
    )
  }

  if (!loaded || !root) {
    return <div className="flex-1 flex items-center justify-center font-mono text-[11px] text-[#555]">Loading org…</div>
  }

  const named = people.filter(p => !p.vacancy).length
  const vacancies = people.filter(p => p.vacancy).length
  const contractors = people.filter(p => p.contractor).length
  const dragged = dragId ? byId.get(dragId) : null

  return (
    <div className="flex-1 flex min-h-0 min-w-0 relative">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-[#2a2a2a] flex-wrap">
          <div className="flex items-baseline gap-3 mr-2">
            <h1 className="text-[15px] font-semibold text-[#eee]">Engineering org</h1>
            <span className="font-mono text-[10.5px] text-[#666]">
              <span className="text-[#bbb]">{directs.filter(d => !d.vacancy).length}</span> directs ·{' '}
              <span className="text-[#bbb]">{named}</span> people ·{' '}
              <span className="text-[#bbb]">{vacancies}</span> vacant
              {contractors > 0 && <> · <span className="text-[#d4a843]">{contractors}</span> contractor</>}
            </span>
          </div>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555]" width="11" height="11" viewBox="0 0 12 12">
              <circle cx="5" cy="5" r="3.6" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M8 8l2.6 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a person, role or team"
              className="w-56 bg-[#1c1c1e] border border-[#333] rounded-md pl-7 pr-2.5 py-1.5 text-[11.5px] text-[#ddd] placeholder-[#4f4f4f] focus:outline-none focus:border-[#c45d2e]/60" />
          </div>
          <span className="flex-1" />
          <ToolButton onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(directs.map(d => d.id)))}>
            {collapsed.size ? 'Expand all' : 'Collapse all'}
          </ToolButton>
          <ToolButton onClick={runSlidesCheck} active={side?.kind === 'slides'} title="Read-only check against the shared Slides org chart">Check vs Slides</ToolButton>
          <ToolButton onClick={() => setSide(side?.kind === 'history' ? null : { kind: 'history' })} active={side?.kind === 'history'}>History</ToolButton>
          <button onClick={() => setSide({ kind: 'new', managerId: selected && !selected.vacancy ? selected.id : ROOT_ID })}
            className="text-[11.5px] font-medium px-3.5 py-1.5 rounded-md bg-[#c45d2e] hover:bg-[#d46a38] text-white transition-colors">
            + Add person
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-2 border-b border-[#232323]">
          {STRIPES.map(s => (
            <span key={s} className="flex items-center gap-1.5 font-mono text-[9.5px] tracking-wider uppercase text-[#6a6a6a]">
              <span className="w-2 h-2 rounded-full" style={{ background: STRIPE_COLOURS[s] }} />{s}
            </span>
          ))}
          <span className="flex-1" />
          <span className="text-[10.5px] text-[#555] hidden xl:inline">Drag a card onto someone to change who they report to.</span>
          <div className="flex items-center rounded-md border border-[#333] overflow-hidden font-mono text-[10.5px]">
            <button onClick={() => stepZoom(-0.1)} className="px-2 py-1 text-[#888] hover:text-white hover:bg-white/5" title="Zoom out">−</button>
            <button onClick={() => setZoom(fitZoom())} className="px-2 py-1 text-[#aaa] hover:text-white hover:bg-white/5 border-x border-[#333] w-14" title="Fit to width">{Math.round(z * 100)}%</button>
            <button onClick={() => stepZoom(0.1)} className="px-2 py-1 text-[#888] hover:text-white hover:bg-white/5" title="Zoom in">+</button>
          </div>
        </div>

        {/* Canvas */}
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}
          onDragCancel={() => { setDragId(null); setOverId(null) }}>
          <div ref={canvasRef} className="flex-1 overflow-auto org-canvas">
            <div style={{ width: natural.w * z, height: natural.h * z, margin: '0 auto', opacity: zoom === null ? 0 : 1 }} className="transition-opacity duration-200 overflow-hidden">
            <div ref={contentRef} style={{ transform: `scale(${z})`, transformOrigin: '0 0' }} className="inline-flex flex-col items-center px-10 pt-10 pb-24">
              <OrgCard {...cardProps(root)} size="root" teamCount={named - 1} />
              <div className="w-px h-8 bg-gradient-to-b from-[#c45d2e]/70 to-[#3a3a3a]" />

              <div className="flex items-start">
                {directs.map((d, i) => {
                  const hue = hueFor(d, people)
                  const first = i === 0, last = i === directs.length - 1
                  return (
                    <div key={d.id} className="relative flex flex-col items-start px-3.5 pt-6">
                      {/* Bus: each column draws its half of the horizontal line plus a stub. */}
                      {!first && <div className="absolute top-0 left-0 right-1/2 h-px bg-[#3a3a3a]" />}
                      {!last && <div className="absolute top-0 left-1/2 right-0 h-px bg-[#3a3a3a]" />}
                      <div className="absolute top-0 left-1/2 w-px h-6" style={{ background: `linear-gradient(#3a3a3a, ${hue}aa)` }} />
                      <OrgCard {...cardProps(d)} size="direct" />
                      <div className="ml-0">{renderBranch(d.id)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {dragged && <OrgCard person={dragged} hue={hueFor(dragged, people)} size="node" overlay />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Right-hand panels */}
      {(side?.kind === 'edit' || side?.kind === 'new') && initialDraft && (
        <PersonPanel
          key={side.kind === 'edit' ? side.id : `new-${side.managerId}`}
          mode={side.kind}
          person={selected}
          initial={initialDraft}
          people={people}
          hue={panelHue}
          busy={busy}
          onSave={save}
          onRemove={remove}
          onAddReport={() => selected && setSide({ kind: 'new', managerId: selected.id })}
          onClose={() => setSide(null)}
        />
      )}
      {side?.kind === 'history' && (
        <SidePanel title="History" subtitle="Also in context/org-changes.md" onClose={() => setSide(null)}>
          {changes.length === 0 ? (
            <p className="text-[11.5px] text-[#666]">No changes yet. Every move, add, edit and removal shows here.</p>
          ) : (
            <ol className="relative border-l border-[#2e2e2e] ml-1.5 space-y-4">
              {changes.map(c => (
                <li key={c.id} className="pl-4 relative">
                  <span className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full bg-[#c45d2e]" />
                  <div className="font-mono text-[9.5px] text-[#666]">{new Date(c.at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="text-[11.5px] text-[#cfcfcf] leading-snug mt-0.5">{c.summary}</div>
                </li>
              ))}
            </ol>
          )}
        </SidePanel>
      )}
      {side?.kind === 'slides' && (
        <SidePanel title="Check vs Slides" subtitle="Read-only. Pepper never edits the shared deck." onClose={() => setSide(null)}
          footer={<div className="flex gap-2">
            <ToolButton onClick={runSlidesCheck}>Run again</ToolButton>
            <ToolButton onClick={() => window.api.org.openSlides()}>Open deck ↗</ToolButton>
          </div>}>
          <SlidesResult result={slides} onAdd={(name, role) => setSide({ kind: 'new', managerId: ROOT_ID, preset: { name, role, tier: role.match(/manager 2/i) ? 'EM2' : role.match(/manager 1/i) ? 'EM1' : role.match(/director|cto|cio|head/i) ? 'Director' : role.match(/principal/i) ? 'Principal' : 'Other' } })} />
        </SidePanel>
      )}

      {/* Sync toast */}
      {toast && (
        <div className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-3 shadow-2xl border backdrop-blur org-pop max-w-[520px] ${
          toast.tone === 'ok' ? 'bg-[#1f2a23]/95 border-[#4caf82]/30' : toast.tone === 'warn' ? 'bg-[#2b2617]/95 border-[#d4a843]/40' : 'bg-[#2b1a1c]/95 border-[#FC2847]/40'
        }`}>
          {toast.lines.map((l, i) => (
            <div key={i} className={`text-[11.5px] leading-relaxed flex gap-2 ${i === 0 ? 'text-[#f0f0f0] font-medium' : 'text-[#a8a8a8]'}`}>
              {i > 0 && <span className={toast.tone === 'ok' ? 'text-[#4caf82]' : 'text-[#d4a843]'}>✓</span>}{l}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SidePanel({ title, subtitle, children, footer, onClose }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; onClose: () => void }) {
  return (
    <aside className="w-[340px] flex-shrink-0 border-l border-[#2c2c2e] bg-[#1f1f21]/95 flex flex-col org-pop">
      <div className="px-5 pt-5 pb-3 border-b border-[#2a2a2a] flex items-start">
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-[#eee]">{title}</div>
          {subtitle && <div className="text-[10.5px] text-[#666] mt-0.5">{subtitle}</div>}
        </div>
        <button onClick={onClose} className="w-7 h-7 -mr-2 -mt-1 rounded-md text-[#666] hover:text-[#ddd] hover:bg-white/5 flex items-center justify-center">
          <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="px-5 py-3 border-t border-[#2a2a2a]">{footer}</div>}
    </aside>
  )
}

function SlidesResult({ result, onAdd }: { result: SlidesCheck | { error: string } | 'loading' | null; onAdd: (name: string, role: string) => void }) {
  if (!result || result === 'loading') {
    return <div className="flex items-center gap-2 text-[11.5px] text-[#888]"><span className="w-3 h-3 rounded-full border-2 border-[#c45d2e] border-t-transparent animate-spin" />Reading the shared org chart…</div>
  }
  if ('error' in result) return <p className="text-[11.5px] text-[#FC2847]">Could not read the deck: {result.error}</p>

  const Group = ({ title, tone, count, children }: { title: string; tone: string; count: number; children: ReactNode }) => (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone }} />
        <span className="font-mono text-[9.5px] tracking-widest uppercase text-[#888]">{title}</span>
        <span className="font-mono text-[10px] text-[#555]">{count}</span>
      </div>
      {count === 0 ? <p className="text-[11px] text-[#555] pl-3.5">None.</p> : <ul className="space-y-1">{children}</ul>}
    </section>
  )
  const Row = ({ children }: { children: ReactNode }) => <li className="rounded-md bg-[#262628] px-3 py-2 text-[11.5px] leading-snug">{children}</li>

  return (
    <div>
      <p className="text-[10.5px] text-[#666] mb-4">Checked {result.checkedAt}. Managers, directors and principals only; product and design roles skipped.</p>
      <Group title="In Slides, not in Pepper" tone="#FF9F0A" count={result.missingFromPepper.length}>
        {result.missingFromPepper.map(m => (
          <Row key={m.name}>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0"><div className="text-[#ddd]">{m.name}</div><div className="text-[10.5px] text-[#777]">{m.role} · slide {m.slide}</div></div>
              <button onClick={() => onAdd(m.name, m.role)} className="font-mono text-[10px] px-2 py-1 rounded border border-[#333] text-[#999] hover:text-white hover:border-[#555]">Add</button>
            </div>
          </Row>
        ))}
      </Group>
      <Group title="Role differs" tone="#4A9ECA" count={result.roleMismatch.length}>
        {result.roleMismatch.map(m => (
          <Row key={m.name}><div className="text-[#ddd]">{m.name}</div><div className="text-[10.5px] text-[#777]">Pepper: {m.pepperRole}<br />Slides: {m.slidesRole} · slide {m.slide}</div></Row>
        ))}
      </Group>
      <Group title="In Pepper, not in Slides" tone="#8E8E93" count={result.missingFromSlides.length}>
        {result.missingFromSlides.map(m => (
          <Row key={m.name}><div className="text-[#ddd]">{m.name}</div><div className="text-[10.5px] text-[#777]">{m.role}</div></Row>
        ))}
      </Group>
    </div>
  )
}
