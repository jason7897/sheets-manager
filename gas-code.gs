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

// 이 프로젝트(SM_Host)는 원본 데이터 로드/저장(GAS_URL 역할)과
// backup-gas.gs가 patch한 스냅샷 백업(BACKUP_GAS_URL 역할)을 함께 담당한다.
// "모든 사용자 접근 허용"으로 배포되므로 URL 유출 시 누구나 팀 데이터를
// 읽거나 덮어쓸 수 있었다. 요청마다 이 토큰이 일치해야만 처리한다.
// (클라이언트 sheets-manager.html의 GAS_TOKEN 상수와 반드시 동일해야 함 —
//  gas/Code.gs의 SM_TOKEN과도 같은 값을 쓰면 클라이언트는 토큰 하나만 관리하면 된다)
var SM_TOKEN = '397514458024d1ccbfecfc80a53315731cd978b6299ad8ec';

// 백업 스냅샷 저장용 (기존 backup-gas.gs와 동일한 스프레드시트 — 이 프로젝트 자신에 병합됨)
var BACKUP_SHEET    = 'SM백업로그';
var MAX_BACKUP_ROWS = 300; // 기존 50 → 300 (10회 저장마다 1건이므로 약 3000회 저장분 복원 가능)
var BACKUP_CELL_LIMIT = 45000; // Sheets 셀 문자 제한(50,000)에 여유를 둔 안전선

// ================================================================
// doGet — HTML 앱이 서버에서 최신 상태를 로드할 때 호출됨 (+ 백업 목록/조회)
// ================================================================
function doGet(e) {
  var params = e.parameter || {};
  if (params.token !== SM_TOKEN) {
    return jsonResponse({ ok: false, error: 'unauthorized' });
  }
  if (params.action === 'smBackupList') return _smBackupList();
  if (params.action === 'smBackupGet')  return _smBackupGet(parseInt(params.idx || '0', 10));
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
// doPost — HTML 앱이 데이터를 서버에 저장할 때 호출됨 (+ 백업 스냅샷 적재)
// ================================================================
function doPost(e) {
  if ((e.parameter || {}).token !== SM_TOKEN) {
    return jsonResponse({ ok: false, error: 'unauthorized' });
  }
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

      // 대폭 감소 방어: 여러 기기/탭이 각자 다른 캐시로 "내가 더 최신"이라고 우기며
      // 저장을 시도할 때, 시간만 보고 그대로 받아들이면 오래되고 텅 빈 캐시가
      // 진짜 데이터를 지워버릴 수 있다(2026-07-23 실제 사고). 기존보다 시트 수가
      // 크게 줄어드는 저장은 일단 거부하고, force=1이 명시된 경우에만 통과시킨다.
      var existingCount = (existing.sheetsData || []).length;
      var incomingCount = (payload.sheetsData || []).length;
      var isForced = (e.parameter || {}).force === '1';
      if (!isForced && existingCount >= 10 && incomingCount < existingCount * 0.7 && (existingCount - incomingCount) > 10) {
        return jsonResponse({ ok: false, error: 'big-drop-rejected', existingCount: existingCount, incomingCount: incomingCount });
      }
    }

    // 1) PropertiesService에 전체 앱 상태 저장 (사용자 간 동기화 핵심)
    //    용량 제한(500 KB)을 초과하는 경우 스프레드시트 셀로 폴백
    _saveState(rawData);

    // 2) '시트목록' 시트를 항상 최신 상태로 갱신
    _updateDataSheet(payload);

    // 3) '변경이력' 시트에 저장 이벤트 누적 기록 (절대 덮어쓰지 않음)
    _appendChangeLog(payload);

    // 4) 스냅샷 백업 로그에 적재 (클라이언트가 10회 저장마다 별도로 호출)
    _smBackup(payload);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ================================================================
// 스냅샷 백업 (기존 backup-gas.gs 병합) — 복원 가능한 히스토리
// ================================================================
function _smBackup(data) {
  try {
    if (!data || !Array.isArray(data.sheetsData)) return;

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(BACKUP_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(BACKUP_SHEET);
      sheet.appendRow(['저장시각', '시트수', 'URL수', '폴더수', '데이터(JSON)', 'Drive파일ID(초과분)']);
      sheet.setFrozenRows(1);
      sheet.getRange('1:1').setFontWeight('bold');
      sheet.setColumnWidths(1, 4, 110);
    }

    var sheetCount  = data.sheetsData.length;
    var urlCount    = data.sheetsData.filter(function(s){ return s.link && s.link !== ''; }).length;
    var folderCount = _smCountFolders(data.treeData || []);
    var json        = JSON.stringify(data);

    // Sheets 셀 문자 제한(50,000자) 안전선을 넘으면 Drive 파일로 대신 저장하고
    // 셀에는 참조용 안내만 남겨 백업 자체가 조용히 실패하는 것을 방지한다.
    var cellValue  = json;
    var driveFileId = '';
    if (json.length > BACKUP_CELL_LIMIT) {
      var file = DriveApp.createFile('sm-backup-' + new Date().toISOString() + '.json', json, MimeType.PLAIN_TEXT);
      driveFileId = file.getId();
      cellValue = '(Drive 파일로 저장됨 — 셀 크기 초과)';
    }

    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, 6).setValues([[
      new Date(),
      sheetCount,
      urlCount,
      folderCount,
      cellValue,
      driveFileId
    ]]);

    // MAX_BACKUP_ROWS 초과 시 오래된 행 삭제 (Drive 파일도 함께 정리)
    var lastRow = sheet.getLastRow();
    if (lastRow > MAX_BACKUP_ROWS + 1) {
      var staleRange = sheet.getRange(MAX_BACKUP_ROWS + 2, 6, lastRow - MAX_BACKUP_ROWS - 1, 1).getValues();
      staleRange.forEach(function(row) {
        var fid = row[0];
        if (fid) { try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) {} }
      });
      sheet.deleteRows(MAX_BACKUP_ROWS + 2, lastRow - MAX_BACKUP_ROWS - 1);
    }
  } catch (e) {
    console.error('SM Backup 실패:', e);
  }
}

function _smCountFolders(nodes) {
  var count = 0;
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].type === 'folder') count++;
    if (nodes[i].children) count += _smCountFolders(nodes[i].children);
  }
  return count;
}

function _smBackupList() {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(BACKUP_SHEET);
    var items = [];
    if (sheet && sheet.getLastRow() > 1) {
      var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
      for (var i = 0; i < rows.length; i++) {
        items.push({
          idx:         i,
          savedAt:     rows[i][0] instanceof Date ? rows[i][0].toISOString() : String(rows[i][0]),
          sheetCount:  rows[i][1],
          urlCount:    rows[i][2],
          folderCount: rows[i][3]
        });
      }
    }
    return jsonResponse({ ok: true, items: items });
  } catch (e) {
    return jsonResponse({ ok: false, error: e.message });
  }
}

function _smBackupGet(idx) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(BACKUP_SHEET);
    var row   = idx + 2;
    if (!sheet || row > sheet.getLastRow()) throw new Error('범위 초과');
    var vals    = sheet.getRange(row, 5, 1, 2).getValues()[0];
    var jsonStr = vals[0];
    var fileId  = vals[1];
    if (fileId) {
      jsonStr = DriveApp.getFileById(fileId).getBlob().getDataAsString();
    }
    return ContentService.createTextOutput(jsonStr).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return jsonResponse({ ok: false, error: e.message });
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
