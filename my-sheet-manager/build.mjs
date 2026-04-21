import { mkdirSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(__dirname, 'dist');

mkdirSync(dist, { recursive: true });

// sheets-manager.html → dist/index.html (루트 URL에서 바로 열림)
copyFileSync(resolve(root, 'sheets-manager.html'), resolve(dist, 'index.html'));

// 기타 정적 파일
for (const f of ['dashboard.html']) {
    try { copyFileSync(resolve(root, f), resolve(dist, f)); } catch {}
}

console.log('✓ dist/index.html → sheets-manager.html 복사 완료');
