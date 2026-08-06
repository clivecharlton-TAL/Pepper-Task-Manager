import { TEAM_MEMBERS } from './team'
import type { OpsSignal } from './types'

/**
 * Jira account IDs for Clive's direct reports.
 *
 * This map exists because Jira account IDs are opaque and cannot be derived
 * from a name — and because `emailFor()` in team.ts is unsafe against Jira:
 * several Takealot Jira users don't follow firstname.lastname@ (e.g. Naveen
 * Govender is asogan.govender@, Nthato Mahabane is molefi.mahabane@). Matching
 * on a derived email would silently mis-attribute those people.
 *
 * Add an entry as each direct report first appears in a synced signal.
 */
const DIRECT_ACCOUNT_IDS: Record<string, string> = {
  '620cea29156f53006b25703f': 'Renier Hugo',
}

const DIRECT_EMAILS = new Set(
  TEAM_MEMBERS.filter(m => m.name !== 'Clive Charlton').map(m => m.email.toLowerCase())
)

/**
 * True when a signal is assigned to one of Clive's directs.
 *
 * Matches on account ID first (authoritative), then falls back to the roster
 * email so a new direct is picked up before their ID is recorded above.
 */
export function isDirectReport(signal: OpsSignal): boolean {
  if (signal.assignee_account_id && DIRECT_ACCOUNT_IDS[signal.assignee_account_id]) return true
  if (!signal.assignee_name) return false
  return DIRECT_EMAILS.has(
    signal.assignee_name.toLowerCase().replace(/\s+/g, '.') + '@takealot.com'
  )
}
