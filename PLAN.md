# Implementation Plan: File Attachments for Tasks

## Overview

Add file attachment support to Pepper Task Manager. Files are stored as absolute path links (never copied). Drop targets: TaskDetailModal, Kanban cards, List rows. Left-click opens, right-click reveals in Finder. Cap of 10 per task. Broken links show a warning icon.

## Architecture Decisions

- **Separate `task_attachments` table** — cleaner than a JSON column; consistent with how labels are stored
- **`attachments:counts` IPC channel** returns `Record<string, number>` for all tasks so cards/rows can show indicators without loading full attachment records
- **`useAttachmentStore` Zustand slice** holds `task_id → count` map; updated optimistically on add/remove, loaded on app init
- **Native HTML5 drag events** (not @dnd-kit) for OS file drops — `event.dataTransfer.types.includes('Files')` distinguishes them from internal drags; @dnd-kit is unaffected since it activates on `pointerdown`, not `drop`

---

## Phase 1: Foundation — types, database, IPC, preload

### Task 1: Add types and DB migration

**Description:** Add `TaskAttachment` and `TaskAttachmentWithStatus` to shared types. Add `task_attachments` table via the existing `migrate()` ALTER TABLE pattern. Add DB CRUD functions: `addAttachment`, `removeAttachment`, `listAttachments`, `countAttachments`.

**Acceptance criteria:**
- [ ] `TaskAttachment` and `TaskAttachmentWithStatus` are exported from `src/shared/types.ts`
- [ ] `task_attachments` table is created on app start (or already exists silently)
- [ ] `addAttachment` inserts a row and calls `save()`; returns the new record
- [ ] `removeAttachment` deletes by id and calls `save()`
- [ ] `listAttachments(task_id)` returns rows with `exists: boolean` from `fs.existsSync`
- [ ] `countAttachments()` returns `Record<string, number>` across all tasks

**Verification:**
- [ ] TypeScript compiles: `npm run build`
- [ ] No type errors on the new types

**Dependencies:** None

**Files touched:**
- `src/shared/types.ts`
- `src/main/db.ts`

**Estimated scope:** Small

---

### Task 2: IPC handlers and preload bridge

**Description:** Register 6 new IPC channels in `ipc.ts` and expose them on `window.api.attachments` in `preload/index.ts`. Includes `shell.openPath` and `shell.showItemInFolder` calls (must run in main process).

**Acceptance criteria:**
- [ ] `attachments:list`, `attachments:add`, `attachments:remove`, `attachments:open`, `attachments:reveal`, `attachments:counts` are all registered
- [ ] `attachments:add` enforces the 10-file cap and returns `{ error: string }` when exceeded
- [ ] `attachments:add` deduplicates by path (returns existing record if path already attached)
- [ ] `shell.openPath` / `shell.showItemInFolder` called from main process only
- [ ] `window.api.attachments.*` is callable from the renderer
- [ ] `AppApi` type is updated

**Verification:**
- [ ] TypeScript compiles: `npm run build`
- [ ] From DevTools console: `window.api.attachments.list('fake-id')` returns `[]` without error

**Dependencies:** Task 1

**Files touched:**
- `src/main/ipc.ts`
- `src/preload/index.ts`

**Estimated scope:** Small

---

### Checkpoint: Phase 1

- [ ] `npm run build` succeeds with no errors
- [ ] DevTools smoke test: `window.api.attachments` exists and list/add/remove work

---

## Phase 2: Task Detail Modal

### Task 3: Attachments section — load, display, open, reveal, remove

**Description:** Add an Attachments row to the metadata section of `TaskDetailModal`, below the Email row. On modal open, call `attachments:list` and display results as chips. Left-click opens, right-click reveals. `×` removes. Missing files show ⚠ in a muted style with no click action. Shows "Drop files here" hint when empty.

**Acceptance criteria:**
- [ ] `Attachments` label appears in the metadata section with correct styling (matches Labels/Assigned rows)
- [ ] Each attachment shows as a chip: file name + `×` remove button
- [ ] Left-click on chip calls `attachments:open`
- [ ] Right-click on chip calls `attachments:reveal`
- [ ] `×` calls `attachments:remove`, chip disappears immediately (optimistic)
- [ ] Missing file: chip has muted text + `⚠` prefix; no click/right-click action
- [ ] Empty state shows subtle "Drop files here" text

**Verification:**
- [ ] Attach a real file, reopen modal — it appears
- [ ] Left-click opens the file
- [ ] Right-click context menu → item appears highlighted in Finder
- [ ] Delete a file on disk, reopen modal — ⚠ shown

**Dependencies:** Task 2

**Files touched:**
- `src/renderer/src/components/Kanban/TaskDetailModal.tsx`

**Estimated scope:** Medium

---

### Task 4: File drop zone on TaskDetailModal

**Description:** Make the modal's root `div` a drop zone for OS files. `onDragEnter`/`onDragOver`/`onDrop` handlers detect `dataTransfer.types.includes('Files')`, highlight the attachments section with a dashed border, and call `attachments:add` for each dropped file (up to cap). Shows inline error if over cap.

