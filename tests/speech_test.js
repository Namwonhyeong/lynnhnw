'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'speech.js'), 'utf8');
const context = { window: {}, state: {}, console, setTimeout, clearTimeout };
vm.runInNewContext(source + '\n;globalThis.__speechTest = { spokenNumberToDigits, parseVoiceInput, shouldRecognizeSpeech };', context);
const { spokenNumberToDigits, parseVoiceInput, shouldRecognizeSpeech } = context.__speechTest;

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
assert.deepEqual(
    { ...parseVoiceInput('천장 누수고 여기는 삼층 회의실입니다', 'general') },
    { raw: '천장 누수고 여기는 삼층 회의실입니다', location: '3층 회의실', text: '천장 누수고' }
);
assert.deepEqual(
    { ...parseVoiceInput('기계실 배관 누수 지하 일층', 'general') },
    { raw: '기계실 배관 누수 지하 일층', location: '지하 1층 기계실', text: '배관 누수' }
);
context.state.draftPhoto = '';
assert.equal(shouldRecognizeSpeech(), false);
context.state.draftPhoto = 'data:image/jpeg;base64,test';
assert.equal(shouldRecognizeSpeech(), true);

let nativeStarted = 0, nativeStopped = 0, nativeResult = '';
const nativeContext = { window: { AndroidBridge: { startSpeech: () => nativeStarted++, stopSpeech: () => nativeStopped++ } }, state: {}, console, setTimeout, clearTimeout };
vm.runInNewContext(source + '\n;globalThis.__nativeSpeechTest = SpeechRecognitionApi;', nativeContext);
const nativeRecognition = new nativeContext.__nativeSpeechTest();
nativeRecognition.onresult = event => { nativeResult = event.results[0][0].transcript; };
nativeRecognition.start();
nativeContext.window.__nativeSpeechResult('101동 302호 창틀 코킹 누락', false);
nativeRecognition.stop();
assert.equal(nativeStarted, 1);
assert.equal(nativeStopped, 1);
assert.equal(nativeResult, '101동 302호 창틀 코킹 누락');
console.log('speech parser tests passed');
