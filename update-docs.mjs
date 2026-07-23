#!/usr/bin/env node
// CLAUDE.md에 적힌 sheets-manager.html 줄 수 표기를 실제 값으로 맞춘다.
// 실행: node update-docs.mjs  (큰 수정 후 커밋 전에 돌릴 것)
import { readFileSync, writeFileSync } from 'fs';

const html = readFileSync('sheets-manager.html', 'utf8');
const actualLines = html.split('\n').length;

const claudeMdPath = 'CLAUDE.md';
const claudeMd = readFileSync(claudeMdPath, 'utf8');

const re = /\*\*Size\*\*: ~[\d,]+\+? lines/;
if (!re.test(claudeMd)) {
    console.error('CLAUDE.md에서 줄 수 표기 패턴("**Size**: ~N lines")을 찾지 못했습니다. 수동으로 확인하세요.');
    process.exit(1);
}

const replacement = `**Size**: ~${actualLines.toLocaleString('en-US')}+ lines`;
const updated = claudeMd.replace(re, replacement);

if (updated === claudeMd) {
    console.log(`CLAUDE.md 줄 수 표기가 이미 최신입니다 (${actualLines}줄).`);
} else {
    writeFileSync(claudeMdPath, updated);
    console.log(`CLAUDE.md 줄 수 표기를 갱신했습니다 → ${actualLines}줄.`);
}
