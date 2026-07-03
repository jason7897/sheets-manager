# Sheets Manager — 작업 기록 및 기능 명세

## 파일 위치
- 앱: `C:\work\test\sheets-manager.html`
- GAS 백업 코드: `C:\work\test\backup-gas.gs`
- 복구 스크립트: `C:\work\test\recover.js`

---

## 구현된 기능 목록

### 1. 3중 자동 백업 시스템

| 레이어 | 방식 | 주기 |
|---|---|---|
| localStorage | 롤링 3개 스냅샷 | 저장할 때마다 |
| 파일 자동 다운로드 | JSON 파일 (Downloads) | 7일마다 또는 50회 저장마다 |
| Google Sheets 백업 | 누적 최대 50개 | 10회 저장마다 |

#### 관련 상수 (lines ~2300)
```javascript
const STORAGE_KEY          = 'sm-data-v1';
const BACKUP_KEY           = 'sm-backup-v1';
const LAST_FILE_BACKUP_KEY = 'sm-last-file-backup';
const SAVE_COUNTER_KEY     = 'sm-save-counter';
const FILE_BACKUP_INTERVAL = 7 * 24 * 60 * 60 * 1000;
const FILE_BACKUP_SAVE_TH  = 50;
const GAS_BACKUP_SAVE_TH   = 10;
```

#### GAS URL 설정 (lines ~2179)
```javascript
// 원본 데이터 GAS (기존 — 수정 금지)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyZTbVby_nfOn52pQuAn8Anb418Mx_b5J-r4HRV4tx1CAK7EOpxfV101Ike4mTFNFQ0/exec';

// SM_Host 백업 GAS (별도)
let BACKUP_GAS_URL = localStorage.getItem('sm-backup-gas-url')
  || 'https://script.google.com/macros/s/AKfycbx5qMDtBF1zUZXqftQQOYk3ARNWsOekvoHzIFAxCa48Aj37-4H-hFRlt-ACJjBpWndc/exec';
```

#### 백업 스프레드시트
- **이름**: SM 시트매니저 백업
- **ID**: `1MHNGZCB-6q1x23nA9LTqD443SWbceWTDMRIgm5NvJM8`
- **시트명**: `SM백업로그`

#### SM_Host GAS 스크립트
- **Script ID**: `1cWH5b3fEBXXEbno2YQy8a9d372EER9ZZoCrleVO3BpHj6qpIx6Lrw_sQ`
- **수정 내용**: `doGet`에 `smBackupList` / `smBackupGet` 분기 추가, `doPost`에 `_smBackup()` 호출 추가

#### 백업 복원 방법
사이드바 하단 `백업복원` 버튼 클릭 →
1. localStorage 스냅샷 (최근 3개)
2. Google Sheets 백업 (최근 50개, 날짜·시트수·URL수 표시)

---

### 2. 카드뷰 URL 표시

카드뷰에서 시트 제목 바로 아래에 URL 표시, 리스트뷰에서는 숨김.

```css
.card-url { display:block; font-size:11px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; margin:2px 0 5px; text-decoration:none; opacity:0.75; }
.card-url:hover { color:var(--primary); opacity:1; text-decoration:underline; }
#sheet-container.list-view .card-url { display:none; }
```

---

### 3. 마우스 우클릭 컨텍스트 메뉴

#### 카드 위 우클릭
- 편집 / 이름 변경 / **URL 수정·추가** / **폴더 이동** / 코멘트 / 링크 복사 / 즐겨찾기 / 핀 / 삭제

#### 빈 영역 우클릭 (`#sheet-container` 카드 없는 곳)
- 새 시트 추가 / 새 폴더 추가

---

### 4. 드래그로 폴더 병합

카드를 다른 카드 **중앙 40%** 위에 드롭 → 새 폴더 생성 (두 시트 모두 포함)

```css
.sheet-card.card-drop-merge {
  box-shadow: 0 0 0 3px var(--primary), 0 8px 32px rgba(0,0,0,0.18);
  background: var(--primary-light) !important;
  transform: scale(1.025);
}
.sheet-card.card-drop-merge::after {
  content: '📁 폴더로 합치기';
  position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
  background: var(--primary); color: #fff; font-size: 11px; font-weight: 700;
  padding: 3px 10px; border-radius: 8px;
}
```

- 상단/하단 30% = 순서 변경 (기존 동작)
- 중앙 40% = 폴더 병합 (신규)

---

## GAS 설정 이력

| 항목 | 배포 ID |
|---|---|
| 원본 데이터 GAS | `AKfycbyZTbVby_nfOn52pQuAn8Anb418Mx_b5J-r4HRV4tx1CAK7EOpxfV101Ike4mTFNFQ0` |
| SM_Host 백업 GAS | `AKfycbx5qMDtBF1zUZXqftQQOYk3ARNWsOekvoHzIFAxCa48Aj37-4H-hFRlt-ACJjBpWndc` |

---

## 주요 수정 이력

| 날짜 | 내용 |
|---|---|
| 2026-06-11 | 3중 백업 시스템 구현 (localStorage + 파일 + GAS) |
| 2026-06-11 | 카드뷰 URL 표시 추가 |
| 2026-06-11 | 우클릭 컨텍스트 메뉴 (URL 수정, 폴더 이동, 빈 영역 메뉴) |
| 2026-06-11 | 드래그 폴더 병합 기능 추가 |
| 2026-06-11 | "서버 저장 실패" 버그 수정 (init에서 잘못된 `_saveToGAS()` 호출 제거) |
| 2026-06-11 | GAS URL 분리 (`GAS_URL` vs `BACKUP_GAS_URL`) |
