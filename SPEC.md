# Spec: File Attachments for Tasks

## 1. Objective

Allow users to attach files to tasks by linking to their location on disk. Files are **never copied** — the app stores the absolute path as a link. This avoids sync conflicts and version duplication while keeping files visible directly from a task.

**Target users:** Individual users managing tasks on macOS, with files living in Finder-accessible locations (local disk, mounted cloud drives like iCloud/Dropbox/Google Drive).

---

## 2. Core User Stories & Acceptance Criteria

### US-1: Attach via drag-drop (Task Detail Modal)
**Given** the task detail modal is open  
**When** the user drags one or more files from Finder or QSpace onto the modal  
**Then** the files appear in the Attachments section as linked entries (filename + icon)

### US-2: Attach via drag-drop (Kanban card)
**Given** a Kanban board is visible  
**When** the user drags a file from the OS onto a task card  
**Then** the file is silently attached to that task; a paperclip indicator appears on the card

### US-3: Attach via drag-drop (List row)
**Given** the List view is visible  
**When** the user drags a file from the OS onto a task row  
**Then** the file is silently attached to that task; the row shows a paperclip indicator

### US-4: Open file
**When** the user left-clicks an attachment  
**Then** the file opens in its default macOS application via `shell.openPath`

### US-5: Reveal in Finder
**When** the user right-clicks an attachment  
**Then** the file is revealed (highlighted) in Finder via `shell.showItemInFolder`

### US-6: Remove attachment
**When** the user clicks the remove (×) button on an attachment  
**Then** the attachment is removed from the task (file on disk is untouched)

### US-7: Broken link detection
**When** the task detail modal opens  
**Then** each attachment is checked for existence; missing files show a ⚠ icon and a muted/strikethrough style; clicking them does nothing

### US-8: Attachment cap
**When** a task already has 10 attachments and another drop is attempted  
**Then** a dismissable inline error is shown: "Maximum 10 attachments per task"

---

## 3. Data Model

### New type: `TaskAttachment`

```typescript
// src/shared/types.ts — add:
export interface TaskAttachment {
  id: string        // UUID
  task_id: string
  path: string      // Absolute file path (e.g. /Users/alice/Documents/report.pdf)
  name: string      // Display name — basename of path at time of attachment
  added_at: string  // ISO timestamp
}

export interface TaskAttachmentWithStatus extends TaskAttachment {
  exists: boolean   // Checked at query time via fs.existsSync
}
```

### Database schema addition

New `task_attachments` table, added via the existing `migrate()` ALTER TABLE pattern:

```sql
CREATE TABLE IF NOT EXISTS task_attachments (
  id       TEXT PRIMARY KEY,
  task_id  TEXT NOT NULL,
  path     TEXT NOT NULL,
  name     TEXT NOT NULL,
  added_at TEXT NOT NULL
);
```

The `Task` interface itself is **not changed** — attachments are fetched separately when needed (on modal open).

---

## 4. IPC Channels

New channels added to `src/main/ipc.ts` and exposed via `src/preload/index.ts`:

| Channel | Input | Returns | Notes |
|---|---|---|---|
| `attachments:list` | `task_id: string` | `TaskAttachmentWithStatus[]` | Checks `fs.existsSync` per entry |
| `attachments:add` | `{ task_id, path }` | `TaskAttachmentWithStatus \| { error: string }` | Errors if already 10; deduplicates by path |
| `attachments:remove` | `attachment_id: string` | `void` | No-op if not found |
| `attachments:open` | `path: string` | `void` | `shell.openPath` |
| `attachments:reveal` | `path: string` | `void` | `shell.showItemInFolder` |

---

## 5. UI Components

### 5a. `TaskDetailModal.tsx` — new Attachments section

- Positioned **below the Email Link row** in the metadata section
- Section label: `Attachments` (same style as Labels, Assigned, etc.)
- Each attachment renders as a pill/chip: `[file-icon] filename.ext [×]`
  - Left-click: `attachments:open`
  - Right-click: `attachments:reveal`
  - `×` removes the attachment
  - Missing file: muted text + ⚠ icon; click disabled
