// ============================================================
// SM 백업 코드 — 기존 GAS(SM_Host)에 추가
// ============================================================
//
// [딱 2단계만 하세요]
//
// STEP 1. 아래 URL로 기존 GAS 스크립트를 엽니다:
//   https://script.google.com/d/1cWH5b3fEBXXEbno2YQy8a9d372EER9ZZoCrleVO3BpHj6qpIx6Lrw_sQ/edit
//
// STEP 2. 기존 코드에서 두 곳을 수정합니다:
//
//   (A) 기존 doPost 함수 맨 끝 return 바로 앞에 추가:
//       _smBackup(parsedData);   ← parsedData는 실제 변수명으로 변경
//
//   (B) 기존 doGet 함수에 분기 추가 (doGet이 없으면 아래 doGet 함수 통째로 추가):
//       if (e.parameter.action === 'smBackupList') return _smBackupList();
//       if (e.parameter.action === 'smBackupGet')  return _smBackupGet(+e.parameter.idx);
//
// STEP 3. 저장(Ctrl+S) → 배포 → 배포 관리 → 편집 → 새 버전 → 배포
//
// 백업 데이터는 Google Drive의 "SM 시트매니저 백업" 스프레드시트에 자동 누적됩니다.
// ============================================================

// 백업용 스프레드시트 (이미 생성됨 — 수정 불필요)
var BACKUP_SS_ID    = '1MHNGZCB-6q1x23nA9LTqD443SWbceWTDMRIgm5NvJM8';
var BACKUP_SHEET    = 'SM백업로그';
var MAX_BACKUP_ROWS = 50;

// 기존 doPost 함수 맨 끝에 아래 한 줄 추가하세요:
//   _smBackup(parsedData);
// (parsedData는 기존 코드에서 파싱한 JSON 객체 변수명으로 바꾸세요)

function _smBackup(data) {
  try {
    if (!data || !Array.isArray(data.sheetsData)) return;

    var ss    = SpreadsheetApp.openById(BACKUP_SS_ID);
    var sheet = ss.getSheetByName(BACKUP_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(BACKUP_SHEET);
      sheet.appendRow(['저장시각', '시트수', 'URL수', '폴더수', '데이터(JSON)']);
      sheet.setFrozenRows(1);
      sheet.getRange('1:1').setFontWeight('bold');
      sheet.setColumnWidths(1, 4, 110);
    }

    var sheetCount  = data.sheetsData.length;
    var urlCount    = data.sheetsData.filter(function(s){ return s.link && s.link !== ''; }).length;
    var folderCount = _smCountFolders(data.treeData || []);

    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, 5).setValues([[
      new Date(),
      sheetCount,
      urlCount,
      folderCount,
      JSON.stringify(data)
    ]]);

    // 50개 초과 시 오래된 행 삭제
    var lastRow = sheet.getLastRow();
    if (lastRow > MAX_BACKUP_ROWS + 1) {
      sheet.deleteRows(MAX_BACKUP_ROWS + 2, lastRow - MAX_BACKUP_ROWS - 1);
    }
  } catch(e) {
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

// ── GAS 백업 복원용 엔드포인트 ──────────────────────────────
// 기존 doGet 함수가 없다면 아래를 추가하세요.
// 있다면 switch/if 분기에 'smBackupList', 'smBackupGet' 케이스를 추가하세요.

function doGet(e) {
  var action = (e.parameter || {}).action || '';

  if (action === 'smBackupList') {
    return _smBackupList();
  }
  if (action === 'smBackupGet') {
    return _smBackupGet(parseInt((e.parameter || {}).idx || '0', 10));
  }

  return ContentService.createTextOutput('SM Backup GAS OK')
    .setMimeType(ContentService.MimeType.TEXT);
}

function _smBackupList() {
  try {
    var ss      = SpreadsheetApp.openById(BACKUP_SS_ID);
    var sheet   = ss.getSheetByName(BACKUP_SHEET);
    var items   = [];
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
    return _smJson({ ok: true, items: items });
  } catch(e) {
    return _smJson({ ok: false, error: e.message });
  }
}

function _smBackupGet(idx) {
  try {
    var ss    = SpreadsheetApp.openById(BACKUP_SS_ID);
    var sheet = ss.getSheetByName(BACKUP_SHEET);
    var row   = idx + 2;
    if (!sheet || row > sheet.getLastRow()) throw new Error('범위 초과');
    var jsonStr = sheet.getRange(row, 5).getValue();
    return ContentService.createTextOutput(jsonStr)
      .setMimeType(ContentService.MimeType.JSON);
  } catch(e) {
    return _smJson({ ok: false, error: e.message });
  }
}

function _smJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
