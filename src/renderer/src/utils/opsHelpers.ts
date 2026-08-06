import type { OpsSignal, OpsBand } from '../../../shared/types'

const ON_HOLD_STALE_DAYS = 7

// Clamped at 0: Jira stamps are +02:00 (SAST), so a just-updated issue can
// parse as marginally in the future and would otherwise render as "-1d".
export function daysSince(iso: string): number {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 0
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

/**
 * Which band a signal belongs to.
 *
 * Driven by the live `status` field, NOT by the notified-* labels: those are
 * historical stamps that Jira never removes, so 8 of the 14 issues carrying
 * `notified-unacked` are already Done. Labels are stored for trend only.
 */
export function bandFor(signal: OpsSignal): OpsBand {
  if (/^(Done|Resolved|Closed|Cancelled)/i.test(signal.status)) return 'resolved'
  if (/un-?ack/i.test(signal.status)) return 'attention'
  if (/on hold/i.test(signal.status) && daysSince(signal.issue_updated_at) > ON_HOLD_STALE_DAYS) return 'attention'
  return 'open'
}

export function isLive(signal: OpsSignal): boolean {
  return bandFor(signal) !== 'resolved'
}

/** Distinct assignees across live signals, with counts, busiest first. */
export function assigneeCounts(signals: OpsSignal[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of signals) {
    if (!s.assignee_name) continue
    counts.set(s.assignee_name, (counts.get(s.assignee_name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** Incident counts bucketed into the last `weeks` ISO weeks, oldest first. */
export function weeklyVolume(signals: OpsSignal[], weeks = 12): { label: string; count: number }[] {
  const now = Date.now()
  const buckets: { label: string; count: number }[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const end = now - i * 7 * 86_400_000
    const start = end - 7 * 86_400_000
    const count = signals.filter(s => {
      const t = new Date(s.issue_created_at).getTime()
      return !Number.isNaN(t) && t >= start && t < end
    }).length
    buckets.push({ label: new Date(end).toISOString().slice(5, 10), count })
  }
  return buckets
}