- When no attachments: show a subtle drop-hint label ("Drop files here")
- The **entire modal** is a drop zone when a file drag is in progress:
  - `onDragEnter` / `onDragOver` / `onDrop` on the modal's root `div`
  - Prevent default on `dragover` to enable drop
  - Visual feedback: dashed border highlight on the attachments section when hovering
  - Read `event.dataTransfer.files` on drop; filter to first 10 (minus existing count)

### 5b. `TaskCard.tsx` — drop zone + indicator

- Add `onDragOver` / `onDrop` native HTML5 handlers to the card root element
- Prevent @dnd-kit interference: check `event.dataTransfer.types.includes('Files')` before acting — file drops from OS always include `'Files'` in `dataTransfer.types`
- On drop: call `attachments:add` for each file; no modal is opened
- When the task has ≥1 attachment: show a paperclip icon (📎 or SVG) in the card's bottom-right corner with a count badge

### 5c. `ListView` / list row component — drop zone + indicator

- Same pattern as TaskCard: native `onDragOver` / `onDrop` on the row element
- On drop: silently attaches files
- Show paperclip icon + count in a column (or as a row badge)

### 5d. Attachment count in `Task` store

- After attaching/removing, broadcast a lightweight update so cards and rows can reflect the correct count without re-fetching all tasks
- Strategy: maintain a `Map<task_id, number>` attachment count in a small Zustand slice (`attachmentCountStore`), updated after each `attachments:add` / `attachments:remove` call

---

## 6. Project Structure — Files to Add or Modify

```
src/
  shared/
    types.ts                          MODIFY — add TaskAttachment, TaskAttachmentWithStatus
  main/
    db.ts                             MODIFY — add task_attachments table migration + CRUD fns
    ipc.ts                            MODIFY — register 5 new attachment: channels
  preload/
    index.ts                          MODIFY — expose attachments API on window.api
  renderer/src/
    stores/
      attachmentCountStore.ts         ADD    — Zustand slice for attachment counts per task
    components/
      Kanban/
        TaskDetailModal.tsx           MODIFY — add Attachments section + modal drop zone
        TaskCard.tsx                  MODIFY — add OS file drop handler + paperclip indicator
      ListView/
        [list row component]          MODIFY — add OS file drop handler + paperclip indicator
```

---

## 7. Code Style

- Follow the existing patterns in the codebase exactly:
  - Tailwind CSS utility classes for all styling; no new CSS files
  - Dark theme palette: `bg-[#242424]`, `border-[#383838]`, text `text-[#e0e0e0]` / `text-[#888]`
  - IPC handler shape: `ipcMain.handle('channel', async (_, arg) => { ... })`
  - DB functions: synchronous, take `db: Database`, call `save()` after writes
  - Zustand stores: flat, action-per-operation pattern matching `taskStore.ts`
  - No comments unless the WHY is non-obvious

---

## 8. Testing Strategy

Manual verification checklist (no automated tests currently exist in the project):

1. **Happy path** — drag 3 files onto the detail modal; they appear with correct names; left-click opens, right-click reveals
2. **Card drop** — drag a file onto a Kanban card; modal not opened; paperclip count appears
3. **List row drop** — drag a file onto a list row; same result
4. **Cap enforcement** — attach 10 files; drag another; error message shown
5. **Deduplication** — drag the same file twice; second attach is a no-op
6. **Broken link** — attach a file, move/delete it on disk, reopen modal; ⚠ icon shown, click does nothing
7. **Remove** — click × on an attachment; it disappears; file on disk unchanged
8. **Persistence** — close and reopen the app; attachments survive

---

## 9. Boundaries

### Always do
- Store absolute file paths only — never copy or move the file
- Use `event.dataTransfer.types.includes('Files')` to distinguish OS file drops from @dnd-kit internal drags
- Call `shell.openPath` / `shell.showItemInFolder` from the main process via IPC (not directly in renderer)
- Respect the 10-attachment cap server-side (in `ipc.ts`) as well as client-side

### Ask first about
- Any change to the `Task` interface (other than adding `attachments` field)
- Adding a visible attachment column to the List view header
- Any file operations beyond open/reveal (rename, copy, delete)

### Never do
- Copy, move, or modify files on disk
- Store relative paths — they break when the app moves or the user's home dir changes
- Auto-remove attachments when the file is missing (show ⚠ instead)
- Skip the 10-file cap
