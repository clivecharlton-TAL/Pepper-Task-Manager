import { describe, it, expect } from 'vitest'
import { ORG_SEED } from './orgSeed'
import {
  ROOT_ID, canMove, childrenOf, descendantIds, describeChange, generateRosterMarkdown, spliceRoster,
  TEAM_MD_BEGIN, TEAM_MD_END, matchPerfFolder, nextPerfFolderName, parseSlideBox, compareWithSlides,
  type OrgPerson, type OrgTier,
} from './org'
import { TEAM_MEMBERS, MENTION_REGEX, setTeamFromOrg } from './team'

const people: OrgPerson[] = ORG_SEED.map(p => ({
  id: p.key, name: p.name, role: p.role, tier: p.tier as OrgTier, team: p.team, stripe: p.stripe,
  manager_id: p.manager, vacancy: p.vacancy, contractor: p.contractor, email: null, perf_folder: null, sort_order: p.order,
}))

// Real folder names under 60.People-Leadership/10.Performance-Management on 2026-10-03.
const PERF_FOLDERS = ['10.Renier-Hugo', '100.Danie-Nagel', '110.Axel-Tidemann', '120.Pieter-Rautenbach', '20.William-Howard',
  '30.Charles-Brittz', '40.Filipe-Texeira', '50.Jonathan-Muir', '60.Ryan-Hendriks', '70.Nic-Torr', '80.Stii-Pretorius',
  '90.Mario-Defreitas', '999.Disciplinary']

describe('org seed', () => {
  it('has one root and every manager exists', () => {
    expect(people.filter(p => p.manager_id === null).map(p => p.id)).toEqual([ROOT_ID])
    const ids = new Set(people.map(p => p.id))
    for (const p of people) if (p.manager_id) expect(ids.has(p.manager_id), p.name).toBe(true)
    expect(ids.size).toBe(people.length)
  })

  it('reaches everyone from the root (no cycles, no orphans)', () => {
    expect(descendantIds(people, ROOT_ID).size).toBe(people.length - 1)
  })

  it('puts Ulvi under Clive as a contractor', () => {
    const ulvi = people.find(p => p.name === 'Ulvi Guliyev')!
    expect(ulvi.manager_id).toBe(ROOT_ID)
    expect(ulvi.contractor).toBe('Living Tensor')
  })
})

describe('moves', () => {
  it('blocks moving someone under their own team or themselves', () => {
    expect(canMove(people, 'filipe-teixeira', 'pieter-lourens')).toBe(false)
    expect(canMove(people, 'filipe-teixeira', 'filipe-teixeira')).toBe(false)
    expect(canMove(people, ROOT_ID, 'filipe-teixeira')).toBe(false)
    expect(canMove(people, 'pieter-lourens', 'mario-de-freitas')).toBe(true)
  })

  it('describes a move in plain words', () => {
    const before = people.find(p => p.id === 'stii-pretorius')!
    const after = { ...before, manager_id: ROOT_ID }
    expect(describeChange(before, after, people)).toBe('Stii Pretorius: moved from William Howard to Clive Charlton')
  })
})

describe('team.md roster', () => {
  const md = `# Team\n\nintro\n\n${TEAM_MD_BEGIN}\nold\n${TEAM_MD_END}\n\n## Profiles\nkeep me\n`

  it('replaces only the generated block', () => {
    const out = spliceRoster(md, generateRosterMarkdown(people, '2026-10-03 21:00'))!
    expect(out.startsWith('# Team\n\nintro\n\n')).toBe(true)
    expect(out.endsWith('\n\n## Profiles\nkeep me\n')).toBe(true)
    expect(out).not.toContain('\nold\n')
    expect(out).toContain('| Principal Engineer, AI Engineering Practice | Ulvi Guliyev (contractor, Living Tensor) | Specialist |')
    expect(out).toContain('### Group Fulfilment — Filipe Teixeira')
    expect(out).toContain('| EM2 | Eng Manager 2 | Kevin Tomsett | Network | Pieter Lourens |')
  })

  it('lists every person exactly once', () => {
    const out = generateRosterMarkdown(people, 'x')
    for (const p of people.filter(p => !p.vacancy && p.id !== ROOT_ID)) {
      const nameCol = (l: string) => {
        const c = l.split('|').slice(1, -1).map(x => x.trim())
        return c.length === 3 ? c[1] : c[2] // directs table vs division table
      }
      const hits = out.split('\n').filter(l => l.startsWith('|') && nameCol(l).startsWith(p.name)).length
      expect(hits, p.name).toBe(1)
    }
  })

  it('refuses to write when markers are missing', () => {
    expect(spliceRoster('# no markers', 'x')).toBeNull()
  })
})

