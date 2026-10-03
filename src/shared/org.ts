// Org structure — pure logic shared by the main process (sync, persistence) and
// the renderer (Org view). No Electron or fs imports here so it stays testable.

export const ROOT_ID = 'clive-charlton'

export type OrgTier = 'CTO' | 'Director' | 'EM2' | 'EM1' | 'Principal' | 'Other'
export const TIERS: OrgTier[] = ['Director', 'EM2', 'EM1', 'Principal', 'Other']

// Stripe only applies to the CTO's direct reports; it groups them on the chart.
export const STRIPES = ['BU', 'Horizontal Enabler', 'Specialist', 'Group CIO scope'] as const

export interface OrgPerson {
  id: string
  name: string
  role: string
  tier: OrgTier
  team: string
  stripe: string | null
  manager_id: string | null
  vacancy: boolean
  contractor: string | null
  email: string | null      // override when the address isn't firstname.lastname@takealot.com
  perf_folder: string | null // Drive 60.People-Leadership/10.Performance-Management/<folder>
  sort_order: number
}

export interface OrgSeedPerson {
  key: string
  name: string
  role: string
  tier: string
  team: string
  manager: string | null
  stripe: string | null
  vacancy: boolean
  contractor: string | null
  order: number
}

export interface OrgChange {
  id: string
  at: string
  summary: string
}

export type OrgPatch = Partial<Omit<OrgPerson, 'id'>>

export interface OrgSyncReport {
  teamMd: 'updated' | 'unchanged' | string // string = error message
  foldersCreated: string[]
  warnings: string[]
}

const TIER_RANK: Record<OrgTier, number> = { CTO: 0, Director: 1, EM2: 2, EM1: 3, Principal: 4, Other: 5 }

export function byTierThenOrder(a: OrgPerson, b: OrgPerson): number {
  return TIER_RANK[a.tier] - TIER_RANK[b.tier] || Number(a.vacancy) - Number(b.vacancy) || a.sort_order - b.sort_order
}

export function childrenOf(people: OrgPerson[], id: string): OrgPerson[] {
  return people.filter(p => p.manager_id === id).sort(byTierThenOrder)
}

export function descendantIds(people: OrgPerson[], id: string): Set<string> {
  const out = new Set<string>()
  const walk = (pid: string) => {
    for (const c of people) {
      if (c.manager_id === pid && !out.has(c.id)) { out.add(c.id); walk(c.id) }
    }
  }
  walk(id)
  return out
}

/** A move is invalid if it would make someone report to themselves or to anyone beneath them. */
export function canMove(people: OrgPerson[], id: string, newManagerId: string): boolean {
  if (id === newManagerId || id === ROOT_ID) return false
  return !descendantIds(people, id).has(newManagerId)
}

