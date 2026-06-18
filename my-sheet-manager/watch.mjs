// sheets-manager.html 변경 감지 → git push → Vercel 자동 배포
import { watch }     from 'fs';
import { execSync }  from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = resolve(__dirname, '..');
const target    = resolve(repoRoot, 'sheets-manager.html');

let debounceTimer = null;

function run(cmd) {
    return execSync(cmd, { cwd: repoRoot, stdio: 'pipe' }).toString().trim();
}

function deploy() {
    console.log('\n📦 변경 감지 → 배포 시작...');
    try {
        // 1. dist 빌드
        execSync('node build.mjs', { cwd: __dirname, stdio: 'inherit' });

        // 2. 변경사항 스테이징
        run('git add sheets-manager.html');

        // 3. 실제 변경 있을 때만 커밋
        const status = run('git status --porcelain sheets-manager.html');
        if (!status) {
            console.log('ℹ️  내용 변경 없음 — 스킵');
            return;
        }

        const stamp = new Date().toLocaleString('ko-KR', { hour12: false });
        run(`git commit -m "auto: sheets-manager 업데이트 (${stamp})"`);
        run('git push');

        console.log('✅ push 완료 — Vercel 자동 배포 중 (약 30초)');
    } catch (e) {
        console.error('❌ 배포 실패:', e.message);
    }
}

console.log('👀 감시 시작: sheets-manager.html');
console.log('   저장하면 3초 후 자동 push → Vercel 배포\n');

watch(target, () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(deploy, 3000);
});
