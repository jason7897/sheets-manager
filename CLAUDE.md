# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Three independent static web projects — no build step, no package manager. Each file opens directly in a browser.

| File | Description |
|------|-------------|
| `index.html` + `style.css` + `script.js` | Sandwich recipe website ("Sandwich House") |
| `dashboard.html` | Google Sheets data dashboard (React 18 CDN + Recharts) |
| `sheets-manager.html` | Google Sheets file manager (Vanilla JS, Finder-style) |

**Local dev server**: `python -m http.server 8787` → `http://localhost:8787/`

---

## Project A — Sandwich House (`index.html`)

- **`index.html`** — Each recipe card has `data-id` and `data-category` attributes used by `script.js` for filtering. The toolbar (search + filter buttons + favorites toggle) lives inside `#recipes` above `#recipes-grid`.
- **`style.css`** — Organized: reset → header → hero → toolbar → cards → tips → about → footer → responsive. Primary color `#e07b39` (orange); favorites accent `#e05e6e` (pink).
- **`script.js`** — State: `currentFilter`, `currentSearch`, `showFavsOnly`. All state changes call `applyFilters()`, which toggles `.hidden` on cards. Favorites persisted to `localStorage` as `sandwich-favorites` (JSON array).

**Adding a recipe card**: Add `<div class="card" data-id="<id>" data-category="<category>">` to `#recipes-grid`. The `data-category` must match a filter button's `data-filter` value (`클래식`, `채식 가능`, `채식`, `프리미엄`, `건강식`).

**Adding a filter category**: Add `<button class="filter-btn" data-filter="<category>">` inside `.filter-wrap`. No JS changes needed — `script.js` binds all `.filter-btn:not(.fav-filter)` dynamically.

---

## Project B — Sales Dashboard (`dashboard.html`)

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

## Project C — Sheets File Manager (`sheets-manager.html`)

**Stack**: Vanilla JS + plain CSS. No frameworks, no CDN dependencies.

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
```

### Tree Pure Functions

```js
findNode(id, nodes)               // recursive find by id
mapTree(nodes, fn)                // deep map, returns new tree (never mutate directly)
deleteFromTree(id, nodes)         // removes node recursively
addToTree(parentId, newNode, nodes) // appends child under parentId, sets expanded:true
collectSheetIds(nodes)            // returns flat array of all sheetId values in subtree
```

### Layout

Two-column flex: `.sidebar` (232px sticky) + `.main` (flex:1). Sidebar contains `#tree-root`; main contains `.controls` and `#sheet-container`.

### Rendering Pattern

Both `renderTree()` and `renderSheets()` do full innerHTML replacement on every state change. After setting innerHTML, they immediately focus and wire up event listeners for any active input (rename/add). This means no stale listener risk.

Event listeners for inline inputs are set up imperatively after each render — not via delegation — because the inputs are ephemeral.

All other events use delegation:
- `#tree-root` click → handles `data-toggle-id`, `data-select-id`, `data-rename-id`, `data-delete-id`, `data-add-folder-id`, `data-add-sheet-id`
- `#sheet-container` click → handles `.fav-btn` (data-id) and `[data-card-rename-id]`

### Blur / Button-Click Conflict

Confirm and cancel buttons inside rename inputs use `onmousedown="event.preventDefault()"` (inline, since listeners are set post-render) to prevent the input's blur from firing before the button click. A `setTimeout(120)` guard in the blur handler also prevents double-commit:

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
- **Add sheet via tree** → also push to `sheetsData` with `nextId++`
- **Add sheet via modal** → pushes to `sheetsData` only (no tree node created)

### Add Sheet Modal

Regex for extracting sheet ID from URL:
```js
const SHEETS_ID_RE = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
```

URL input has 400ms debounce. Dropzone reads `text/uri-list` first (browser tab drag), falls back to `text/plain`. Google Drive button is a mock toast only.

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
4. Pass result to `renderSheets()`.