export function managerChain(people: OrgPerson[], id: string): OrgPerson[] {
  const byId = new Map(people.map(p => [p.id, p]))
  const chain: OrgPerson[] = []
  let cur = byId.get(id)?.manager_id
  while (cur && chain.length < 20) {
    const m = byId.get(cur)
    if (!m) break
    chain.push(m)
    cur = m.manager_id
  }
  return chain
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function emailOf(p: Pick<OrgPerson, 'name' | 'email'>): string {
  return p.email || p.name.toLowerCase().trim().replace(/\s+/g, '.') + '@takealot.com'
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

// ─── Human-readable diff for the change log ─────────────────────────────────

export function describeChange(before: OrgPerson | null, after: OrgPerson | null, people: OrgPerson[]): string {
  const nameOf = (id: string | null) => (id && people.find(p => p.id === id)?.name) || '—'
  if (!before && after) return `Added ${after.name} (${after.role}) reporting to ${nameOf(after.manager_id)}`
  if (before && !after) return `Removed ${before.name} (${before.role}); their reports moved to ${nameOf(before.manager_id)}`
  if (!before || !after) return ''
  const parts: string[] = []
  if (before.manager_id !== after.manager_id) parts.push(`moved from ${nameOf(before.manager_id)} to ${nameOf(after.manager_id)}`)
  if (before.name !== after.name) parts.push(`renamed from ${before.name}`)
  if (before.role !== after.role) parts.push(`role "${before.role}" → "${after.role}"`)
  if (before.tier !== after.tier) parts.push(`tier ${before.tier} → ${after.tier}`)
  if (before.team !== after.team) parts.push(`team "${before.team || '—'}" → "${after.team || '—'}"`)
  if (before.stripe !== after.stripe) parts.push(`stripe ${before.stripe ?? '—'} → ${after.stripe ?? '—'}`)
  if (before.vacancy !== after.vacancy) parts.push(after.vacancy ? 'marked vacant' : 'role filled')
  if (before.contractor !== after.contractor) parts.push(`contractor ${before.contractor ?? 'no'} → ${after.contractor ?? 'no'}`)
  if (before.email !== after.email) parts.push(`email → ${emailOf(after)}`)
  return parts.length ? `${after.name}: ${parts.join('; ')}` : ''
}

// ─── context/team.md roster generation ──────────────────────────────────────

export const TEAM_MD_BEGIN = '<!-- pepper-org:begin — generated by Pepper Tasks › Org. Edit the org there, not here. -->'
export const TEAM_MD_END = '<!-- pepper-org:end -->'

const cell = (s: string) => s.replace(/\|/g, '/').trim() || '—'

function personName(p: OrgPerson): string {
  if (p.vacancy) return 'Vacancy'
  return p.contractor ? `${p.name} (contractor, ${p.contractor})` : p.name
}

export function generateRosterMarkdown(people: OrgPerson[], stamp: string): string {
  const root = people.find(p => p.id === ROOT_ID)
  const directs = childrenOf(people, ROOT_ID)
  const lines: string[] = [
    TEAM_MD_BEGIN,
    `*Last changed in Pepper: ${stamp}. ${people.filter(p => !p.vacancy).length} people, ${people.filter(p => p.vacancy).length} vacancies. Change history: \`context/org-changes.md\`.*`,
    '',
    '### Group CTO direct reports',
    '',
    `Reports to ${root?.name ?? 'Clive Charlton'} (${root?.role ?? 'Group CTO'}).`,
    '',
    '| Role | Name | Stripe |',
    '|---|---|---|',
    ...directs.map(d => `| ${cell(d.role)} | ${cell(personName(d))} | ${cell(d.stripe ?? '')} |`),
  ]
  for (const d of directs) {
    const below = [...descendantIds(people, d.id)]
    if (below.length === 0) continue
    lines.push('', `### ${d.team || d.role} — ${personName(d)}`, '',
      '| Tier | Role | Name | Team | Reports to |', '|---|---|---|---|---|')
    const walk = (id: string) => {
      for (const c of childrenOf(people, id)) {
        const mgr = people.find(p => p.id === c.manager_id)
        lines.push(`| ${c.tier} | ${cell(c.role)} | ${cell(personName(c))} | ${cell(c.team)} | ${cell(mgr?.name ?? '')} |`)
        walk(c.id)
      }
    }
    walk(d.id)
  }
  lines.push('', TEAM_MD_END)
  return lines.join('\n')
}

/** Replace the generated block in team.md. Returns null if the markers are missing. */
export function spliceRoster(md: string, block: string): string | null {
  const a = md.indexOf(TEAM_MD_BEGIN)
  const b = md.indexOf(TEAM_MD_END)
  if (a < 0 || b < a) return null
  return md.slice(0, a) + block + md.slice(b + TEAM_MD_END.length)
}

// ─── Drive Performance-Management folders ────────────────────────────────────

const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

/**
 * Find an existing NNN.First-Last folder for a person. Matches on first name plus
 * the first two letters of the surname, because existing folders carry legacy
 * spellings ("40.Filipe-Texeira", "90.Mario-Defreitas").
 */
export function matchPerfFolder(name: string, folders: string[]): string | null {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return null
  const first = letters(parts[0])
  const lastStart = letters(parts.slice(1).join('')).slice(0, 2)
  for (const f of folders) {
    const m = f.match(/^\d+\.(.+)$/)
    if (!m) continue
    const [fFirst, ...rest] = m[1].split('-')
    if (letters(fFirst) === first && letters(rest.join('')).startsWith(lastStart)) return f
  }
  return null
}

/** Next folder number: ten above the highest existing person folder, ignoring 999.* buckets. */
export function nextPerfFolderName(name: string, folders: string[]): string {
  const nums = folders.map(f => parseInt(f, 10)).filter(n => !isNaN(n) && n < 900)
  const next = (nums.length ? Math.max(...nums) : 0) + 10
  return `${next}.${name.trim().split(/\s+/).map(w => w.replace(/[^A-Za-z]/g, '')).filter(Boolean).join('-')}`
}

// ─── Shared Slides org chart check (read-only) ──────────────────────────────

export interface SlideBox { role: string; name: string; slide: number }

export interface SlidesCheck {
  checkedAt: string
  missingFromSlides: { name: string; role: string }[]
  missingFromPepper: { name: string; role: string; slide: number }[]
  roleMismatch: { name: string; pepperRole: string; slidesRole: string; slide: number }[]
}

const MGMT_ROLE = /(manager|director|\bcto\b|\bcio\b|head of|principal|\bem[12]\b|agile|lead)/i
const NON_ENG_ROLE = /(prod\b|prod\.|product|\bux\b|\bui\b|design|cpo)/i

/** Boxes on the deck read "Role\nName" (sometimes with a trailing note like "50%" or a date). */
export function parseSlideBox(text: string, slide: number): SlideBox | null {
  const lines = text.split(/\n|\u000b/).map(s => s.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const role = lines[0]
  const name = lines[1].replace(/\s*\(.*?\)\s*$/, '').replace(/\s+\d+%$/, '').trim()
  if (!/^[A-Z][A-Za-z'’-]+(\s+[A-Za-z'’.-]+){1,3}$/.test(name)) return null
  return { role, name, slide }
}

const normName = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

function sameName(a: string, b: string): boolean {
  if (normName(a) === normName(b)) return true
  // Tolerate one-letter spelling drift ("Ferdi" / "Ferdie") when surnames match.
  const [af, ...al] = a.split(/\s+/); const [bf, ...bl] = b.split(/\s+/)
  if (normName(al.join('')) !== normName(bl.join(''))) return false
  const x = normName(af), y = normName(bf)
  return x.startsWith(y) || y.startsWith(x)
}

function roleLevel(role: string): string | null {
  if (/manager\s*2|\bem2\b/i.test(role)) return 'L2'
  if (/manager\s*1|\bem1\b/i.test(role)) return 'L1'
  if (/director|\bcto\b|\bcio\b|head of/i.test(role)) return 'DIR'
  if (/principal/i.test(role)) return 'PRIN'
  return null
}

export function compareWithSlides(people: OrgPerson[], boxes: SlideBox[], checkedAt: string): SlidesCheck {
  const eng = boxes.filter(b => !NON_ENG_ROLE.test(b.role) && !/vacan/i.test(b.name))
  const named = people.filter(p => !p.vacancy)
  const missingFromSlides = named
    .filter(p => p.id !== ROOT_ID && !eng.some(b => sameName(b.name, p.name)))
    .map(p => ({ name: p.name, role: p.role }))
  const seen = new Set<string>()
  const missingFromPepper: SlidesCheck['missingFromPepper'] = []
  const roleMismatch: SlidesCheck['roleMismatch'] = []
  for (const b of eng) {
    if (!MGMT_ROLE.test(b.role)) continue
    const key = normName(b.name)
    if (seen.has(key)) continue
    seen.add(key)
    const p = named.find(x => sameName(x.name, b.name))
    if (!p) { missingFromPepper.push({ name: b.name, role: b.role, slide: b.slide }); continue }
    const lp = roleLevel(p.role), ls = roleLevel(b.role)
    if (lp && ls && lp !== ls) roleMismatch.push({ name: p.name, pepperRole: p.role, slidesRole: b.role, slide: b.slide })
  }
  return { checkedAt, missingFromSlides, missingFromPepper, roleMismatch }
}
