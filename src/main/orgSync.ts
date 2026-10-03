// Pushes org chart changes out to everything else that encodes the org:
//   • Pepper's own roster (@mentions, Ops "My directs")    — setTeamFromOrg
//   • Chief-of-Staff/context/team.md roster tables          — writeTeamMd
//   • Chief-of-Staff/context/org-changes.md change log      — appendChangeLog
//   • Drive 60.People-Leadership/10.Performance-Management  — ensurePerfFolders
//     (folder + Finder tag + Gmail label + drive-structure.md, the mandatory
//     three-step new-subfolder sequence)
// and reads — never writes — the shared Slides org chart for checkSlides.

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs'
import { readdir } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { homedir } from 'os'
import { getOrgPeople, patchOrgPerson, syncLabelsFromDrive } from './db'
import { broadcast } from './events'
import { setTeamFromOrg } from '../shared/team'
import {
  ROOT_ID, generateRosterMarkdown, spliceRoster, matchPerfFolder, nextPerfFolderName,
  parseSlideBox, compareWithSlides, type OrgPerson, type OrgSyncReport, type SlideBox, type SlidesCheck,
} from '../shared/org'

const execFileAsync = promisify(execFile)

const COS_ROOT = join(homedir(), 'Documents/Development/Chief-of-Staff')
const TEAM_MD = join(COS_ROOT, 'context/team.md')
const CHANGE_LOG = join(COS_ROOT, 'context/org-changes.md')
const DRIVE_STRUCTURE_MD = join(COS_ROOT, 'context/drive-structure.md')
const DRIVE_ROOT = join(homedir(), 'Library/CloudStorage/GoogleDrive/My Drive')
const PERF_REL = '60.People-Leadership/10.Performance-Management'
const PERF_DIR = join(DRIVE_ROOT, PERF_REL)
const PERF_FOLDER_ID = '133Z9AkLZGo-a7eSrRp4Wy8y-403Mp8Pj' // from context/drive-structure.md
const SLIDES_ORG_CHART_ID = '1M1CYcRNMX_SAL_m3rxOV0X3wYgTtUc2hPf_S5NC1kzk'
const TAG_KEYS = ['com.apple.metadata:_kMDItemUserTags', 'com.apple.metadata:kMDItemUserTags']


// Apps launched from Finder get a minimal PATH, so resolve gws explicitly.
function gwsBin(): string {
  for (const p of ['/opt/homebrew/bin/gws', '/usr/local/bin/gws']) if (existsSync(p)) return p
  return 'gws'
}

async function gws(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(gwsBin(), args, {
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ''}` },
  })
  return stdout
}

function stamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─── Change log ──────────────────────────────────────────────────────────────

export function appendChangeLog(summary: string, at = new Date()): void {
  if (!existsSync(join(COS_ROOT, 'context'))) return
  if (!existsSync(CHANGE_LOG)) {
    writeFileSync(CHANGE_LOG,
      '# Org changes\n\nEvery change made in Pepper Tasks › Org, newest last. Written by Pepper — do not edit by hand.\n\n')
  }
  appendFileSync(CHANGE_LOG, `- ${stamp(at)} — ${summary}\n`)
}

// ─── team.md ─────────────────────────────────────────────────────────────────

function writeTeamMd(people: OrgPerson[]): OrgSyncReport['teamMd'] {
  if (!existsSync(TEAM_MD)) return `team.md not found at ${TEAM_MD}`
  const md = readFileSync(TEAM_MD, 'utf-8')
  const next = spliceRoster(md, generateRosterMarkdown(people, stamp()))
  if (next === null) return 'team.md has no pepper-org markers — roster not written'
  // Ignore the timestamp line so an unchanged org doesn't rewrite the file.
  const body = (s: string) => s.replace(/^\*Last changed in Pepper:.*$/m, '')
  if (body(next) === body(md)) return 'unchanged'
  writeFileSync(TEAM_MD, next)
  return 'updated'
}

// ─── Drive Performance-Management folders ────────────────────────────────────

async function copyFinderTags(from: string, to: string): Promise<void> {
  for (const key of TAG_KEYS) {
    try {
      const { stdout } = await execFileAsync('/usr/bin/xattr', ['-p', '-x', key, from])
      const hex = stdout.replace(/\s+/g, '')
      if (hex) await execFileAsync('/usr/bin/xattr', ['-w', '-x', key, hex, to])
    } catch { /* source has no tag under this key */ }
  }
}

function updateDriveStructureMd(folder: string, personName: string): string | null {
  if (!existsSync(DRIVE_STRUCTURE_MD)) return 'drive-structure.md not found'
  const lines = readFileSync(DRIVE_STRUCTURE_MD, 'utf-8').split('\n')
  if (lines.some(l => l.includes(`── ${folder}`))) return null

  const disc = lines.findIndex(l => /^│   │   └── 999\.Disciplinary/.test(l))
  if (disc < 0) return 'drive-structure.md: Performance-Management tree not found — add the folder by hand'
  lines.splice(disc, 0, `│   │   ├── ${folder}`)

  const notes = lines.findIndex(l => l.startsWith('- The 60.People-Leadership folder has direct report subfolders for:'))
  if (notes >= 0 && !lines[notes].includes(personName)) lines[notes] += `, ${personName}`
  writeFileSync(DRIVE_STRUCTURE_MD, lines.join('\n'))
  return null
}

async function lookupFolderId(folder: string): Promise<string | null> {
  // The local folder takes a little while to reach Drive; poll briefly.
  for (let i = 0; i < 12; i++) {
    try {
      const out = await gws(['drive', 'files', 'list', '--params', JSON.stringify({
        q: `name='${folder}' and '${PERF_FOLDER_ID}' in parents and trashed=false`,
        fields: 'files(id,name)',
      })])
      const id = JSON.parse(out.slice(out.indexOf('{'))).files?.[0]?.id
      if (id) return id
    } catch { /* not synced yet, or gws unavailable */ }
    await new Promise(r => setTimeout(r, 10_000))
  }
  return null
}

async function createPerfFolder(person: OrgPerson, existing: string[], warnings: string[]): Promise<string> {
  const folder = nextPerfFolderName(person.name, existing)
  const abs = join(PERF_DIR, folder)
  mkdirSync(abs)
  await copyFinderTags(PERF_DIR, abs)

  try {
    await gws(['gmail', 'users', 'labels', 'create', '--params', '{"userId":"me"}',
      '--json', JSON.stringify({ name: `${PERF_REL}/${folder}` })])
  } catch (e) {
    warnings.push(`Gmail label ${PERF_REL}/${folder} not created: ${(e as Error).message.split('\n')[0]}`)
  }

  const err = updateDriveStructureMd(folder, person.name)
  if (err) warnings.push(err)

  // Fill in the Drive folder ID once Drive has synced it — not awaited, it can take a minute.
  lookupFolderId(folder).then(id => {
    if (id) updateDriveStructureMdId(folder, id)
    else appendChangeLog(`Drive folder ID for ${folder} not found after 2 min — add it to drive-structure.md`)
  })
  return folder
}

function updateDriveStructureMdId(folder: string, id: string): void {
  if (!existsSync(DRIVE_STRUCTURE_MD)) return
  const lines = readFileSync(DRIVE_STRUCTURE_MD, 'utf-8').split('\n')
  if (lines.some(l => l.startsWith(`| 60 → PM → ${folder} |`))) return
  let last = -1
  lines.forEach((l, i) => { if (l.startsWith('| 60 → PM → ')) last = i })
  if (last < 0) return
  lines.splice(last + 1, 0, `| 60 → PM → ${folder} | \`${id}\` |`)
  writeFileSync(DRIVE_STRUCTURE_MD, lines.join('\n'))
}

