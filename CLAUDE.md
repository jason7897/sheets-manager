# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Two independent static web projects — no build step, no package manager.

| File | Description |
|------|-------------|
| `dashboard.html` | Google Sheets data dashboard (React 18 CDN + Recharts) |
| `sheets-manager.html` | Google Sheets file manager (Vanilla JS, Toss-style UI) |

**Local dev server**: `python -m http.server 8787` → `http://localhost:8787/`

**Production**: `https://spread-sheet-manager.vercel.app/` (GitHub 연동 자동배포)
- `git push` → Vercel이 `my-sheet-manager/build.mjs` 실행 → `sheets-manager.html`을 `dist/index.html`로 복사 → 배포
- 자동배포가 느리거나 안 될 때: `vercel --prod --yes`

---

## Project A — Sales Dashboard (`dashboard.html`)

**Stack**: React 18 UMD + Babel Standalone + Tailwind Play CDN + Recharts UMD + prop-types

**CDN script order** (must be exact — prop-types before Recharts or Recharts throws):
```
React → ReactDOM → prop-types → Recharts → Babel → Tailwind
```

Single React `App` component with `data` state (30-row Korean mock dataset), `idCounterRef` (`S-001`, `S-002`, ...), shared `modal` state `{ open, mode, row }`, `delDlg`, and `toast` (auto-dismiss 2.5s).

**Google Sheets API swap points**:
```js
handleAddData(formData)    // POST → append row
handleEditData(formData)   // PUT  → update row by id
handleDeleteData()         // DELETE → remove row by id
```

---

## Project B — Sheets File Manager (`sheets-manager.html`)

**Stack**: Vanilla JS + Tailwind Play CDN + Pretendard font CDN. No frameworks.  
**Size**: ~3970 lines (single file). All logic, styles, and HTML in one file.

**Design system**: Toss-style — primary `#3182f6`, bg `#f9fafb`, card radius `20px`, modal radius `24px`, backdrop-filter blur. Dark mode via `[data-theme="dark"]` attribute on `<html>`.

---

### Data Model

Two parallel data structures kept in sync:

```js
// Flat array — source of truth for card grid
const sheetsData = [{
  id, title, desc, owner, updated, tags,
  isPinned, isFavorite, access, status, link,
  dueDate   // 'YYYY-MM-DD' or null — due date for deadline badge
}];

// Nested tree — source of truth for sidebar organization
let treeData = [{ id, type:'folder'|'sheet', name, expanded?, children?, sheetId?, color? }];
// color: 'yellow'|'blue'|'green'|'red'|'purple' (folder accent color)
```

Sheet tree nodes carry `sheetId` to link to `sheetsData`. Rename and delete operations on one must sync the other.

**Separate localStorage stores** (not inside STORAGE_KEY):
```js
const COMMENTS_KEY  = 'sm-comments-v1';  // { [sheetId]: [{id, author, text, ts}] }
const SEARCHES_KEY  = 'sm-searches-v1';  // [{id, name, query}]
const AUTOMATION_KEY = 'sm-rules-v1';    // automationRules[]
```

---

### State Variables

```js
// Tree
let treeEditingId = null;   // node ID currently being renamed
let addMode       = null;   // { parentId: string|'root', type: 'folder'|'sheet' }
let selectedId    = 'root'; // sidebar selection; 'root' = show all

// Cards
let cardEditingId = null;   // sheetsData.id currently being renamed in card
let currentFilter = 'all';  // 'all' | 'favorite' | 'mine' | 'archived'
let currentView   = 'grid'; // 'grid' | 'list' | 'group'
let currentSort   = 'pinned'; // 'pinned' | 'newest' | 'oldest' | 'name'

// Drag & Drop
let _dragSheetId  = null;   // sheet id being dragged; null when idle
let _dragOverRow  = null;   // DOM element currently highlighted as drop target

// Multi-select / Bulk actions
const selectedCards = new Set(); // Set of sheetsData.id (number)

// Advanced features
let comments        = {};   // { [sheetId]: [{id, author, text, ts}] }
let savedSearches   = [];   // [{id, name, query}]
let automationRules = [];   // [{id, name, desc, enabled, condition, action, lastRun}]
let _activeSavedSearch = null;
let _commentSheetId = null; // sheetId currently open in comment panel
let _selectedTemplate = null;
const _collapsedGroups = new Set(); // group view: collapsed folder group ids

// Context menu
let _ctxTarget = null; // { type:'card'|'tree', id } for right-click target
```

