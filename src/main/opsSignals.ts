import { getJiraCredentials } from './ai'
import { upsertOpsSignals } from './db'
import { broadcast } from './events'
import type { JiraCredentials, OpsSignal } from '../shared/types'

const POLL_INTERVAL_MS = 15 * 60 * 1000
const PAGE_SIZE = 100
const MAX_PAGES = 20 // backstop against a runaway cursor
const REQUEST_TIMEOUT_MS = 30_000

const FIELDS = ['summary', 'status', 'assignee', 'labels', 'created', 'updated']

let timer: ReturnType<typeof setInterval> | null = null
let inFlight = false

interface JiraIssue {
  key: string
  fields: {
    summary?: string
    status?: { name?: string }
    assignee?: { accountId?: string; displayName?: string } | null
    labels?: string[]
    created?: string
    updated?: string
  }
}

/**
 * The legacy GET /rest/api/3/search was removed from Jira Cloud (410 Gone) in
 * the 2025 sunset. This is the replacement: POST /rest/api/3/search/jql, which
 * pages on an opaque nextPageToken cursor and returns no total.
 */
function basicAuth(creds: JiraCredentials): string {
  return Buffer.from(`${creds.jiraEmail}:${creds.jiraApiToken}`).toString('base64')
}

/**
 * Verify the credentials actually authenticate.
 *
 * This exists because /search/jql answers a bad or missing token with
 * `200 {"issues":[]}` rather than a 401 — indistinguishable from a genuinely
 * empty result. Without this check a wrong token would render as "all clear",
 * which is the one thing a monitoring surface must never do. /myself does
 * return a real 401, so it is the honest test.
 */
async function assertAuthenticated(creds: JiraCredentials): Promise<void> {
  const res = await fetch(`${creds.jiraSiteUrl}/rest/api/3/myself`, {
    headers: { Authorization: `Basic ${basicAuth(creds)}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error('Jira rejected these credentials — check the email and API token.')
  }
  if (!res.ok) {
    throw new Error(`Jira ${res.status} ${res.statusText} while verifying credentials`)
  }
}

async function fetchPage(
  creds: JiraCredentials,
  nextPageToken?: string
): Promise<{ issues: JiraIssue[]; nextPageToken?: string }> {
  const auth = basicAuth(creds)

  const res = await fetch(`${creds.jiraSiteUrl}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jql: creds.opsJql,
      fields: FIELDS,
      maxResults: PAGE_SIZE,
      ...(nextPageToken ? { nextPageToken } : {}),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Jira ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ''}`)
  }

  return res.json() as Promise<{ issues: JiraIssue[]; nextPageToken?: string }>
}

function toSignal(issue: JiraIssue, siteUrl: string, syncedAt: string): OpsSignal {
  const f = issue.fields
  return {
    key: issue.key,
    source: 'jira',
    title: f.summary ?? issue.key,
    status: f.status?.name ?? 'Unknown',
    assignee_account_id: f.assignee?.accountId ?? null,
    assignee_name: f.assignee?.displayName ?? null,
    labels: f.labels ?? [],
    url: `${siteUrl}/browse/${issue.key}`,
    issue_created_at: f.created ?? syncedAt,
    issue_updated_at: f.updated ?? syncedAt,
    synced_at: syncedAt,
    tracked_task_id: null, // never overwritten — the upsert omits this column
  }
}

/**
 * Fetch every page of the configured JQL and upsert in one batch. Returns the
 * number of signals synced, or -1 when Jira isn't configured yet.
 */
export async function syncOpsSignals(): Promise<number> {
  const creds = getJiraCredentials()
  if (!creds) return -1

  if (inFlight) return 0
  inFlight = true
  try {
    await assertAuthenticated(creds)

    const syncedAt = new Date().toISOString()
    const issues: JiraIssue[] = []
    let token: string | undefined
    let page = 0

    do {
      const res = await fetchPage(creds, token)
      issues.push(...(res.issues ?? []))
      token = res.nextPageToken
      page++
    } while (token && page < MAX_PAGES)

    if (token) {
      console.warn(`Ops sync: stopped at ${MAX_PAGES} pages with more results available`)
    }

    // One batch, one save() — sql.js rewrites the entire DB file per save.
    const count = await upsertOpsSignals(issues.map(i => toSignal(i, creds.jiraSiteUrl, syncedAt)))
    broadcast({ type: 'ops:updated', count })
    return count
  } finally {
    inFlight = false
  }
}

/** Poll Jira in the background. Errors are logged, never thrown — a Jira
 *  outage or a bad token must not affect the rest of the app. */
export function startOpsPoller(): void {
  if (timer) return

  const tick = (): void => {
    syncOpsSignals()
      .then(count => {
        if (count > 0) console.log(`Ops signals: synced ${count}`)
      })
      .catch(e => console.error('Ops sync failed:', e))
  }

  tick()
  timer = setInterval(tick, POLL_INTERVAL_MS)
}

export function stopOpsPoller(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
