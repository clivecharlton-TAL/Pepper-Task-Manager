import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import initSqlJs, { Database } from 'sql.js'
import type { Task, Label, LabelNode, CreateTaskInput, UpdateTaskInput, TaskFilters, ReportData, VelocityPoint, CompletionTimeItem, LabelBreakdownItem, TaskAttachment, TaskAttachmentWithStatus, SubTask, TaskLink } from '../shared/types'

const DB_PATH = join(app.getPath('userData'), 'tasks.db')

let db: Database | null = null

async function getDb(): Promise<Database> {
  if (db) return db

  const SQL = await initSqlJs()

  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  migrate(db)
  return db
}

function save(): void {
  if (!db) return
  const data = db.export()
  writeFileSync(DB_PATH, Buffer.from(data))
}

function migrate(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      colour TEXT NOT NULL DEFAULT '#8E8E93',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      labels TEXT NOT NULL DEFAULT '[]',
      assigned TEXT NOT NULL DEFAULT '[]',
      linked_email_id TEXT,
      linked_email_subject TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sub_tasks (
      id         TEXT PRIMARY KEY,
      task_id    TEXT NOT NULL,
      title      TEXT NOT NULL,
      done       INTEGER NOT NULL DEFAULT 0,
      assigned   TEXT,
      due_date   TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_attachments (
      id       TEXT PRIMARY KEY,
      task_id  TEXT NOT NULL,
      path     TEXT NOT NULL,
      name     TEXT NOT NULL,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_links (
      id       TEXT PRIMARY KEY,
      task_id  TEXT NOT NULL,
      url      TEXT NOT NULL,
      name     TEXT NOT NULL,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      labels TEXT NOT NULL DEFAULT '[]',
      occurred_at TEXT NOT NULL
    );
  `)

  // Migration: add assigned column to existing databases
  try { db.run(`ALTER TABLE tasks ADD COLUMN assigned TEXT NOT NULL DEFAULT '[]'`) } catch { /* column already exists */ }
  try { db.run(`ALTER TABLE sub_tasks ADD COLUMN notes TEXT`) } catch { /* column already exists */ }

  seedLabels(db)
  seedCrossCuttingLabels(db)
  save()
}

function run(db: Database, sql: string, params: (string | number | null | Uint8Array)[] = []): void {
  db.run(sql, params)
}

function all<T>(db: Database, sql: string, params: (string | number | null | Uint8Array)[] = []): T[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

function get<T>(db: Database, sql: string, params: (string | number | null | Uint8Array)[] = []): T | null {
  const rows = all<T>(db, sql, params)
  return rows[0] ?? null
}

function seedLabels(db: Database): void {
  const count = get<{ c: number }>(db, 'SELECT COUNT(*) as c FROM labels')?.c ?? 0
  if (count > 0) return

  const insert = (id: string, name: string, parentId: string | null, colour: string, order: number) => {
    run(db, 'INSERT OR IGNORE INTO labels (id, name, parent_id, colour, sort_order) VALUES (?, ?, ?, ?, ?)',
      [id, name, parentId, colour, order])
  }

  // Top-level with Drive colour mapping
  const roots: Array<[string, string, string, number]> = [
    ['00.Inbox', '00.Inbox', '#8E8E93', 0],
    ['05.Operational-Reports', '05.Operational-Reports', '#FF9300', 5],
    ['10.Strategy-Roadmap', '10.Strategy-Roadmap', '#007AFF', 10],
    ['20.Subsidiary-Directives', '20.Subsidiary-Directives', '#8E8E93', 20],
    ['30.Architecture-Standards', '30.Architecture-Standards', '#8E8E93', 30],
    ['40.Security-Risk-Compliance', '40.Security-Risk-Compliance', '#FC2847', 40],
    ['50.Financials-Procurement', '50.Financials-Procurement', '#FFC400', 50],
    ['60.People-Leadership', '60.People-Leadership', '#30D158', 60],
    ['70.Executive-Board-Reporting', '70.Executive-Board-Reporting', '#8E8E93', 70],
    ['80.Strategic-Programs', '80.Strategic-Programs', '#BF5AF2', 80],
    ['90.External-Advisory-Network', '90.External-Advisory-Network', '#8E8E93', 90],
    ['100.Templates', '100.Templates', '#8E8E93', 100],
    ['999.Archive', '999.Archive', '#8E8E93', 999]
  ]
  for (const [id, name, colour, order] of roots) insert(id, name, null, colour, order)

  const op = '05.Operational-Reports'
  insert(`${op}/00.Engineering-MBR`, '00.Engineering-MBR', op, '#FF9300', 0)
  insert(`${op}/10.Engineering-WBR`, '10.Engineering-WBR', op, '#FF9300', 10)
  insert(`${op}/30.Operational-Planning`, '30.Operational-Planning', op, '#FF9300', 30)
  insert(`${op}/40.Trip-Reports`, '40.Trip-Reports', op, '#FF9300', 40)
  insert(`${op}/50.GMV-Reports`, '50.GMV-Reports', op, '#FF9300', 50)

  const st = '10.Strategy-Roadmap'
  insert(`${st}/00.Inbox`, '00.Inbox', st, '#007AFF', 0)
  insert(`${st}/10.Org-Design`, '10.Org-Design', st, '#007AFF', 10)
  insert(`${st}/20.Return-to-Office`, '20.Return-to-Office', st, '#007AFF', 20)
  insert(`${st}/30.Education-and-Training`, '30.Education-and-Training', st, '#007AFF', 30)
  insert(`${st}/40.Performance-Management`, '40.Performance-Management', st, '#007AFF', 40)
  insert(`${st}/50.Software-Development-Lifecycle`, '50.Software-Development-Lifecycle', st, '#007AFF', 50)
  insert(`${st}/60.OP1-Planning`, '60.OP1-Planning', st, '#007AFF', 60)
  insert(`${st}/70.Business-Continuity-Plan`, '70.Business-Continuity-Plan', st, '#007AFF', 70)

  const sub = '20.Subsidiary-Directives'
  insert(`${sub}/20.1.Takealot`, '20.1.Takealot', sub, '#8E8E93', 0)
  insert(`${sub}/20.2.Mr-D`, '20.2.Mr-D', sub, '#8E8E93', 10)
  insert(`${sub}/20.3.TFS`, '20.3.TFS', sub, '#8E8E93', 20)
  insert(`${sub}/20.4.Shared-Services`, '20.4.Shared-Services', sub, '#8E8E93', 30)

  const arch = '30.Architecture-Standards'
  insert(`${arch}/00.Chaos-Engineering`, '00.Chaos-Engineering', arch, '#8E8E93', 0)
  insert(`${arch}/10.Legacy-Monolith-Risk-Mitigation`, '10.Legacy-Monolith-Risk-Mitigation', arch, '#8E8E93', 10)

  const sec = '40.Security-Risk-Compliance'
  insert(`${sec}/50.Shadow-IT-Register`, '50.Shadow-IT-Register', sec, '#FC2847', 50)

  const fin = '50.Financials-Procurement'
  insert(`${fin}/00.Anthropic`, '00.Anthropic', fin, '#FFC400', 0)
  insert(`${fin}/10.Notion`, '10.Notion', fin, '#FFC400', 10)
  insert(`${fin}/20.Google`, '20.Google', fin, '#FFC400', 20)
  insert(`${fin}/30.Amazon`, '30.Amazon', fin, '#FFC400', 30)
  insert(`${fin}/40.GitLab`, '40.GitLab', fin, '#FFC400', 40)

  const ppl = '60.People-Leadership'
  insert(`${ppl}/00.Inbox`, '00.Inbox', ppl, '#30D158', 0)
  insert(`${ppl}/05.Performance-Operating-Model`, '05.Performance-Operating-Model', ppl, '#30D158', 5)
  insert(`${ppl}/10.Performance-Management`, '10.Performance-Management', ppl, '#30D158', 10)
  insert(`${ppl}/20.Training-and-Certification`, '20.Training-and-Certification', ppl, '#30D158', 20)
  insert(`${ppl}/30.Job-Descriptions`, '30.Job-Descriptions', ppl, '#30D158', 30)
  insert(`${ppl}/100.Clive-Charlton`, '100.Clive-Charlton', ppl, '#30D158', 100)

  const pm = `${ppl}/10.Performance-Management`
  const directs = ['Renier-Hugo', 'William-Howard', 'Charles-Brittz', 'Filipe-Texeira',
    'Jonathan-Muir', 'Ryan-Hendriks', 'Nic', 'Stii-Pretorius', 'Mario-Defreitas',
    'Danie-Nagel', 'Axel-Tidemann', 'Pieter-Rautenbach']
  directs.forEach((name, i) => {
    const num = String((i + 1) * 10).padStart(2, '0')
    insert(`${pm}/${num}.${name}`, `${num}.${name}`, pm, '#30D158', (i + 1) * 10)
  })

  const prog = '80.Strategic-Programs'
  insert(`${prog}/00.AI-Enablement`, '00.AI-Enablement', prog, '#BF5AF2', 0)
  insert(`${prog}/10.Bar-Raiser`, '10.Bar-Raiser', prog, '#BF5AF2', 10)
  insert(`${prog}/20.CTO-12-Month-Plan`, '20.CTO-12-Month-Plan', prog, '#BF5AF2', 20)
  insert(`${prog}/30.Prosus-Engineering-Investment`, '30.Prosus-Engineering-Investment', prog, '#BF5AF2', 30)
  insert(`${prog}/40.Takealot-Summit-2026`, '40.Takealot-Summit-2026', prog, '#BF5AF2', 40)
  insert(`${prog}/50.Woolworths`, '50.Woolworths', prog, '#BF5AF2', 50)
  insert(`${prog}/60.VertexAI-Agentic-Shopping`, '60.VertexAI-Agentic-Shopping', prog, '#BF5AF2', 60)

  const ext = '90.External-Advisory-Network'
  insert(`${ext}/00.Audit-Reports`, '00.Audit-Reports', ext, '#8E8E93', 0)
}

function seedCrossCuttingLabels(db: Database): void {
  const CROSS_CUTTING: Array<[string, string, number]> = [
    ['+Research', '+Research', -50],
    ['+Review',   '+Review',   -40],
    ['+Blocked',  '+Blocked',  -30],
    ['+Waiting',  '+Waiting',  -20],
    ['+Urgent',   '+Urgent',   -10],
  ]
  for (const [id, name, order] of CROSS_CUTTING) {
    run(db, 'INSERT OR IGNORE INTO labels (id, name, parent_id, colour, sort_order) VALUES (?, ?, ?, ?, ?)',
      [id, name, null, '#5AC8FA', order])
  }
}

// ─── Labels ────────────────────────────────────────────────────────────────

export async function getLabels(): Promise<Label[]> {
  const d = await getDb()
  return all<Label>(d, 'SELECT * FROM labels ORDER BY sort_order, id')
}

export async function getLabelTree(): Promise<LabelNode[]> {
  const labels = await getLabels()
  const map = new Map<string, LabelNode>()
  const roots: LabelNode[] = []
  for (const l of labels) map.set(l.id, { ...l, children: [] })
  for (const node of map.values()) {
    if (node.parent_id) map.get(node.parent_id)?.children.push(node)
    else roots.push(node)
  }
  return roots
}

const ROOT_COLOURS: Record<string, string> = {
  '00.Inbox':                    '#8E8E93',
  '05.Operational-Reports':      '#FF9300',
  '10.Strategy-Roadmap':         '#007AFF',
  '20.Subsidiary-Directives':    '#8E8E93',
  '30.Architecture-Standards':   '#8E8E93',
  '40.Security-Risk-Compliance': '#FC2847',
  '50.Financials-Procurement':   '#FFC400',
  '60.People-Leadership':        '#30D158',
  '70.Executive-Board-Reporting':'#8E8E93',
  '80.Strategic-Programs':       '#BF5AF2',
  '90.External-Advisory-Network':'#8E8E93',
  '100.Templates':               '#8E8E93',
  '999.Archive':                 '#8E8E93',
}

export async function createLabel(id: string, name: string, parentId: string | null): Promise<void> {
  const d = await getDb()
  let colour = '#8E8E93'
  if (parentId) {
    const parent = get<{ colour: string }>(d, 'SELECT colour FROM labels WHERE id = ?', [parentId])
    if (parent) colour = parent.colour
  } else {
    colour = ROOT_COLOURS[id] ?? '#8E8E93'
  }
  const sortOrder = parseInt(name, 10) || 0
  run(d, 'INSERT OR IGNORE INTO labels (id, name, parent_id, colour, sort_order) VALUES (?, ?, ?, ?, ?)',
    [id, name, parentId, colour, sortOrder])
  save()
}

export async function syncLabelsFromDrive(drivePath: string): Promise<{ added: number }> {
  if (!existsSync(drivePath)) return { added: 0 }
  const d = await getDb()
  let added = 0

  function scan(dir: string, parentId: string | null, colour: string, depth: number): void {
    if (depth > 3) return
    let entries: ReturnType<typeof readdirSync>
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (!/^\d/.test(entry.name)) continue

      const id         = parentId ? `${parentId}/${entry.name}` : entry.name
      const entryColour = depth === 0 ? (ROOT_COLOURS[entry.name] ?? '#8E8E93') : colour
      const sortOrder  = parseInt(entry.name, 10) || 0

      run(d, 'INSERT OR IGNORE INTO labels (id, name, parent_id, colour, sort_order) VALUES (?, ?, ?, ?, ?)',
        [id, entry.name, parentId, entryColour, sortOrder])
      if (d.getRowsModified() > 0) added++

      scan(join(dir, entry.name), id, entryColour, depth + 1)
    }
  }

  scan(drivePath, null, '#8E8E93', 0)
  if (added > 0) save()
  return { added }
}

// ─── Tasks ─────────────────────────────────────────────────────────────────

function parseTask(row: Record<string, unknown>): Task {
  return {
    ...(row as Omit<Task, 'labels' | 'assigned'>),
    labels: JSON.parse(row.labels as string),
    assigned: JSON.parse((row.assigned as string | null | undefined) ?? '[]'),
  }
}

export async function getTasks(filters: TaskFilters = {}): Promise<Task[]> {
  const d = await getDb()
  let sql = 'SELECT * FROM tasks WHERE 1=1'
  const params: (string | number | null)[] = []

  if (filters.status) { sql += ' AND status = ?'; params.push(filters.status) }
  if (filters.priority) { sql += ' AND priority = ?'; params.push(filters.priority) }
  if (filters.search) {
    sql += ' AND (title LIKE ? OR notes LIKE ? OR assigned LIKE ?)'
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`)
  }
  if (filters.label) { sql += ' AND labels LIKE ?'; params.push(`%${filters.label}%`) }
  sql += ' ORDER BY created_at DESC'

  return all<Record<string, unknown>>(d, sql, params).map(parseTask)
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const d = await getDb()
  const now = new Date().toISOString()
  const task: Task = {
    id: uuidv4(),
    title: input.title,
    notes: input.notes ?? null,
    status: input.status ?? 'backlog',
    priority: input.priority ?? 'medium',
    due_date: input.due_date ?? null,
    labels: input.labels ?? [],
    assigned: input.assigned ?? [],
    linked_email_id: input.linked_email_id ?? null,
    linked_email_subject: input.linked_email_subject ?? null,
    created_at: now,
    updated_at: now
  }
  run(d,
    `INSERT INTO tasks (id,title,notes,status,priority,due_date,labels,assigned,
      linked_email_id,linked_email_subject,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [task.id, task.title, task.notes, task.status, task.priority,
     task.due_date, JSON.stringify(task.labels), JSON.stringify(task.assigned),
     task.linked_email_id, task.linked_email_subject,
     task.created_at, task.updated_at]
  )
  run(d,
    'INSERT INTO task_events (id,task_id,event_type,priority,labels,occurred_at) VALUES (?,?,?,?,?,?)',
    [uuidv4(), task.id, 'task_created', task.priority, JSON.stringify(task.labels), now]
  )
  if (task.status === 'done') {
    run(d,
      'INSERT INTO task_events (id,task_id,event_type,priority,labels,occurred_at) VALUES (?,?,?,?,?,?)',
      [uuidv4(), task.id, 'task_completed', task.priority, JSON.stringify(task.labels), now]
    )
  }
  save()
  return task
}

export async function updateTask(input: UpdateTaskInput): Promise<Task | null> {
  const d = await getDb()
  const existing = get<Record<string, unknown>>(d, 'SELECT * FROM tasks WHERE id = ?', [input.id])
  if (!existing) return null
  const current = parseTask(existing)
  // Explicit merge — never let undefined reach sql.js (it throws).
  // `'key' in input` distinguishes "not provided" from "explicitly set to null/undefined".
  const updated: Task = {
    id: current.id,
    title:              input.title    ?? current.title,
    notes:              'notes'              in input ? (input.notes              ?? null) : current.notes,
    status:             input.status   ?? current.status,
    priority:           input.priority ?? current.priority,
    due_date:           'due_date'           in input ? (input.due_date           ?? null) : current.due_date,
    labels:             input.labels   ?? current.labels,
    assigned:           input.assigned ?? current.assigned,
    linked_email_id:    'linked_email_id'    in input ? input.linked_email_id    : current.linked_email_id,
    linked_email_subject: 'linked_email_subject' in input ? input.linked_email_subject : current.linked_email_subject,
    created_at:         current.created_at,
    updated_at:         new Date().toISOString(),
  }
  run(d,
    `UPDATE tasks SET title=?,notes=?,status=?,priority=?,due_date=?,
      labels=?,assigned=?,linked_email_id=?,linked_email_subject=?,updated_at=? WHERE id=?`,
    [updated.title, updated.notes, updated.status, updated.priority,
     updated.due_date, JSON.stringify(updated.labels), JSON.stringify(updated.assigned),
     updated.linked_email_id, updated.linked_email_subject,
     updated.updated_at, updated.id]
  )
  if (current.status !== 'done' && updated.status === 'done') {
    run(d,
      'INSERT INTO task_events (id,task_id,event_type,priority,labels,occurred_at) VALUES (?,?,?,?,?,?)',
      [uuidv4(), updated.id, 'task_completed', updated.priority, JSON.stringify(updated.labels), updated.updated_at]
    )
  }
  save()
  return updated
}

export async function deleteTask(id: string): Promise<boolean> {
  const d = await getDb()
  const row = get<Record<string, unknown>>(d, 'SELECT * FROM tasks WHERE id = ?', [id])
  if (row) {
    const task = parseTask(row)
    run(d,
      'INSERT INTO task_events (id,task_id,event_type,priority,labels,occurred_at) VALUES (?,?,?,?,?,?)',
      [uuidv4(), id, 'task_deleted', task.priority, JSON.stringify(task.labels), new Date().toISOString()]
    )
  }
  run(d, 'DELETE FROM tasks WHERE id = ?', [id])
  save()
  return true
}

export async function getTask(id: string): Promise<Task | null> {
  const d = await getDb()
  const row = get<Record<string, unknown>>(d, 'SELECT * FROM tasks WHERE id = ?', [id])
  return row ? parseTask(row) : null
}

export async function getReportData(rangeDays: number): Promise<ReportData> {
  const d = await getDb()
  const since = rangeDays > 0
    ? new Date(Date.now() - rangeDays * 86400000).toISOString()
    : '2000-01-01T00:00:00.000Z'

  // ── Velocity ────────────────────────────────────────────────────────────
  const createdVel = all<{ wk: string; n: number }>(d,
    `SELECT strftime('%Y-W%W', occurred_at) as wk, COUNT(*) as n
     FROM task_events WHERE event_type='task_created' AND occurred_at >= ?
     GROUP BY wk ORDER BY wk`, [since])
  const completedVel = all<{ wk: string; n: number }>(d,
    `SELECT strftime('%Y-W%W', occurred_at) as wk, COUNT(*) as n
     FROM task_events WHERE event_type='task_completed' AND occurred_at >= ?
     GROUP BY wk ORDER BY wk`, [since])
  const weekKeys = new Set([...createdVel.map(r => r.wk), ...completedVel.map(r => r.wk)])
  const velocity: VelocityPoint[] = [...weekKeys].sort().map(wk => ({
    week: wk,
    created:   createdVel.find(r => r.wk === wk)?.n ?? 0,
    completed: completedVel.find(r => r.wk === wk)?.n ?? 0,
  }))

  // ── Completion time ──────────────────────────────────────────────────────
  const ctRows = all<{ task_id: string; priority: string; labels: string; days: number }>(d,
    `SELECT c.task_id, c.priority, c.labels,
       CAST(julianday(x.occurred_at) - julianday(c.occurred_at) AS REAL) as days
     FROM task_events c
     JOIN (
       SELECT task_id, MIN(occurred_at) as occurred_at
       FROM task_events WHERE event_type='task_completed'
       GROUP BY task_id
     ) x ON c.task_id = x.task_id
     WHERE c.event_type='task_created'
       AND julianday(x.occurred_at) >= julianday(c.occurred_at)
       AND x.occurred_at >= ?`, [since])

  const priMap: Record<string, { sum: number; count: number }> = {}
  const lblMap: Record<string, { sum: number; count: number }> = {}
  for (const r of ctRows) {
    if (!priMap[r.priority]) priMap[r.priority] = { sum: 0, count: 0 }
    priMap[r.priority].sum += r.days; priMap[r.priority].count++
    const labels: string[] = JSON.parse(r.labels)
    const top = labels[0]?.split('/')[0] ?? 'Unlabeled'
    if (!lblMap[top]) lblMap[top] = { sum: 0, count: 0 }
    lblMap[top].sum += r.days; lblMap[top].count++
  }

  const labelColourRows = all<{ id: string; colour: string }>(d,
    'SELECT id, colour FROM labels WHERE parent_id IS NULL')
  const colourMap: Record<string, string> = {}
  for (const l of labelColourRows) colourMap[l.id] = l.colour

  const PRIORITY_COLOUR: Record<string, string> = { high: '#FC2847', medium: '#FFC400', low: '#30D158' }
  const byPriority: CompletionTimeItem[] = Object.entries(priMap)
    .map(([p, { sum, count }]) => ({ label: p, avgDays: Math.round((sum / count) * 10) / 10, count, colour: PRIORITY_COLOUR[p] ?? '#8E8E93' }))
    .sort((a, b) => ['high', 'medium', 'low'].indexOf(a.label) - ['high', 'medium', 'low'].indexOf(b.label))
  const byLabel: CompletionTimeItem[] = Object.entries(lblMap)
    .map(([l, { sum, count }]) => ({ label: l, avgDays: Math.round((sum / count) * 10) / 10, count, colour: colourMap[l] ?? '#8E8E93' }))
    .sort((a, b) => a.avgDays - b.avgDays).slice(0, 8)

  // ── Backlog health ───────────────────────────────────────────────────────
  const statusRows = all<{ status: string; n: number }>(d, 'SELECT status, COUNT(*) as n FROM tasks GROUP BY status')
  const overdueRow  = get<{ n: number }>(d, `SELECT COUNT(*) as n FROM tasks WHERE due_date < date('now') AND status != 'done'`)
  const avgAgeRow   = get<{ avg: number | null }>(d, `SELECT AVG(julianday('now') - julianday(created_at)) as avg FROM tasks WHERE status != 'done'`)
  const noDueDateRow = get<{ n: number }>(d, `SELECT COUNT(*) as n FROM tasks WHERE due_date IS NULL AND status != 'done'`)
  const totalOpen   = statusRows.filter(r => r.status !== 'done').reduce((s, r) => s + r.n, 0)

  // ── Label breakdown ──────────────────────────────────────────────────────
  const taskRows = all<{ labels: string; status: string }>(d, 'SELECT labels, status FROM tasks')
  const bkMap: Record<string, LabelBreakdownItem> = {}
  for (const row of taskRows) {
    const labels: string[] = JSON.parse(row.labels)
    const top = labels[0]?.split('/')[0] ?? 'Unlabeled'
    if (!bkMap[top]) bkMap[top] = { label: top, colour: colourMap[top] ?? '#8E8E93', total: 0, done: 0, inProgress: 0, todo: 0, backlog: 0 }
    const b = bkMap[top]; b.total++
    if      (row.status === 'done')        b.done++
    else if (row.status === 'in_progress') b.inProgress++
    else if (row.status === 'todo')        b.todo++
    else                                   b.backlog++
  }

  return {
    velocity,
    completionTime: { byPriority, byLabel },
    backlogHealth: {
      byStatus:       statusRows.map(r => ({ status: r.status, count: r.n })),
      overdueCount:   overdueRow?.n ?? 0,
      avgAgeDays:     Math.round((avgAgeRow?.avg ?? 0) * 10) / 10,
      noDueDateCount: noDueDateRow?.n ?? 0,
      totalOpen,
    },
    labelBreakdown: Object.values(bkMap).sort((a, b) => b.total - a.total),
  }
}

// ─── Attachments ────────────────────────────────────────────────────────────

export async function listAttachments(taskId: string): Promise<TaskAttachmentWithStatus[]> {
  const d = await getDb()
  const rows = all<TaskAttachment>(d,
    'SELECT * FROM task_attachments WHERE task_id = ? ORDER BY added_at ASC', [taskId])
  return rows.map(r => ({ ...r, exists: existsSync(r.path) }))
}

export async function addAttachment(taskId: string, filePath: string): Promise<TaskAttachmentWithStatus | { error: string }> {
  const d = await getDb()
  const existing = all<TaskAttachment>(d, 'SELECT * FROM task_attachments WHERE task_id = ?', [taskId])
  if (existing.length >= 10) return { error: 'Maximum 10 attachments per task' }
  const duplicate = existing.find(r => r.path === filePath)
  if (duplicate) return { ...duplicate, exists: existsSync(duplicate.path) }
  const record: TaskAttachment = {
    id: uuidv4(),
    task_id: taskId,
    path: filePath,
    name: filePath.split('/').pop() ?? filePath,
    added_at: new Date().toISOString(),
  }
  run(d, 'INSERT INTO task_attachments (id, task_id, path, name, added_at) VALUES (?, ?, ?, ?, ?)',
    [record.id, record.task_id, record.path, record.name, record.added_at])
  save()
  return { ...record, exists: existsSync(record.path) }
}

export async function removeAttachment(attachmentId: string): Promise<void> {
  const d = await getDb()
  run(d, 'DELETE FROM task_attachments WHERE id = ?', [attachmentId])
  save()
}

// ─── Links ──────────────────────────────────────────────────────────────────

export async function listLinks(taskId: string): Promise<TaskLink[]> {
  const d = await getDb()
  return all<TaskLink>(d, 'SELECT * FROM task_links WHERE task_id = ? ORDER BY added_at ASC', [taskId])
}

export async function addLink(taskId: string, url: string, name: string): Promise<TaskLink | { error: string }> {
  const d = await getDb()
  const existing = all<TaskLink>(d, 'SELECT * FROM task_links WHERE task_id = ?', [taskId])
  if (existing.length >= 20) return { error: 'Maximum 20 links per task' }
  const duplicate = existing.find(r => r.url === url)
  if (duplicate) return duplicate
  const record: TaskLink = {
    id: uuidv4(),
    task_id: taskId,
    url,
    name,
    added_at: new Date().toISOString(),
  }
  run(d, 'INSERT INTO task_links (id, task_id, url, name, added_at) VALUES (?, ?, ?, ?, ?)',
    [record.id, record.task_id, record.url, record.name, record.added_at])
  save()
  return record
}

export async function removeLink(linkId: string): Promise<void> {
  const d = await getDb()
  run(d, 'DELETE FROM task_links WHERE id = ?', [linkId])
  save()
}

// ─── Sub-tasks ──────────────────────────────────────────────────────────────

function parseSubTask(row: Record<string, unknown>): SubTask {
  return { ...(row as Omit<SubTask, 'done' | 'notes'>), notes: (row.notes as string | null) ?? null, done: row.done === 1 }
}

export async function listSubTasks(taskId: string): Promise<SubTask[]> {
  const d = await getDb()
  return all<Record<string, unknown>>(d,
    'SELECT * FROM sub_tasks WHERE task_id = ? ORDER BY sort_order ASC, created_at ASC', [taskId])
    .map(parseSubTask)
}

export async function createSubTask(taskId: string, title: string): Promise<SubTask> {
  const d = await getDb()
  const count = (get<{ n: number }>(d, 'SELECT COUNT(*) as n FROM sub_tasks WHERE task_id = ?', [taskId])?.n ?? 0)
  const st: SubTask = {
    id: uuidv4(), task_id: taskId, title, notes: null,
    done: false, assigned: null, due_date: null,
    sort_order: count, created_at: new Date().toISOString(),
  }
  run(d, 'INSERT INTO sub_tasks (id,task_id,title,notes,done,assigned,due_date,sort_order,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [st.id, st.task_id, st.title, null, 0, null, null, st.sort_order, st.created_at])
  save()
  return st
}

export async function updateSubTask(id: string, patch: Partial<Pick<SubTask, 'title' | 'notes' | 'done' | 'assigned' | 'due_date' | 'sort_order'>>): Promise<SubTask | null> {
  const d = await getDb()
  const row = get<Record<string, unknown>>(d, 'SELECT * FROM sub_tasks WHERE id = ?', [id])
  if (!row) return null
  const current = parseSubTask(row)
  const updated: SubTask = {
    ...current,
    title:      patch.title      !== undefined ? patch.title      : current.title,
    notes:      patch.notes      !== undefined ? patch.notes      : current.notes,
    done:       patch.done       !== undefined ? patch.done       : current.done,
    assigned:   patch.assigned   !== undefined ? patch.assigned   : current.assigned,
    due_date:   patch.due_date   !== undefined ? patch.due_date   : current.due_date,
    sort_order: patch.sort_order !== undefined ? patch.sort_order : current.sort_order,
  }
  run(d, 'UPDATE sub_tasks SET title=?,notes=?,done=?,assigned=?,due_date=?,sort_order=? WHERE id=?',
    [updated.title, updated.notes, updated.done ? 1 : 0, updated.assigned, updated.due_date, updated.sort_order, id])
  save()
  return updated
}

export async function deleteSubTask(id: string): Promise<void> {
  const d = await getDb()
  run(d, 'DELETE FROM sub_tasks WHERE id = ?', [id])
  save()
}

export async function countSubTasks(): Promise<Record<string, { done: number; total: number }>> {
  const d = await getDb()
  const rows = all<{ task_id: string; done: number; total: number }>(d,
    'SELECT task_id, SUM(done) as done, COUNT(*) as total FROM sub_tasks GROUP BY task_id')
  const result: Record<string, { done: number; total: number }> = {}
  for (const r of rows) result[r.task_id] = { done: r.done, total: r.total }
  return result
}

export async function countAttachments(): Promise<Record<string, number>> {
  const d = await getDb()
  const rows = all<{ task_id: string; n: number }>(d,
    'SELECT task_id, COUNT(*) as n FROM task_attachments GROUP BY task_id')
  const result: Record<string, number> = {}
  for (const r of rows) result[r.task_id] = r.n
  return result
}
