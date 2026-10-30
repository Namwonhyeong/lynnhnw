/* Browser speech recognition and free-form Korean field-note parsing. */
'use strict';

let nativeSpeechInstance = null;
class NativeSpeechRecognition {
    start() { nativeSpeechInstance = this; window.AndroidBridge.startSpeech(); }
    stop() { window.AndroidBridge.stopSpeech(); }
}
window.__nativeSpeechStart = () => nativeSpeechInstance?.onstart?.();
window.__nativeSpeechResult = (text, isFinal) => {
    if (!nativeSpeechInstance || !text)
        return;
    const result = [{ transcript: text }];
    result.isFinal = !!isFinal;
    nativeSpeechInstance.onresult?.({ resultIndex: 0, results: [result] });
};
window.__nativeSpeechError = error => nativeSpeechInstance?.onerror?.({ error });
window.__nativeSpeechEnd = () => { const instance = nativeSpeechInstance; nativeSpeechInstance = null; instance?.onend?.(); };
const SpeechRecognitionApi = window.AndroidBridge ? NativeSpeechRecognition : window.SpeechRecognition || window.webkitSpeechRecognition;
const KOREAN_DIGITS = { '영': '0', '공': '0', '일': '1', '이': '2', '삼': '3', '사': '4', '오': '5', '육': '6', '칠': '7', '팔': '8', '구': '9' };
const KOREAN_UNITS = { '십': 10, '백': 100, '천': 1000 };
const speechState = { supported: !!SpeechRecognitionApi, recognition: null, listening: false, disabled: false, manualPaused: false, finalText: '', interimText: '', restartTimer: null, lastError: '' };

function spokenNumberToDigits(value) {
    const text = String(value || '').replace(/\s+/g, '');
    if (/^\d+$/.test(text))
        return text;
    if ([...text].every(ch => KOREAN_DIGITS[ch] !== undefined))
        return [...text].map(ch => KOREAN_DIGITS[ch]).join('');
    let total = 0, current = 0;
    for (const ch of text) {
        if (KOREAN_DIGITS[ch] !== undefined)
            current = Number(KOREAN_DIGITS[ch]);
        else if (KOREAN_UNITS[ch]) {
            total += (current || 1) * KOREAN_UNITS[ch];
            current = 0;
        }
        else
            return '';
    }
    return String(total + current);
}

function parseVoiceInput(value, buildingMode = 'apartment') {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    const number = '[0-9영공일이삼사오육칠팔구십백천]';
    if (buildingMode === 'general') {
        const basement = raw.match(/\bB\s*(\d{1,3})\s*층?\b/i);
        const floorMatch = basement || raw.match(new RegExp(`(지하|지상)?\\s*(${number}{1,4})\\s*층`));
        const floorNumber = floorMatch ? spokenNumberToDigits(basement ? floorMatch[1] : floorMatch[2]) : '';
        const floor = floorNumber ? `${basement || floorMatch[1] === '지하' ? '지하 ' : ''}${floorNumber}층` : '';
        const roomMatch = raw.match(/([가-힣A-Za-z0-9]{1,12}실|로비|복도|옥상|주차장|식당|창고|강당|점포)/);
        const room = roomMatch?.[1] || '';
        let text = raw;
        if (floorMatch)
            text = text.replace(floorMatch[0], ' ');
        if (roomMatch)
            text = text.replace(roomMatch[0], ' ');
        return { raw, location: [floor, room].filter(Boolean).join(' '), text: cleanVoiceText(text) };
    }
    const unitPattern = new RegExp(`(${number}{1,8})\\s*동\\s*(?:에|의|이고|에서|으로)?\\s*(${number}{1,8})\\s*호`);
    const match = raw.match(unitPattern);
    const building = match ? spokenNumberToDigits(match[1]) : '';
    const room = match ? spokenNumberToDigits(match[2]) : '';
    const location = building && room ? `${building}동 ${room}호` : '';
    let text = raw;
    if (match)
        text = text.replace(match[0], ' ');
    text = cleanVoiceText(text);
    return { raw, location, text };
}

