'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'speech.js'), 'utf8');
const context = { window: {}, state: {}, console, setTimeout, clearTimeout };
vm.runInNewContext(source + '\n;globalThis.__speechTest = { spokenNumberToDigits, parseVoiceInput };', context);
const { spokenNumberToDigits, parseVoiceInput } = context.__speechTest;

assert.equal(spokenNumberToDigits('백일'), '101');
assert.equal(spokenNumberToDigits('삼공이'), '302');
assert.deepEqual(
    { ...parseVoiceInput('안방 창틀 우측 코킹이 빠졌고 여기는 101동 302호예요') },
    { raw: '안방 창틀 우측 코킹이 빠졌고 여기는 101동 302호예요', location: '101동 302호', text: '안방 창틀 우측 코킹이 빠졌고' }
);
assert.deepEqual(
    { ...parseVoiceInput('위치 변경 백일동 삼공이호') },
    { raw: '위치 변경 백일동 삼공이호', location: '101동 302호', text: '' }
);
assert.deepEqual(
    { ...parseVoiceInput('101동에 302호 욕실 타일 단차 보수 요청') },
    { raw: '101동에 302호 욕실 타일 단차 보수 요청', location: '101동 302호', text: '욕실 타일 단차 보수 요청' }
);
console.log('speech parser tests passed');