---

### localStorage Persistence

```js
const STORAGE_KEY = 'sm-data-v1';
// Saves: sheetsData, treeData, nextId, currentFilter, currentView, currentSort
```

`saveStorage()` is called at the end of both `renderTree()` and `applyFilters()`. The override wraps it to also call `broadcastChange()` for multi-tab sync.

On load, `initStorage()` restores all fields and applies UI state before first render. Comments, saved searches, and automation rules are loaded from their own keys.

---

### Tree Pure Functions

```js
findNode(id, nodes)                       // recursive find by id
mapTree(nodes, fn)                        // deep map, returns new tree (never mutate directly)
deleteFromTree(id, nodes)                 // removes node recursively
addToTree(parentId, newNode, nodes)       // appends child under parentId, sets expanded:true
collectSheetIds(nodes)                    // returns flat array of all sheetId values in subtree
getFolderNameForSheet(sheetId)            // returns parent folder name for a sheet, or null
getFolderColorHex(sheetId)               // returns hex color string for sheet's parent folder
```

---

### Layout

Two-column flex: `.sidebar` (260px sticky) + `.main` (flex:1).

**Sidebar** contains:
- Collapse/expand all buttons
- `#tree-root` (folder/sheet tree)
- `#saved-search-section` (saved searches list)

**Main** contains:
- `#breadcrumb`, `#page-title`
- `.controls` (search bar with `#searchInput`, view buttons, filter tabs, sort select)
- `#search-syntax-hint` (shown on search focus)
- `#sheet-container` (card grid / list table / group view)
- `#recent-section` (recently viewed, hidden when folder selected)
- `#stats-bar` (status distribution stats)

**Header** icon buttons (right side): 그룹뷰, 대시보드, 자동화규칙, 템플릿, 로그.

---

### Rendering Pattern

`renderTree()` and `renderSheets()` do full innerHTML replacement on every state change.

**Three view modes** — all routing through `applyFilters()` override:
- `grid` → `renderSheets(data)` → grid of cards via `renderCardHtml()`
- `list` → `renderSheets(data)` → `<table class="list-table">`
- `group` → `renderGroupView(data)` → grouped by folder, cards via `renderCardHtml()`

**`renderCardHtml(sheet, _q='')`** — pure function returning card HTML string. Used by both grid view and group view to ensure consistent rendering.

**`wireCardEvents()`** — called after grid/group innerHTML is set to attach context menu and drag listeners.

Event delegation:
- `#tree-root` click → `data-toggle-id`, `data-select-id`, `data-rename-id`, `data-delete-id`, `data-add-folder-id`, `data-add-sheet-id`
- `#tree-root` dragover/dragleave/drop → `[data-drop-folder-id]` on folder rows
- `#sheet-container` click → `.fav-btn`, `[data-card-rename-id]`, `[data-card-edit-id]`, `[data-card-trash-id]`, `[data-tag-filter]`, `[data-card-select-id]`
- `#sheet-container` dragstart/dragend → `.sheet-card[draggable]`
- `document` contextmenu → right-click on `.sheet-card` or `.tree-row`

---

### Function Override Pattern

New features extend existing functions using a capture-and-replace pattern. **Do not duplicate** — always check if an override already exists before adding another.

```js
const _origFoo = foo;
function foo(...args) {
    _origFoo(...args);
    // additional behavior
}
```

Current overrides (all in the "Advanced Features" block near end of `<script>`):
- `saveStorage` → also calls `broadcastChange()`
- `openEditModal` → also populates `#edit-due-date` and `#edit-owner` fields
- `saveEditModal` → also saves `dueDate` and `owner` back to `sheetsData`
- `applyFilters` → full reimplementation; routes to `renderGroupView` or `renderSheets`; supports advanced query syntax
- `setView` → adds 'group' support + calls `applyFilters()` after switching

