// ══════════════════════════════════════════════════════════════
// 팀 스프레드시트 매니저 — Google Apps Script API
// 배포: 웹 앱으로 배포 → 실행 계정: 나, 액세스 권한: 모든 사용자
// ══════════════════════════════════════════════════════════════

const SHEET_NAME = 'AppData';
const DATA_CELL  = 'A1';

// 이 웹앱은 "모든 사용자 접근 허용"으로 배포되므로, 배포 URL만 알아도
// 인증 없이 팀 데이터를 읽거나 덮어쓸 수 있었다. 요청마다 이 토큰이
// 일치해야만 처리하도록 방어한다. (클라이언트 sheets-manager.html의
// GAS_TOKEN 상수와 반드시 동일한 값이어야 함)
const SM_TOKEN = '397514458024d1ccbfecfc80a53315731cd978b6299ad8ec';

// ── GET: 데이터 로드 ──────────────────────────────────────────
function doGet(e) {
  if ((e.parameter || {}).token !== SM_TOKEN) {
    return respond({ ok: false, error: 'unauthorized' });
  }
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
  if ((e.parameter || {}).token !== SM_TOKEN) {
    return respond({ ok: false, error: 'unauthorized' });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // application/x-www-form-urlencoded 방식 (CORS preflight 방지)
    const raw     = e.parameter.data || (e.postData && e.postData.contents);
    const payload = JSON.parse(raw);
    const sheet   = getOrCreateSheet();

    // 오래된 데이터로 덮어쓰기 방지: 들어온 데이터가 지금 저장된 것보다 과거 타임스탬프면 무시.
    // (클라이언트가 네트워크 오류 등으로 낡은 로컬 캐시를 잘못 업로드해도 서버가 방어)
    const existingRaw = sheet.getRange(DATA_CELL).getValue();
    if (existingRaw) {
      const existing    = JSON.parse(existingRaw);
      const incomingTs  = payload.contentUpdatedAt || payload.updatedAt || 0;
      const existingTs  = existing.contentUpdatedAt || existing.updatedAt || 0;
      if (incomingTs < existingTs) {
        return respond({ ok: false, error: 'stale write rejected', existingTs, incomingTs });
      }
    }

    sheet.getRange(DATA_CELL).setValue(JSON.stringify(payload));
    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
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