function cleanVoiceText(text) {
    text = text
        .replace(/(?:위치|동호수|장소)\s*(?:를|가|는|은)?\s*(?:변경|바꿔|바꾸기|이동|설정)(?:해|해주세요|합니다|할게요)?/g, ' ')
        .replace(/(?:여기는|현재 위치는|위치는|장소는)\s*/g, ' ')
        .replace(/(?:입니다|이에요|예요|이야)(?=\s|$)/g, ' ')
        .replace(/\s*[,.;·]\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (/^(?:입니다|이에요|예요|이야|입니다요)$/.test(text))
        text = '';
    return text;
}

function applyVoiceLocation(location) {
    if (!location || state.location === location)
        return;
    state.location = location;
    if (state.buildingMode === 'apartment') {
        state.liveLocation = location;
        saveSetting('liveLocation', location);
    }
    saveSetting(locationSettingKey(), location);
    locationRender();
    toast(`${location} · 음성으로 위치 적용`);
}

function speechPhrase() {
    return [speechState.finalText, speechState.interimText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function shouldRecognizeSpeech() {
    return !!state.draftPhoto;
}

function renderSpeechCaption() {
    if (!state.active || state.paused)
        return;
    if (!state.draftPhoto) {
        $('captionLabel').textContent = '다음 기록 준비';
        $('captionText').textContent = '사진을 먼저 촬영해 주세요.';
        $('captionSub').textContent = '촬영 직후 해당 사진의 음성인식이 시작됩니다.';
        return;
    }
    const phrase = speechPhrase();
    const parsed = parseVoiceInput(phrase, state.buildingMode);
    $('captionLabel').textContent = speechState.listening ? '한국어 음성인식 중' : speechState.manualPaused ? '음성인식 일시 중지' : speechState.supported && !speechState.disabled ? '음성인식 다시 연결 중' : '원본 녹음 중';
    $('captionText').textContent = phrase || '지적 내용을 자유롭게 말해 주세요.';
    $('captionSub').textContent = parsed.location
        ? `${parsed.location} 인식 · 설명이 끝나면 녹음 완료 OK를 누르세요.`
        : speechState.listening ? '설명이 끝나면 녹음 완료 OK를 누르세요. 순서는 자유롭습니다.' : '인식이 안 되어도 사진과 원본 음성은 저장됩니다.';
    $('speechBtn')?.classList.toggle('listening', speechState.listening);
    $('speechBtn')?.setAttribute('aria-label', speechState.listening ? '음성인식 일시 중지' : '음성인식 다시 시작');
}

async function handleFinalSpeech(text) {
    if (!state.draftPhoto)
        return;
    const parsed = parseVoiceInput(text, state.buildingMode);
    applyVoiceLocation(parsed.location);
    speechState.finalText = [speechState.finalText, text].filter(Boolean).join(' ').trim();
    renderSpeechCaption();
}

function makeSpeechRecognition() {
    if (!speechState.supported || speechState.disabled)
        return null;
    const recognition = new SpeechRecognitionApi();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { speechState.listening = true; speechState.lastError = ''; renderSpeechCaption(); };
    recognition.onresult = event => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0]?.transcript?.trim();
            if (!text)
                continue;
            if (event.results[i].isFinal)
                void handleFinalSpeech(text);
            else
                interim += (interim ? ' ' : '') + text;
        }
        speechState.interimText = interim;
        renderSpeechCaption();
    };
    recognition.onerror = event => {
        speechState.listening = false;
        if (['not-allowed', 'service-not-allowed'].includes(event.error)) {
            speechState.disabled = true;
            alertBox('브라우저 음성인식 권한이 없어 원본 녹음만 저장합니다. 지적 내용은 기록 상세에서 수정할 수 있습니다.');
        }
        else if (event.error === 'network' && speechState.lastError !== 'network') {
            speechState.lastError = 'network';
            alertBox('음성인식 네트워크가 불안정합니다. 사진과 원본 녹음은 계속 이 기기에 저장됩니다.');
        }
        renderSpeechCaption();
    };
    recognition.onend = () => {
        speechState.listening = false;
        renderSpeechCaption();
        clearTimeout(speechState.restartTimer);
        if (state.active && shouldRecognizeSpeech() && !state.paused && !state.stopping && !speechState.disabled && !speechState.manualPaused)
            speechState.restartTimer = setTimeout(() => startSpeechRecognition(), 350);
    };
    return recognition;
}

function startSpeechRecognition() {
    if (!speechState.supported || speechState.disabled || speechState.manualPaused || speechState.listening || !shouldRecognizeSpeech()) {
        renderSpeechCaption();
        return;
    }
    try {
        speechState.recognition ||= makeSpeechRecognition();
        speechState.recognition?.start();
    }
    catch (error) {
        if (error.name !== 'InvalidStateError')
            console.warn('Speech recognition start failed', error);
    }
}

function stopSpeechRecognition(clear = false) {
    clearTimeout(speechState.restartTimer);
    const recognition = speechState.recognition;
    speechState.recognition = null;
    speechState.listening = false;
    if (clear) {
        speechState.manualPaused = true;
        speechState.finalText = '';
        speechState.interimText = '';
    }
    try { recognition?.stop(); }
    catch { }
    renderSpeechCaption();
}

function pauseSpeechRecognition() { stopSpeechRecognition(false); }
function resumeSpeechRecognition() { startSpeechRecognition(); }
function toggleSpeechRecognition() {
    speechState.manualPaused = speechState.listening;
    if (speechState.manualPaused)
        stopSpeechRecognition(false);
    else
        startSpeechRecognition();
    renderSpeechCaption();
}

function takeSpeechSnapshot() {
    const parsed = parseVoiceInput(speechPhrase(), state.buildingMode);
    applyVoiceLocation(parsed.location);
    speechState.finalText = '';
    speechState.interimText = '';
    return parsed;
}