---

### Blur / Button-Click Conflict

Confirm and cancel buttons inside rename inputs use `onmousedown="event.preventDefault()"` to prevent the input's blur from firing before the button click. A `setTimeout(120)` guard in the blur handler also prevents double-commit:

```js
inp.addEventListener('blur', () => {
    setTimeout(() => { if (treeEditingId) commitTreeRename(); }, 120);
});
```

---

### Bidirectional Sync Rules

- **Tree node rename** (sheet type) → also update `sheetsData[].title`
- **Card rename** → also update matching tree node via `mapTree` where `n.sheetId === id`
- **Tree node delete** (sheet type) → splice from `sheetsData`
- **Tree folder delete** → `collectSheetIds` then splice all from `sheetsData`
- **Card trash button delete** → splice from `sheetsData` + `deleteFromTree` matching node
- **Add sheet via tree** → also push to `sheetsData` with `nextId++`
- **Add sheet via modal** → push to `sheetsData`; if folder selected (`selectedId !== 'root'`), also create tree node via `addToTree`
- **Drag sheet to folder** → `moveSheetToFolder(sheetId, folderId, {silent?, noRender?})`: removes existing tree node, adds new node under target. Bulk version uses `silent:true, noRender:true` per item, then one consolidated toast + render.

---

### Drag & Drop (Card → Sidebar Folder)

Cards have `draggable="true"`. `dragstart` stores `_dragSheetId`. Folder `.tree-row` elements have `data-drop-folder-id`. On `dragover`, the row gets `.drag-over` class. On `drop`, `moveSheetToFolder` is called and the target folder auto-expands.

---

### Add Sheet Modal

```js
const SHEETS_ID_RE = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
```

URL input has 400ms debounce. Dropzone reads `text/uri-list` first (browser tab drag), falls back to `text/plain`.

**Right-click on "시트 추가" button** → context menu with two options:
- `URL로 시트 추가` → `openModal()`
- `템플릿으로 추가` → `openTemplateModal()`

---

### Edit Sheet Modal

Fields: title, Google Sheets URL (link), desc, tags, access, status, isPinned, **dueDate** (`#edit-due-date`), **owner** (`#edit-owner`).

`dueDate` and `owner` are populated/saved by the `openEditModal`/`saveEditModal` overrides.

---

### Advanced Search (`parseAdvancedQuery` / `matchesAdvancedQuery`)

Search bar supports field operators:
```
status:active   tag:마케팅   owner:홍길동   due:overdue   due:soon   pinned:true
```

`parseAdvancedQuery(raw)` tokenizes the query into `{status, tag, owner, due, pinned, text}`.  
If any operator is present, `matchesAdvancedQuery` is used instead of simple text search.  
Search syntax hint shown in `#search-syntax-hint` on input focus.

---

### Due Date Badge System

`getDueBadgeHtml(dueDate)` returns a colored badge string:
- Overdue → red `⚠️ D+N 초과`
- Today → red `🔴 오늘 마감`
- ≤3 days → yellow `🟡 D-N`
- Further → green `🟢 D-N`

Shown in both card view and list view.

---

### Group View

`renderGroupView(data)` groups sheets by parent folder using tree traversal. Each group is a collapsible section (`toggleGroupSection(gid)`). Uncategorized sheets appear last under `__uncat__`. Collapsed state stored in `_collapsedGroups` Set (in-memory only, not persisted).

---

### Saved Searches

`savedSearches[]` array, persisted to `SEARCHES_KEY`. Ctrl+Shift+S saves current query. Shown in `#saved-search-section` in sidebar. Click to apply; `_activeSavedSearch` tracks which is active (highlighted).

---

### Dashboard Panel

`openDashboard()` / `renderDashboard()` — full-screen overlay (`#dashboard-modal`) showing:
- KPI cards: total sheets, pinned, favorites, overdue, due soon, archived
- Status distribution bars
- Folder sheet counts (top 5)
- Recent 5 sheets
- Tag cloud (top 10 tags)

---

### Comment System