describe('Drive Performance-Management folders', () => {
  it('matches existing folders despite legacy spellings', () => {
    expect(matchPerfFolder('Filipe Teixeira', PERF_FOLDERS)).toBe('40.Filipe-Texeira')
    expect(matchPerfFolder('Mario De Freitas', PERF_FOLDERS)).toBe('90.Mario-Defreitas')
    expect(matchPerfFolder('Ryan Hendriks', PERF_FOLDERS)).toBe('60.Ryan-Hendriks')
    expect(matchPerfFolder('Ulvi Guliyev', PERF_FOLDERS)).toBeNull()
  })

  it('every seeded direct except Ulvi already has a folder', () => {
    const missing = childrenOf(people, ROOT_ID).filter(d => !d.vacancy && !matchPerfFolder(d.name, PERF_FOLDERS))
    expect(missing.map(d => d.name)).toEqual(['Ulvi Guliyev'])
  })

  it('numbers a new folder ten above the highest, ignoring 999 buckets', () => {
    expect(nextPerfFolderName('Ulvi Guliyev', PERF_FOLDERS)).toBe('130.Ulvi-Guliyev')
    expect(nextPerfFolderName("Mary-Jane O'Neil", PERF_FOLDERS)).toBe('130.MaryJane-ONeil')
  })
})

describe('Slides check', () => {
  it('reads Role / Name boxes', () => {
    expect(parseSlideBox('Eng Manager 2\nKyle Govender', 3)).toEqual({ role: 'Eng Manager 2', name: 'Kyle Govender', slide: 3 })
    expect(parseSlideBox('QA Manager 1 \nJason Seekoei 50%', 15)?.name).toBe('Jason Seekoei')
    expect(parseSlideBox('CATALOGUE', 3)).toBeNull()
  })

  it('reports missing people and tier differences', () => {
    const boxes = [
      { role: 'Eng Manager 1', name: 'Kyle Govender', slide: 6 },  // seed says EM2
      { role: 'Eng Manager 1', name: 'New Person', slide: 6 },
      { role: 'Product Lead', name: 'Someone Product', slide: 4 }, // product: ignored
      { role: 'SE 3', name: 'Some Engineer', slide: 6 },          // IC: ignored
      ...people.filter(p => !p.vacancy && p.name !== 'Wilhelm Ellmann').map(p => ({ role: p.role, name: p.name, slide: 1 })),
    ]
    const r = compareWithSlides(people, boxes, 'now')
    expect(r.missingFromPepper.map(m => m.name)).toEqual(['New Person'])
    expect(r.roleMismatch.map(m => m.name)).toEqual(['Kyle Govender'])
    expect(r.missingFromSlides.map(m => m.name)).toEqual(['Wilhelm Ellmann'])
  })

  it('tolerates one-letter first-name drift', () => {
    const r = compareWithSlides(people, [{ role: 'QA Manager 1', name: 'Ferdi Nell', slide: 15 }], 'now')
    expect(r.missingFromPepper).toEqual([])
  })
})

describe('live roster', () => {
  it('follows the org: new names become @mentionable and directs are flagged', () => {
    const extra: OrgPerson = { ...people[1], id: 'new-hire', name: 'Thandi Mokoena', manager_id: ROOT_ID }
    setTeamFromOrg([...people, extra])
    expect(TEAM_MEMBERS.find(m => m.name === 'Thandi Mokoena')?.isDirect).toBe(true)
    expect(TEAM_MEMBERS.find(m => m.name === 'Kevin Tomsett')?.isDirect).toBe(false)
    expect(TEAM_MEMBERS.some(m => m.name === 'Vacancy')).toBe(false)
    MENTION_REGEX.lastIndex = 0
    expect(MENTION_REGEX.exec('ping @Thandi Mokoena today')?.[1]).toBe('Thandi Mokoena')
  })
})
