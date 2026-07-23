// sheets-manager.html 핵심 플로우 스모크 테스트.
// 실제 팀 데이터를 절대 건드리지 않도록 GAS/Groq/Drive 등 외부 네트워크는
// 전부 가짜 응답으로 막고, 앱에 내장된 데모 데이터(시트 5개, 폴더 4개)만으로 검증한다.
const { test, expect } = require('@playwright/test');

async function gotoFresh(page) {
    await page.route('**script.google.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**api.groq.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto('/sheets-manager.html');
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('smOnboardingDone', '1'); });
    await page.reload();
    await page.waitForSelector('#sheet-container .sheet-card', { timeout: 10000 });
}

test.describe('sheets-manager 스모크 테스트', () => {
    test('데모 데이터로 로드되고 GAS_TOKEN이 요청에 붙는다', async ({ page }) => {
        const gasRequests = [];
        await page.route('**script.google.com/**', route => {
            const req = route.request();
            // GET은 쿼리스트링에, POST는 form body에 토큰이 실린다 — 둘 다 확인.
            gasRequests.push({ url: req.url(), method: req.method(), postData: req.postData() || '' });
            route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        });
        await page.goto('/sheets-manager.html');
        await page.evaluate(() => { localStorage.clear(); localStorage.setItem('smOnboardingDone', '1'); });
        const gasReqPromise = page.waitForRequest(req => req.url().includes('script.google.com'), { timeout: 15000 });
        await page.reload();
        await page.waitForSelector('#sheet-container .sheet-card', { timeout: 10000 });

        await expect(page.locator('#sheet-container .sheet-card')).toHaveCount(5);
        await expect(page.locator('.sheet-card', { hasText: '2026 Q3 마케팅 예산안' })).toBeVisible();

        // 로드/백업 시 호출되는 GAS 요청에 인증 토큰이 실려 있어야 한다 (보안 패치 회귀 방지).
        await gasReqPromise;
        expect(gasRequests.length).toBeGreaterThan(0);
        for (const req of gasRequests) {
            const carriesToken = req.url.includes('token=') || req.postData.includes('token=');
            expect(carriesToken).toBe(true);
        }
    });

    test('시트 추가 → 편집 → 삭제', async ({ page }) => {
        await gotoFresh(page);

        await page.click('#btn-add-sheet');
        await page.fill('#url-input', 'https://docs.google.com/spreadsheets/d/abc123XYZ/edit');
        await page.fill('#title-input', 'PW 테스트 시트');
        await expect(page.locator('#modal-add-btn')).toBeEnabled();
        await page.click('#modal-add-btn');

        const newCard = page.locator('.sheet-card', { hasText: 'PW 테스트 시트' });
        await expect(newCard).toBeVisible();

        // 편집: 제목 변경
        await newCard.locator('[data-card-edit-id]').click();
        await page.fill('#edit-title', 'PW 테스트 시트 (수정됨)');
        await page.click('#edit-save-btn');
        await expect(page.locator('.sheet-card', { hasText: 'PW 테스트 시트 (수정됨)' })).toBeVisible();

        // 삭제
        const editedCard = page.locator('.sheet-card', { hasText: 'PW 테스트 시트 (수정됨)' });
        await editedCard.locator('[data-card-trash-id]').click();
        await page.click('#confirm-ok-btn');
        await expect(page.locator('.sheet-card', { hasText: 'PW 테스트 시트' })).toHaveCount(0);
    });

    test('검색이 제목 기준으로 결과를 걸러낸다', async ({ page }) => {
        await gotoFresh(page);
        await page.fill('#searchInput', '마케팅');
        await expect(page.locator('.sheet-card', { hasText: '2026 Q3 마케팅 예산안' })).toBeVisible();
        await expect(page.locator('.sheet-card', { hasText: '전사 고객 연락처 마스터' })).toHaveCount(0);
    });

    test('리스트뷰 전환 시 렌더링이 깨지지 않고, 항목이 50개를 넘으면 "더 보기"가 뜬다', async ({ page }) => {
        await gotoFresh(page);
        await page.click('[data-view="list"]');
        await expect(page.locator('table.list-table')).toBeVisible();
        await expect(page.locator('table.list-table tbody tr')).toHaveCount(5);

        // 데모 5개로는 페이지 크기(50)를 못 채우므로, 내부 상태에 가짜 시트를 대량 주입해
        // 리스트뷰 페이지네이션("더 보기") 경로를 직접 검증한다.
        await page.evaluate(() => {
            for (let i = 100; i < 170; i++) {
                sheetsData.push({ id: i, title: `대량 테스트 시트 ${i}`, desc: '', owner: '테스터', updated: '2026-01-01', tags: [], isPinned: false, isFavorite: false, access: 'public', status: 'active', link: '#' });
            }
            applyFilters();
        });
        await expect(page.locator('table.list-table tbody tr:not(.lt-load-more-row)')).toHaveCount(50);
        const moreBtn = page.locator('.lt-load-more-row button');
        await expect(moreBtn).toBeVisible();
        await moreBtn.click();
        await expect(page.locator('table.list-table tbody tr:not(.lt-load-more-row)')).toHaveCount(75);
    });

    test('카드를 드래그해서 사이드바 폴더로 이동한다', async ({ page }) => {
        await gotoFresh(page);
        // 데모 데이터: "전사 고객 연락처 마스터"(id 2)는 원래 "영업" 폴더 소속.
        // "마케팅" 폴더(f-mktg)로 드래그해 옮긴다.
        const card = page.locator('.sheet-card[data-id="2"]');
        const targetFolder = page.locator('.tree-row[data-drop-folder-id="f-mktg"]');
        await expect(card).toBeVisible();
        await expect(targetFolder).toBeVisible();

        // Playwright의 locator.dragTo()는 실제 마우스 좌표/타이밍에 의존해 이 앱의
        // HTML5 드래그앤드롭(dragstart에서 클로저 변수에 저장하는 방식)과 간헐적으로
        // 어긋난다. dragstart→dragover→drop 네이티브 이벤트를 직접 쏴서 결정적으로 검증한다.
        await page.evaluate(() => {
            const dt = new DataTransfer();
            const source = document.querySelector('.sheet-card[data-id="2"]');
            const target = document.querySelector('.tree-row[data-drop-folder-id="f-mktg"]');
            source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
            target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
            target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
            source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
        });

        // UI 필터링(클릭 후 렌더링 타이밍)에 기대지 않고, 실제 상태(treeData)가 바뀌었는지 직접 확인한다.
        await expect(async () => {
            const folders = await page.evaluate(() => treeData.map(n => ({ id: n.id, children: (n.children||[]).map(c => c.sheetId) })));
            const mktg  = folders.find(f => f.id === 'f-mktg');
            const sales = folders.find(f => f.id === 'f-sales');
            expect(mktg.children).toContain(2);
            expect(sales.children).not.toContain(2);
        }).toPass({ timeout: 5000 });
    });
});
