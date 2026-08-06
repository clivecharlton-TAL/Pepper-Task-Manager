import { useState } from 'react'

const DEFAULT_SITE = 'https://takealotgroup.atlassian.net'
const TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-[#555555]">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'bg-[#1e1e1e] border border-[#333333] rounded px-2.5 py-1.5 font-mono text-[11px] ' +
  'text-[#d4d4d4] placeholder-[#444444] focus:outline-none focus:border-[#c45d2e] transition-colors'

/**
 * Inline credential setup. Follows the house pattern of prompting at the point
 * of need (see the Anthropic key prompt in TaskDetailModal) rather than a
 * separate settings screen — this app has none.
 *
 * The token is write-only from the renderer's side: it is sent to main and
 * never read back, so a saved token cannot be re-displayed here.
 */
export function OpsSettings({ configured, onSaved }: {
  configured: boolean
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [site, setSite] = useState(DEFAULT_SITE)
  const [jql, setJql] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSave = email.trim() && token.trim() && site.trim() && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      await window.api.ops.saveCredentials({
        jiraEmail: email.trim(),
        jiraApiToken: token.trim(),
        jiraSiteUrl: site.trim(),
        ...(jql.trim() ? { opsJql: jql.trim() } : {}),
      })
      const count = await window.api.ops.refresh()
      if (count < 0) {
        setError('Saved, but Jira still reports no credentials. Check the site URL.')
      } else {
        setToken('')
        setOpen(false)
        onSaved()
      }
    } catch (e) {
      // Surface the Jira error verbatim — a 401 here means a bad token, and
      // saying so beats a generic failure message.
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (configured && !open) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-[#4caf82]">Jira connected</span>
        <button
          onClick={() => setOpen(true)}
          className="font-mono text-[10px] text-[#555555] hover:text-[#888888] transition-colors"
        >
          change
        </button>
      </div>
    )
  }

  if (!configured && !open) {
    return (
      <div className="bg-[#232323] border border-[#2e2e2e] rounded-lg p-4">
        <p className="font-mono text-[11px] text-[#888888] mb-1">Jira not connected</p>
        <p className="font-mono text-[10px] text-[#555555] leading-relaxed mb-3">
          Connect a Jira account to pull operational signals into this view.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="font-mono text-[10px] px-3 py-1.5 rounded border border-[#c45d2e] text-[#c45d2e] bg-[#c45d2e]/10 hover:bg-[#c45d2e]/20 transition-colors"
        >
          Connect Jira
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[#232323] border border-[#2e2e2e] rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#555555]">Jira connection</span>
        <button
          onClick={() => { setOpen(false); setError(''); setToken('') }}
          className="font-mono text-[10px] text-[#555555] hover:text-[#f0f0f0] transition-colors"
        >
          ×
        </button>
      </div>

      <Field label="Email">
        <input
          autoFocus
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@takealot.com"
          className={inputClass}
        />
      </Field>

      <Field label="API token">
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          placeholder={configured ? 'Enter a new token to replace the saved one' : 'Paste your Atlassian API token'}
          className={inputClass}
        />
        <button
          onClick={() => window.api.ops.open(TOKEN_URL)}
          className="self-start font-mono text-[9px] text-[#555555] hover:text-[#c45d2e] transition-colors"
        >
          Create a token ↗
        </button>
      </Field>

      <Field label="Site URL">
        <input
          type="text"
          value={site}
          onChange={e => setSite(e.target.value)}
          placeholder={DEFAULT_SITE}
          className={inputClass}
        />
      </Field>

      <Field label="JQL (optional)">
        <input
          type="text"
          value={jql}
          onChange={e => setJql(e.target.value)}
          placeholder={'project = SR AND text ~ "Oracle" ORDER BY created DESC'}
          className={inputClass}
        />
      </Field>

      {error && <p className="font-mono text-[10px] text-[#FC2847] leading-relaxed">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="font-mono text-[10px] px-3 py-1.5 bg-[#c45d2e] text-white rounded hover:bg-[#d4692e] transition-colors disabled:opacity-40 disabled:hover:bg-[#c45d2e]"
        >
          {saving ? 'Connecting…' : 'Save & sync'}
        </button>
        <button
          onClick={() => { setOpen(false); setError(''); setToken('') }}
          className="font-mono text-[10px] text-[#555555] hover:text-[#f0f0f0] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
