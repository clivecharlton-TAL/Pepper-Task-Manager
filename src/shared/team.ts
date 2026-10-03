import { ORG_SEED } from './orgSeed'
import { ROOT_ID, emailOf, type OrgPerson } from './org'

export interface TeamMember {
  name: string
  role: string
  email: string
  isDirect: boolean
}

// Emails follow firstname.lastname@takealot.com
function emailFor(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '.') + '@takealot.com'
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function buildMentionRegex(members: TeamMember[]): RegExp {
  // Longest names first so "Charles Van Wyk" wins over a shorter prefix.
  const names = members.map(m => m.name).sort((a, b) => b.length - a.length).map(escapeRe)
  return new RegExp(`@(${names.join('|')})`, 'g')
}

// The roster is owned by the org chart (org_people table). It starts from the
// bundled seed so the main process and first paint have names before the DB
// loads, then setTeamFromOrg() replaces it in place. TEAM_MEMBERS is mutated
// rather than reassigned so every importer keeps seeing the live list.
export const TEAM_MEMBERS: TeamMember[] = ORG_SEED
  .filter(p => !p.vacancy)
  .map(p => ({ name: p.name, role: p.role, email: emailFor(p.name), isDirect: p.manager === ROOT_ID }))

export let MENTION_REGEX = buildMentionRegex(TEAM_MEMBERS)

export function setTeamFromOrg(people: OrgPerson[]): void {
  const next = people
    .filter(p => !p.vacancy && p.name.trim())
    .map(p => ({ name: p.name, role: p.role, email: emailOf(p), isDirect: p.manager_id === ROOT_ID }))
  TEAM_MEMBERS.splice(0, TEAM_MEMBERS.length, ...next)
  MENTION_REGEX = buildMentionRegex(TEAM_MEMBERS)
}

// The app's owner — used by the "My Tasks" filter to match assignees
export const ME = 'Clive Charlton'
export const ME_EMAIL = emailFor(ME)

// Assignees are free-text names entered via @mention, so match on name or email,
// case-insensitively, rather than requiring an exact string equality.
export function isMe(assignee: string): boolean {
  const s = assignee.trim().toLowerCase().replace(/^@/, '')
  return s === ME.toLowerCase() || s === ME_EMAIL
}