/** Every named direct report gets a Performance-Management folder. Never deletes or renames. */
async function ensurePerfFolders(people: OrgPerson[], report: OrgSyncReport): Promise<void> {
  if (!existsSync(PERF_DIR)) { report.warnings.push('Drive is not mounted — folders not checked'); return }
  const folders = (await readdir(PERF_DIR, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name)
  for (const p of people) {
    if (p.manager_id !== ROOT_ID || p.vacancy) continue
    if (p.perf_folder && folders.includes(p.perf_folder)) continue
    const matched = matchPerfFolder(p.name, folders)
    const folder = matched ?? await createPerfFolder(p, folders, report.warnings)
    if (!matched) { folders.push(folder); report.foldersCreated.push(folder) }
    await patchOrgPerson(p.id, { perf_folder: folder })
  }
  if (report.foldersCreated.length) {
    const { added } = await syncLabelsFromDrive(DRIVE_ROOT)
    if (added) broadcast({ type: 'labels:changed', added })
  }
}

// ─── Entry points ────────────────────────────────────────────────────────────

/**
 * Startup: load the roster, then reconcile in the background so anything missed
 * while the app was closed (e.g. Drive unmounted) catches up. Idempotent.
 */
export async function loadTeamFromOrg(): Promise<void> {
  setTeamFromOrg(await getOrgPeople())
  setTimeout(() => { runOrgSync().catch(e => console.error('Org sync failed:', e)) }, 8_000)
}

export async function runOrgSync(): Promise<OrgSyncReport> {
  const report: OrgSyncReport = { teamMd: 'unchanged', foldersCreated: [], warnings: [] }
  let people = await getOrgPeople()
  try { await ensurePerfFolders(people, report) } catch (e) { report.warnings.push(`Drive folders: ${(e as Error).message}`) }
  people = await getOrgPeople()
  setTeamFromOrg(people)
  try { report.teamMd = writeTeamMd(people) } catch (e) { report.teamMd = (e as Error).message }
  for (const f of report.foldersCreated) appendChangeLog(`Created Drive folder ${PERF_REL}/${f} (Finder tag + Gmail label)`)
  broadcast({ type: 'org:changed' })
  return report
}

interface SlidesText { slides: { pageElements?: unknown[] }[] }

function slideTexts(el: unknown, out: string[]): void {
  const e = el as Record<string, any>
  if (e.shape?.text?.textElements) {
    out.push(e.shape.text.textElements.map((t: any) => t.textRun?.content ?? '').join('').trim())
  }
  for (const c of e.elementGroup?.children ?? []) slideTexts(c, out)
  for (const r of e.table?.tableRows ?? []) for (const c of r.tableCells ?? []) {
    if (c.text?.textElements) out.push(c.text.textElements.map((t: any) => t.textRun?.content ?? '').join('').trim())
  }
}

/** Read-only comparison against the shared Slides org chart. Never writes to the deck. */
export async function checkSlides(): Promise<SlidesCheck> {
  const out = await gws(['slides', 'presentations', 'get', '--params', JSON.stringify({ presentationId: SLIDES_ORG_CHART_ID })])
  const deck = JSON.parse(out.slice(out.indexOf('{'))) as SlidesText
  const boxes: SlideBox[] = []
  deck.slides.forEach((s, i) => {
    const texts: string[] = []
    for (const el of s.pageElements ?? []) slideTexts(el, texts)
    for (const t of texts) { const b = parseSlideBox(t, i + 1); if (b) boxes.push(b) }
  })
  return compareWithSlides(await getOrgPeople(), boxes, stamp())
}

export const ORG_SLIDES_URL = `https://docs.google.com/presentation/d/${SLIDES_ORG_CHART_ID}/edit`
