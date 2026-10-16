/* Browser speech recognition and free-form Korean field-note parsing. */
'use strict';

const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
const KOREAN_DIGITS = { '영': '0', '공': '0', '일': '1', '이': '2', '삼': '3', '사': '4', '오': '5', '육': '6', '칠': '7', '팔': '8', '구': '9' };
const KOREAN_UNITS = { '십': 10, '백': 100, '천': 1000 };
const speechState = { supported: !!SpeechRecognitionApi, recognition: null, listening: false, disabled: false, manualPaused: false, finalText: '', interimText: '', restartTimer: null, lastCapture: null, lastError: '' };

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

function parseVoiceInput(value) {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    const number = '[0-9영공일이삼사오육칠팔구십백천]';
    const unitPattern = new RegExp(`(${number}{1,8})\\s*동\\s*(?:에|의|이고|에서|으로)?\\s*(${number}{1,8})\\s*호`);
    const match = raw.match(unitPattern);
    const building = match ? spokenNumberToDigits(match[1]) : '';
    const room = match ? spokenNumberToDigits(match[2]) : '';
    const location = building && room ? `${building}동 ${room}호` : '';
    let text = raw;
    if (match)
        text = text.replace(match[0], ' ');
    text = text
        .replace(/(?:위치|동호수|장소)\s*(?:를|가|는|은)?\s*(?:변경|바꿔|바꾸기|이동|설정)(?:해|해주세요|합니다|할게요)?/g, ' ')
        .replace(/(?:여기는|현재 위치는|위치는|장소는)\s*/g, ' ')
        .replace(/(?:입니다|이에요|예요|이야)(?=\s|$)/g, ' ')
        .replace(/\s*[,.;·]\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (/^(?:입니다|이에요|예요|이야|입니다요)$/.test(text))
        text = '';
    return { raw, location, text };
}

function applyVoiceLocation(location) {
    if (!location || state.location === location)
        return;
    state.location = location;
    state[state.mode + 'Location'] = location;
    saveSetting(state.mode + 'Location', location);
    locationRender();
    toast(`${location} · 음성으로 위치 적용`);
}

function speechPhrase() {
    return [speechState.finalText, speechState.interimText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function renderSpeechCaption() {
    if (!state.active || state.mode !== 'live' || state.paused)
        return;
    const phrase = speechPhrase();
    const parsed = parseVoiceInput(phrase);
    $('captionLabel').textContent = speechState.listening ? '한국어 음성인식 중' : speechState.manualPaused ? '음성인식 일시 중지' : speechState.supported && !speechState.disabled ? '음성인식 다시 연결 중' : '원본 녹음 중';
    $('captionText').textContent = phrase || '지적 내용을 자유롭게 말해 주세요.';
    $('captionSub').textContent = parsed.location
        ? `${parsed.location} 인식 · 문장이 보이면 촬영하세요.`
        : speechState.listening ? '말한 문장이 보이면 촬영하세요. 순서는 자유롭습니다.' : '인식이 안 되어도 사진과 원본 음성은 저장됩니다.';
    $('speechBtn')?.classList.toggle('listening', speechState.listening);
    $('speechBtn')?.setAttribute('aria-label', speechState.listening ? '음성인식 일시 중지' : '음성인식 다시 시작');
}

async function attachLateSpeech(text) {
    const link = speechState.lastCapture;
    if (!link || Date.now() - link.at > 2500)
        return false;
    const record = state.records.find(item => item.id === link.id);
    if (!record || record.text)
        return false;
    const parsed = parseVoiceInput(text);
    if (!parsed.text)
        return false;
    if (parsed.location)
        record.location = parsed.location;
    record.text = parsed.text.slice(0, 4000);
    record.transcriptRaw = parsed.raw.slice(0, 4000);
    record.transcriptionStatus = 'browser';
    record.updatedAt = Date.now();
    await put('records', record);
    renderRecords();
    toast('촬영 직후 인식된 설명을 사진에 연결했습니다.');
    speechState.lastCapture = null;
    return true;
}

async function handleFinalSpeech(text) {
    const parsed = parseVoiceInput(text);
    applyVoiceLocation(parsed.location);
    if (await attachLateSpeech(text)) {
        speechState.finalText = '';
        speechState.interimText = '';
    }
    else
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
        if (state.active && state.mode === 'live' && !state.paused && !state.stopping && !speechState.disabled && !speechState.manualPaused)
            speechState.restartTimer = setTimeout(() => startSpeechRecognition(), 350);
    };
    return recognition;
}

function startSpeechRecognition() {
    if (!speechState.supported || speechState.disabled || speechState.manualPaused || speechState.listening || state.mode !== 'live') {
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
        speechState.lastCapture = null;
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
    const parsed = parseVoiceInput(speechPhrase());
    applyVoiceLocation(parsed.location);
    speechState.finalText = '';
    speechState.interimText = '';
    return parsed;
}

function markSpeechCapture(recordId) {
    speechState.lastCapture = { id: recordId, at: Date.now() };
    renderSpeechCaption();
}
