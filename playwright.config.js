// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: true,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:8787',
        trace: 'retain-on-failure',
        viewport: { width: 1280, height: 960 }, // 편집 모달 전체가 뷰포트 안에 들어오도록 기본보다 크게
    },
    webServer: {
        command: 'python -m http.server 8787',
        url: 'http://localhost:8787/sheets-manager.html',
        reuseExistingServer: true,
        timeout: 10000,
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 960 } } },
    ],
});
