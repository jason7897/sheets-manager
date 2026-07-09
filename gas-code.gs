// ================================================================
// 팀 스프레드시트 매니저 — Google Apps Script (Code.gs)
// ================================================================
// 이 코드를 Google Apps Script 편집기에 통째로 붙여 넣으세요.
// 스프레드시트에 연결된 상태에서 "웹 앱으로 배포" 해야 합니다.
// ================================================================

// ── 시트 이름 설정 ──────────────────────────────────────────────
var DATA_SHEET = '시트목록';   // 현재 상태 (항상 최신 반영)
var LOG_SHEET  = '변경이력';   // 저장할 때마다 누적 기록

// PropertiesService 키 (전체 앱 상태 JSON 저장용)
var PROP_KEY = 'sm_app_state';

// ================================================================
// doGet — HTML 앱이 서버에서 최신 상태를 로드할 때 호출됨
// ================================================================
function doGet(e) {
  try {
    var raw = _loadState();
    if (raw) {
      return jsonResponse({ ok: true, data: JSON.parse(raw) });
    }
    return jsonResponse({ ok: false, data: null });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ================================================================
// doPost — HTML 앱이 데이터를 서버에 저장할 때 호출됨
// ================================================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var rawData = e.parameter.data;
    if (!rawData) throw new Error('data 파라미터가 없습니다');

    var payload = JSON.parse(rawData);

    // 오래된 데이터로 덮어쓰기 방지: 들어온 데이터가 지금 저장된 것보다 과거 타임스탬프면 무시.
    // (클라이언트가 네트워크 오류 등으로 낡은 로컬 캐시를 잘못 업로드해도 서버가 방어)
    var existingRaw = _loadState();
    if (existingRaw) {
      var existing   = JSON.parse(existingRaw);
      var incomingTs = payload.contentUpdatedAt || payload.updatedAt || 0;
      var existingTs = existing.contentUpdatedAt || existing.updatedAt || 0;
      if (incomingTs < existingTs) {
        return jsonResponse({ ok: false, error: 'stale write rejected', existingTs: existingTs, incomingTs: incomingTs });
      }
    }

    // 1) PropertiesService에 전체 앱 상태 저장 (사용자 간 동기화 핵심)
    //    용량 제한(500 KB)을 초과하는 경우 스프레드시트 셀로 폴백
    _saveState(rawData);

    // 2) '시트목록' 시트를 항상 최신 상태로 갱신
    _updateDataSheet(payload);

    // 3) '변경이력' 시트에 저장 이벤트 누적 기록 (절대 덮어쓰지 않음)
    _appendChangeLog(payload);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ================================================================
// 내부 헬퍼 함수들
// ================================================================

/** JSON ContentService 응답 생성 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 전체 앱 상태를 PropertiesService에 저장.
 * 500 KB 초과 시 스프레드시트 숨김 시트의 A1 셀에 저장 (폴백).
 */
function _saveState(rawData) {
  try {
    if (rawData.length > 480000) {
      // PropertiesService 한도(500 KB)에 가까우면 시트 폴백
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var stateSheet = ss.getSheetByName('__state__') || ss.insertSheet('__state__');
      stateSheet.hideSheet();
      stateSheet.getRange('A1').setValue(rawData);
      PropertiesService.getScriptProperties().setProperty(PROP_KEY, '__sheet__');
    } else {
      PropertiesService.getScriptProperties().setProperty(PROP_KEY, rawData);
    }
  } catch (e) {
    // PropertiesService 실패 → 시트에 저장
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stateSheet = ss.getSheetByName('__state__') || ss.insertSheet('__state__');
    stateSheet.hideSheet();
    stateSheet.getRange('A1').setValue(rawData);
    PropertiesService.getScriptProperties().setProperty(PROP_KEY, '__sheet__');
  }
}

/**
 * doGet에서 상태를 읽을 때 PropertiesService 폴백 처리를 포함한 읽기.
 * (현재는 doGet에서 직접 getProperty를 사용하지만 폴백 시 이 함수가 필요)
 */
function _loadState() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY);
  if (!raw) return null;
  if (raw === '__sheet__') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stateSheet = ss.getSheetByName('__state__');
    if (!stateSheet) return null;
    return stateSheet.getRange('A1').getValue() || null;
  }
  return raw;
}

/**
 * '시트목록' 시트를 현재 sheetsData로 갱신.
 * 헤더는 유지하고, 2행부터 최신 목록으로 교체.
 */
function _updateDataSheet(payload) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(DATA_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(DATA_SHEET);
    var header = ['ID', '제목', '설명', '담당자', '최종수정일', '태그', '공개범위', '상태', '링크', '핀', '즐겨찾기'];
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length)
      .setFontWeight('bold')
      .setBackground('#3182f6')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(2, 200);
    sheet.setColumnWidth(3, 260);
    sheet.setColumnWidth(9, 220);
  }

  // 2행부터 기존 데이터 삭제
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 11).clearContent();
  }

  var items = payload.sheetsData || [];
  if (!items.length) return;

  var rows = items.map(function(item) {
    return [
      item.id        || '',
      item.title     || '',
      item.desc      || '',
      item.owner     || '',
      item.updated   || '',
      (item.tags || []).join(', '),
      item.access    || '',
      item.status    || '',
      item.link      || '',
      item.isPinned   ? '✓' : '',
      item.isFavorite ? '★' : '',
    ];
  });

  sheet.getRange(2, 1, rows.length, 11).setValues(rows);
  SpreadsheetApp.flush();
}

/**
 * '변경이력' 시트에 이번 저장 기록을 한 행씩 누적 추가.
 * 이 시트는 절대 삭제·덮어쓰기 하지 않음.
 */
function _appendChangeLog(payload) {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName(LOG_SHEET);

  if (!logSheet) {
    logSheet = ss.insertSheet(LOG_SHEET);
    var logHeader = ['저장시각', '시트 수', '시트 ID 목록', '앱 타임스탬프'];
    logSheet.appendRow(logHeader);
    logSheet.getRange(1, 1, 1, logHeader.length)
      .setFontWeight('bold')
      .setBackground('#6b7684')
      .setFontColor('#ffffff');
    logSheet.setFrozenRows(1);
    logSheet.setColumnWidth(1, 180);
    logSheet.setColumnWidth(3, 300);
  }

  var items   = payload.sheetsData || [];
  var sheetIds = items.map(function(i) { return i.id; }).join(', ');
  var savedAt  = payload.updatedAt
    ? new Date(payload.updatedAt).toLocaleString('ko-KR')
    : '';

  logSheet.appendRow([
    new Date(),          // 실제 서버 저장 시각
    items.length,        // 전체 시트 수
    sheetIds,            // 포함된 시트 ID 목록
    savedAt,             // 클라이언트 updatedAt
  ]);
}

// ================================================================
// 수동 초기화 함수 — 스크립트 편집기에서 직접 실행해서 시트 구조 생성 가능
// ================================================================
function setupSheets() {
  _updateDataSheet({ sheetsData: [] });
  _appendChangeLog({ sheetsData: [], updatedAt: Date.now() });
  SpreadsheetApp.getUi().alert('시트 구조 초기화 완료! 시트목록, 변경이력 시트가 생성되었습니다.');
}