**Acceptance criteria:**
- [ ] Dragging a file over the open modal shows a dashed highlight on the Attachments section
- [ ] Dropping 1–3 files attaches them and they appear immediately as chips
- [ ] Dropping files that would exceed cap of 10 shows error: "Maximum 10 attachments per task"
- [ ] Error auto-dismisses after 3 seconds
- [ ] Duplicate file (same path) is silently ignored (not counted toward cap)
- [ ] @dnd-kit internal drags are unaffected (no highlight when dragging a task card)

**Verification:**
- [ ] Drop 3 files → 3 chips appear
- [ ] With 9 existing → drop 3 → error shown, 1 attaches, 2 rejected
- [ ] Drag a task card within Kanban → no drop highlight on modal

**Dependencies:** Task 3

**Files touched:**
- `src/renderer/src/components/Kanban/TaskDetailModal.tsx`

**Estimated scope:** Small

---

### Checkpoint: Phase 2

- [ ] Full modal attachment flow works end-to-end
- [ ] Open/reveal/remove all function correctly
- [ ] Drop zone works without interfering with existing modal interactions

---

## Phase 3: Card and Row Drop Targets + Indicators

### Task 5: Attachment count store

**Description:** Create `useAttachmentStore` Zustand slice to hold `task_id → count` map. Loaded once on init (via `attachments:counts`). Provides `incrementCount`, `decrementCount` for optimistic updates from card/row drop handlers.

**Acceptance criteria:**
- [ ] `useAttachmentStore` exports `counts: Record<string, number>`, `loadCounts()`, `incrementCount(id)`, `decrementCount(id)`
- [ ] `loadCounts()` is called from the app init path (alongside `loadTasks` / `loadLabels`)
- [ ] `incrementCount` / `decrementCount` update counts optimistically without re-fetching

**Verification:**
- [ ] After attaching a file via the modal, the count for that task increments in the store

**Dependencies:** Task 2

**Files touched:**
- `src/renderer/src/stores/attachmentCountStore.ts` (new)
- `src/renderer/src/components/Kanban/KanbanBoard.tsx` (init call)

**Estimated scope:** Small

---

### Task 6: File drop on TaskCard + paperclip indicator

**Description:** Add native HTML5 `onDragOver` / `onDrop` handlers to the `TaskCard` root div, checking `dataTransfer.types.includes('Files')`. On drop: call `attachments:add` for each file, call `incrementCount`. Show a dashed highlight on dragover. When `count > 0`, render a paperclip icon + count badge in the card's bottom-right (above the delete button area).

**Acceptance criteria:**
- [ ] Dragging a file over a card shows a dashed highlight (card border changes)
- [ ] Dropping attaches the file silently (no modal opened)
- [ ] Paperclip icon + count appears on the card after attachment
- [ ] `onPointerDown` propagation is unaffected — @dnd-kit still works for task reordering
- [ ] OS file drop does not trigger @dnd-kit drag

**Verification:**
- [ ] Drop 1 file on a card → paperclip "1" appears, open modal confirms attachment
- [ ] Drag card to different column — still works normally

**Dependencies:** Task 5

**Files touched:**
- `src/renderer/src/components/Kanban/TaskCard.tsx`

**Estimated scope:** Small

---

### Task 7: File drop on ListRow + paperclip indicator

**Description:** Same pattern as Task 6 but for `ListRow`. Add `onDragOver` / `onDrop`, highlight on hover, attach silently on drop, show paperclip count inline.

**Acceptance criteria:**
- [ ] Dragging a file over a list row shows a dashed highlight
- [ ] Dropping attaches the file; paperclip count appears inline (after the label chips)
- [ ] @dnd-kit `useDraggable` on the row is unaffected

**Verification:**
- [ ] Drop file on list row → count appears, open modal confirms attachment
- [ ] Drag list row to label — still works

**Dependencies:** Task 5

**Files touched:**
- `src/renderer/src/components/ListView/ListRow.tsx`

**Estimated scope:** Small

---

### Checkpoint: Phase 3 — Full Feature

- [ ] All 8 acceptance criteria from SPEC.md pass (see manual checklist)
- [ ] Cap enforcement works on all 3 drop targets
- [ ] Persistence: close app, reopen — attachments survive
- [ ] No regressions in task drag-drop (kanban reorder, label sidebar drop)
- [ ] No regressions in task detail modal (save, AI draft, label picker, date picker)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| @dnd-kit `PointerSensor` fires on file dragover | Medium | Check `dataTransfer.types.includes('Files')` before any action; file drops don't fire `pointerdown` so @dnd-kit won't activate |
| `onDrop` fires on modal but @dnd-kit swallows event | Low | @dnd-kit listens to pointer events, not `drop`; they don't interfere |
| `shell.openPath` requires absolute path | Low | We store absolute path at attach time; validated in `attachments:add` |
| `fs.existsSync` slow on network paths | Low | Only called on `attachments:list` (modal open), not on every render |

## Open Questions

None — all decisions captured in SPEC.md and this plan.
