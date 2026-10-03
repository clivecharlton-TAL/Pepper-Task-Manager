import { useDraggable, useDroppable } from '@dnd-kit/core'
import { initials, type OrgPerson } from '../../../../shared/org'
import { TIER_LABEL } from './orgTheme'

export type DropState = 'none' | 'valid' | 'invalid'

interface Props {
  person: OrgPerson
  hue: string
  size?: 'root' | 'direct' | 'node'
  selected?: boolean
  dimmed?: boolean
  matched?: boolean
  dropState?: DropState
  teamCount?: number
  collapsed?: boolean
  onToggle?: () => void
  onClick?: () => void
  overlay?: boolean
}

export function Avatar({ person, hue, px }: { person: OrgPerson; hue: string; px: number }) {
  if (person.vacancy) {
    return (
      <span
        className="rounded-full flex items-center justify-center flex-shrink-0 border border-dashed"
        style={{ width: px, height: px, borderColor: `${hue}80`, color: `${hue}b0`, fontSize: px * 0.42 }}
      >+</span>
    )
  }
  return (
    <span
      className="rounded-full flex items-center justify-center flex-shrink-0 font-medium tracking-wide"
      style={{
        width: px, height: px, fontSize: px * 0.36,
        color: '#fff',
        background: `linear-gradient(140deg, ${hue} 0%, ${hue}99 100%)`,
        boxShadow: `0 0 0 2px #1c1c1e, 0 0 0 3px ${hue}55`,
      }}
    >{initials(person.name)}</span>
  )
}

export function OrgCard({
  person, hue, size = 'node', selected, dimmed, matched, dropState = 'none',
  teamCount, collapsed, onToggle, onClick, overlay,
}: Props) {
  const drag = useDraggable({ id: `org:${person.id}`, data: { personId: person.id }, disabled: overlay || size === 'root' })
  const drop = useDroppable({ id: `orgdrop:${person.id}`, data: { personId: person.id }, disabled: overlay || person.vacancy })

  const setRef = (el: HTMLElement | null) => { drag.setNodeRef(el); drop.setNodeRef(el) }
  const isDragging = drag.isDragging && !overlay

  const ring =
    dropState === 'valid'   ? `0 0 0 2px ${hue}, 0 10px 30px -8px ${hue}90` :
    dropState === 'invalid' ? '0 0 0 2px #FC284766' :
    selected                ? `0 0 0 1.5px ${hue}, 0 8px 24px -10px ${hue}80` :
    matched                 ? '0 0 0 1.5px #FFC400aa' :
    overlay                 ? `0 0 0 1.5px ${hue}, 0 18px 40px -10px #000` :
                              '0 1px 0 #ffffff08 inset, 0 4px 14px -8px #000'

  const base = 'relative group select-none transition-all duration-150 ease-out cursor-pointer'
  const surface = person.vacancy
    ? 'bg-[#1f1f1f]/80 border border-dashed border-[#3a3a3a]'
    : 'bg-gradient-to-b from-[#2a2a2c] to-[#232325] border border-[#323234]'

  const tier = TIER_LABEL[person.tier]

  if (size === 'root') {
    return (
      <div ref={setRef} onClick={onClick}
        className={`${base} ${surface} rounded-2xl px-5 py-4 flex items-center gap-4 min-w-[300px]`}
        style={{ boxShadow: ring }}>
        <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, transparent, ${hue}, transparent)` }} />
        <Avatar person={person} hue={hue} px={46} />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-[#f2f2f2] leading-tight">{person.name}</div>
          <div className="text-[12px] text-[#9a9a9a] leading-tight mt-0.5">{person.role}</div>
          <div className="font-mono text-[9.5px] tracking-widest uppercase mt-1.5" style={{ color: hue }}>{teamCount} in org</div>
        </div>
      </div>
    )
  }

  if (size === 'direct') {
    return (
      <div ref={setRef} {...drag.listeners} {...drag.attributes} onClick={onClick}
        className={`${base} ${surface} rounded-xl px-3.5 pt-3.5 pb-3 w-[236px] ${isDragging ? 'opacity-30' : ''} ${dimmed ? 'opacity-35' : ''} hover:-translate-y-0.5`}
        style={{ boxShadow: ring }}>
        <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl" style={{ background: hue }} />
        <div className="flex items-center gap-3">
          <Avatar person={person} hue={hue} px={36} />
          <div className="min-w-0 flex-1">
            <div className={`text-[13px] font-semibold leading-tight truncate ${person.vacancy ? 'text-[#777] italic' : 'text-[#f0f0f0]'}`}>
              {person.vacancy ? 'Vacant role' : person.name}
            </div>
            <div className="text-[11px] text-[#8d8d8d] leading-snug mt-0.5 line-clamp-2">{person.role}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2.5">
          {person.stripe && (
            <span className="font-mono text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded"
              style={{ color: hue, background: `${hue}18` }}>{person.stripe}</span>
          )}
          {person.contractor && (
            <span className="font-mono text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded text-[#d4a843] bg-[#d4a843]/10"
              title={`Contractor via ${person.contractor}`}>Contractor</span>
          )}
          <span className="flex-1" />
          {!!teamCount && (
            <button
              onClick={e => { e.stopPropagation(); onToggle?.() }}
              onPointerDown={e => e.stopPropagation()}
              className="font-mono text-[10px] text-[#7a7a7a] hover:text-[#d0d0d0] flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
              title={collapsed ? 'Show team' : 'Hide team'}
            >
              {teamCount}
              <svg width="9" height="9" viewBox="0 0 10 10" className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}>
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={setRef} {...drag.listeners} {...drag.attributes} onClick={onClick}
      className={`${base} ${surface} rounded-lg h-[46px] pl-2 pr-2.5 flex items-center gap-2.5 w-[236px] ${isDragging ? 'opacity-30' : ''} ${dimmed ? 'opacity-35' : ''} hover:translate-x-0.5`}
      style={{ boxShadow: ring }}>
      <Avatar person={person} hue={hue} px={28} />
      <div className="min-w-0 flex-1">
        <div className={`text-[12.5px] leading-[16px] truncate ${person.vacancy ? 'text-[#6f6f6f] italic' : 'text-[#e8e8e8] font-medium'}`}>
          {person.vacancy ? 'Vacant role' : person.name}
        </div>
        <div className="text-[10.5px] leading-[14px] text-[#7d7d7d] truncate">
          {person.team || person.role}
        </div>
      </div>
      {tier && (
        <span className="font-mono text-[8.5px] tracking-wider px-1 py-[1px] rounded flex-shrink-0"
          style={{ color: `${hue}`, background: `${hue}14` }}>{tier}</span>
      )}
      {!!teamCount && (
        <button
          onClick={e => { e.stopPropagation(); onToggle?.() }}
          onPointerDown={e => e.stopPropagation()}
          className="font-mono text-[9.5px] text-[#6a6a6a] hover:text-[#cfcfcf] flex items-center gap-0.5 flex-shrink-0"
          title={collapsed ? 'Show team' : 'Hide team'}
        >
          {teamCount}
          <svg width="8" height="8" viewBox="0 0 10 10" className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}>
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
