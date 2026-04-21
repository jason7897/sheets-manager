// ══════════════════════════════════════════════════════════════
// 팀 스프레드시트 매니저 — Google Apps Script API
// 배포: 웹 앱으로 배포 → 실행 계정: 나, 액세스 권한: 모든 사용자
// ══════════════════════════════════════════════════════════════

const SHEET_NAME = 'AppData';
const DATA_CELL  = 'A1';

// ── GET: 데이터 로드 ──────────────────────────────────────────
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const raw   = sheet.getRange(DATA_CELL).getValue();
    const data  = raw ? JSON.parse(raw) : null;
    return respond({ ok: true, data });
  } catch (err) {
    return respond({ ok: false, error: err.message });
  }
}

// ── POST: 데이터 저장 ─────────────────────────────────────────
function doPost(e) {
  try {
    // application/x-www-form-urlencoded 방식 (CORS preflight 방지)
    const raw     = e.parameter.data || (e.postData && e.postData.contents);
    const payload = JSON.parse(raw);
    getOrCreateSheet().getRange(DATA_CELL).setValue(JSON.stringify(payload));
    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: err.message });
  }
}

// ── 공통 유틸 ─────────────────────────────────────────────────
function getOrCreateSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
