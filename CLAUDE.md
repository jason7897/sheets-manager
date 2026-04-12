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

**Design system**: Toss-style — primary `#3182f6`, bg `#f9fafb`, card radius `20px`, modal radius `24px`, backdrop-filter blur.

### Data Model

Two parallel data structures kept in sync:

```js
// Flat array — source of truth for card grid
const sheetsData = [{ id, title, desc, owner, updated, tags, isPinned, isFavorite, access, status, link }];

// Nested tree — source of truth for sidebar organization
let treeData = [{ id, type:'folder'|'sheet', name, expanded?, children?, sheetId? }];
```

Sheet tree nodes carry `sheetId` to link to `sheetsData`. Rename and delete operations on one must sync the other.

### State Variables

```js
// Tree
let treeEditingId = null;   // node ID currently being renamed
let addMode       = null;   // { parentId: string|'root', type: 'folder'|'sheet' }
let selectedId    = 'root'; // sidebar selection; 'root' = show all

// Cards
let cardEditingId = null;   // sheetsData.id currently being renamed in card
let currentFilter = 'all';  // 'all' | 'favorite' | 'mine'
let currentView   = 'grid'; // 'grid' | 'list'
let currentSort   = 'pinned'; // 'pinned' | 'newest' | 'oldest' | 'name'

// Drag & Drop
let _dragSheetId  = null;   // sheet id being dragged; null when idle
let _dragOverRow  = null;   // DOM element currently highlighted as drop target
```

### localStorage Persistence

```js
const STORAGE_KEY = 'sm-data-v1';
// Saves: sheetsData, treeData, nextId, currentFilter, currentView, currentSort
```

`saveStorage()` is called at the end of both `renderTree()` and `applyFilters()`. On load, `initStorage()` restores all six fields and applies UI state before first render.

### Tree Pure Functions

```js
findNode(id, nodes)               // recursive find by id
mapTree(nodes, fn)                // deep map, returns new tree (never mutate directly)
deleteFromTree(id, nodes)         // removes node recursively
addToTree(parentId, newNode, nodes) // appends child under parentId, sets expanded:true
collectSheetIds(nodes)            // returns flat array of all sheetId values in subtree
getFolderNameForSheet(sheetId)    // returns parent folder name for a sheet, or null
```

### Layout

Two-column flex: `.sidebar` (260px sticky) + `.main` (flex:1). Sidebar contains `#tree-root`; main contains breadcrumb `#breadcrumb`, title `#page-title`, `.controls`, and `#sheet-container`.

### Rendering Pattern

Both `renderTree()` and `renderSheets()` do full innerHTML replacement on every state change. After setting innerHTML, they immediately focus and wire up event listeners for any active input (rename/add). This means no stale listener risk.

Event listeners for inline inputs are set up imperatively after each render — not via delegation — because the inputs are ephemeral.

All other events use delegation:
- `#tree-root` click → `data-toggle-id`, `data-select-id`, `data-rename-id`, `data-delete-id`, `data-add-folder-id`, `data-add-sheet-id`
- `#tree-root` dragover/dragleave/drop → `[data-drop-folder-id]` on folder rows
- `#sheet-container` click → `.fav-btn`, `[data-card-rename-id]`, `[data-card-edit-id]`, `[data-card-trash-id]`, `[data-tag-filter]`
- `#sheet-container` dragstart/dragend → `.sheet-card[draggable]`

### Blur / Button-Click Conflict

Confirm and cancel buttons inside rename inputs use `onmousedown="event.preventDefault()"` to prevent the input's blur from firing before the button click. A `setTimeout(120)` guard in the blur handler also prevents double-commit:

```js
inp.addEventListener('blur', () => {
    setTimeout(() => { if (treeEditingId) commitTreeRename(); }, 120);
});
```

### Bidirectional Sync Rules

- **Tree node rename** (sheet type) → also update `sheetsData[].title`
- **Card rename** → also update matching tree node via `mapTree` where `n.sheetId === id`
- **Tree node delete** (sheet type) → splice from `sheetsData`
- **Tree folder delete** → `collectSheetIds` then splice all from `sheetsData`
- **Card trash button delete** → splice from `sheetsData` + `deleteFromTree` matching node
- **Add sheet via tree** → also push to `sheetsData` with `nextId++`
- **Add sheet via modal** → push to `sheetsData`; if a folder is currently selected (`selectedId !== 'root'`), also create tree node via `addToTree`
- **Drag sheet to folder** → `moveSheetToFolder(sheetId, folderId)`: removes existing tree node, adds new node under target, expands target folder

### Drag & Drop (Card → Sidebar Folder)

Cards have `draggable="true"`. `dragstart` stores `_dragSheetId` and sets `dataTransfer`. Folder `.tree-row` elements have `data-drop-folder-id`. On `dragover`, the matching row gets `.drag-over` class (blue dashed outline). On `drop`, `moveSheetToFolder` is called and the target folder auto-expands.

### Add Sheet Modal

Regex for extracting sheet ID from URL:
```js
const SHEETS_ID_RE = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
```

URL input has 400ms debounce. Dropzone reads `text/uri-list` first (browser tab drag), falls back to `text/plain`. Google Drive button is a mock toast only.

### Edit Sheet Modal

Fields: title, Google Sheets URL (link), desc, tags, access, status, isPinned. Saving updates `sheetsData` in place and syncs the tree node name via `mapTree`.

### Breadcrumb & Page Title

`updateBreadcrumb()` is called after `selectNode()`, `selectAllRoot()`, and on init. It updates `#breadcrumb` (shows `전체 > 폴더명` path) and `#page-title` (shows folder name or `내 스프레드시트`).

### Icon System

All icons are inline SVG strings stored in the `IC` constant object at the top of `<script>`. When adding new UI elements requiring icons, add to `IC` and reference as `IC.iconName` in template literals.

### ID Generation

```js
function uid(p='n') { return p + Date.now() + Math.random().toString(36).slice(2,5); }
```

Tree node IDs use prefixes: `f-` for folders, `t-` for sheet nodes. `sheetsData` IDs are sequential integers via `nextId`.

### Filtering Logic (`applyFilters`)

1. If `selectedId !== 'root'`: collect `sheetId`s from the selected subtree via `collectSheetIds`, build a `Set`, and filter `sheetsData` to only those IDs.
2. Apply text search (title, desc, owner, tags) with 300ms debounce.
3. Apply quick filter (`currentFilter`): all / favorite / mine (owner === '나(PM)').
4. Pass result to `renderSheets()`, then call `saveStorage()`.

### Deployment

```
my-sheet-manager/
  build.mjs       ← Node script: copies ../sheets-manager.html → dist/index.html
  vercel.json     ← { buildCommand: "node build.mjs", outputDirectory: "dist" }
vercel.json       ← { buildCommand: "node my-sheet-manager/build.mjs", outputDirectory: "my-sheet-manager/dist" }
```

Deploy command: `vercel --prod --yes` (or `git push` if GitHub auto-deploy is active).