Per-sheet comments stored in `comments[sheetId][]`, persisted to `COMMENTS_KEY`.  
`openComments(sheetId)` opens slide-in panel `#comment-panel` with overlay `#comment-overlay`.  
Accessible from card context menu → 댓글.

---

### Template System

8 predefined templates in `TEMPLATES[]` (budget, meeting, tracker, report, db, plan, kpi, blank).  
`openTemplateModal()` opens `#template-modal`. Selecting a template sets `_selectedTemplate`; `applyTemplate()` opens `openModal()` with pre-filled fields.  
Accessible from: header template button, or right-click "시트 추가" button.

---

### Automation Rules

`automationRules[]` with condition/action model, persisted to `AUTOMATION_KEY`.  
Built-in rules: stale→archive (90d), done→unpin, overdue→review.  
`runAllAutomationRules(silent?)` runs all enabled rules. `openAutomationModal()` opens `#automation-modal`.  
Runs automatically on page load.

---

### Import / Export

**Export**: JSON backup (all data), CSV activity log.

**Import** — single handler `_handleImportFile(e)` on `#import-file-input`:
- `.json` → full restore (sheetsData + treeData)
- `.csv` → `importCSV(csvText)` → `parseCSVLine()` parses quoted CSV; maps columns title/desc/owner/tags/status/link/dueDate

File input `accept=".json,.csv"`.

---

### Context Menu

`showCtxMenu(x, y, items)` / `hideCtxMenu()` — fixed-position `#ctx-menu` div.  
`_ctxTarget = { type, id }` set before showing menu.

**Card right-click**: 열기, 편집, 이름바꾸기, 복사, 댓글, 링크복사, 폴더이동, 삭제  
**Tree node right-click**: 이름바꾸기, 삭제 (+ 새 시트/폴더 for folder nodes)

---

### Multi-tab Sync (BroadcastChannel)

```js
const _bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sm-sync') : null;
```

`broadcastChange()` posts `{type:'update', ts}` after every `saveStorage()`. Other tabs receive and call `initStorage()` + re-render if data actually changed.

---

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+K | 검색 포커스 |
| Ctrl+N | 시트 추가 모달 |
| Ctrl+Z | 실행 취소 |
| Ctrl+Shift+S | 현재 검색어 저장 |
| ↑↓ (sidebar focus) | 트리 노드 탐색 |
| →← (sidebar focus) | 폴더 펼침/닫힘 |
| Enter (sidebar focus) | 노드 선택 |

---

### Breadcrumb & Page Title

`updateBreadcrumb()` is called after `selectNode()`, `selectAllRoot()`, and on init. Updates `#breadcrumb` (`전체 > 폴더명`) and `#page-title`.

---

### Icon System

All icons are inline SVG strings stored in the `IC` constant object at the top of `<script>`. When adding new UI elements requiring icons, add to `IC` and reference as `IC.iconName` in template literals.

---

### ID Generation

```js
function uid(p='n') { return p + Date.now() + Math.random().toString(36).slice(2,5); }
```

Tree node IDs: `f-` prefix for folders, `t-` for sheet nodes. `sheetsData` IDs are sequential integers via `nextId`.

---

### Filtering Logic (`applyFilters` override)

1. If `selectedId !== 'root'`: collect `sheetId`s from selected subtree via `collectSheetIds`, filter to those IDs.
2. Parse raw query with `parseAdvancedQuery()`. If advanced operators present, use `matchesAdvancedQuery()`. Otherwise: text search (title, desc, owner, tags, folderName) + quickFilter (`currentFilter`).
3. Update `#result-count`.
4. Route to `renderGroupView(filtered)` if `currentView === 'group'`, else `renderSheets(filtered)`.
5. `updateStatsBar()`, `updateSelectAllBtn()`, `saveStorage()`.

---

### Deployment

```
my-sheet-manager/
  build.mjs       ← Node script: copies ../sheets-manager.html → dist/index.html
  vercel.json     ← { buildCommand: "node build.mjs", outputDirectory: "dist" }
vercel.json       ← { buildCommand: "node my-sheet-manager/build.mjs", outputDirectory: "my-sheet-manager/dist" }
```

Deploy command: `vercel --prod --yes` (or `git push` if GitHub auto-deploy is active).
