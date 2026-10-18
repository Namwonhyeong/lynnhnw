/* 현장노트 v2 · 개발 인수인계
 * 공통 도구, IndexedDB, 카메라·연속 녹음, 촬영, 상세 보기, ZIP 백업
 * 원본 HTML의 인라인 스크립트 2–138행에서 분리했습니다.
 * classic script: 전역 이름과 로드 순서에 의존합니다. ESM 전환 시 별도 리팩터링이 필요합니다.
 */
'use strict';
// Self-contained prototype. No cloud SDK, API key, speech service, or external request.
const $ = id => document.getElementById(id);
const icons = { brand: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="m14 18 3 3 5-7"/>', camera: '<path d="M8 6 9.5 3.8h5L16 6h3.5A1.5 1.5 0 0 1 21 7.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-11A1.5 1.5 0 0 1 4.5 6z"/><circle cx="12" cy="12.5" r="3.6"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>', pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>', mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>', arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>', play: '<path d="m8 4 12 8-12 8Z"/>', image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>', device: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10 18h4"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>' };
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.info}</svg>`; }
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon); }); }
function esc(v = '') { return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function uid() { return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
const examples = [
    { text: '거실 창호 하부 코킹 누락, ○○창호 보수.', part: '거실 · 창호', scene: 0 },
    { text: '안방 문선 찍힘, ○○내장 보수.', part: '안방 · 문선', scene: 1 },
    { text: '욕실 바닥 타일 단차, ○○타일 확인.', part: '욕실 · 타일', scene: 2 },
    { text: '주방 걸레받이 미시공, ○○가구 확인.', part: '주방 · 걸레받이', scene: 3 },
    { text: '작은방 벽지 들뜸, ○○도배 보수.', part: '작은방 · 벽지', scene: 1 },
    { text: '현관 몰딩 이음부 틈새, ○○내장 보수.', part: '현관 · 몰딩', scene: 0 }
];
// Deliberately illustrative demo frames, not photographs of a real site.
function sceneData(index = 0) {
    const palettes = [['#b7c4c4', '#ced6d1', '#788e90'], ['#c4beb4', '#dbd4c5', '#8f887c'], ['#a9c1c3', '#cfdbd7', '#778e8b'], ['#bfcbc5', '#dce1d5', '#8e9e8f']];
    const p = palettes[index % 4];
    let detail = '';
    if (index % 4 === 0) {
        detail = `<rect x="168" y="36" width="414" height="245" rx="2" fill="#667e82"/><rect x="179" y="46" width="391" height="222" fill="#a9c4c6"/><path d="M378 46v222M181 252h389" stroke="#e2e8dd" stroke-width="11"/><path d="M195 65h167v148H195zM393 65h160v148H393z" fill="#b6cdd0"/><path d="m191 265 65 0 7 6 9-8 13 5 21-2" fill="none" stroke="#df824b" stroke-width="4"/><rect x="151" y="277" width="446" height="17" fill="#e7e8da"/><path d="M378 69v165" stroke="#7e969b" stroke-width="2"/>`;
    }
    else if (index % 4 === 1) {
        detail = '<rect x="309" y="12" width="218" height="352" fill="#817e75"/><rect x="328" y="28" width="181" height="336" fill="#d5c8b3"/><rect x="342" y="40" width="151" height="316" fill="#b3a38b"/><path d="m330 149 11 4-4 11 7 7-14-2" stroke="#f49364" fill="none" stroke-width="3"/><path d="M475 183v32" stroke="#e1dbcc" stroke-width="6"/>';
    }
    else if (index % 4 === 2) {
        detail = '<path d="M0 80h780M0 145h780M0 211h780M0 277h780M142 0v297M301 0v297M461 0v297M620 0v297" stroke="#96aca8" stroke-width="2"/><rect x="567" y="175" width="118" height="141" rx="18" fill="#e0e8df"/><path d="m323 347 109-6" stroke="#f19c6c" stroke-width="4"/><path d="m341 343 22-26h56l27 26" fill="#c1d1c7" stroke="#80958f" stroke-width="2"/>';
    }
    else {
        detail = '<rect x="150" y="142" width="471" height="187" fill="#e3e4d7"/><rect x="139" y="133" width="493" height="17" fill="#f0eee4"/><path d="M269 149v179M387 149v179M506 149v179" stroke="#bac5ba" stroke-width="2"/><path d="M247 171v19M365 171v19M484 171v19M601 171v19" stroke="#829b94" stroke-width="4"/><rect x="160" y="329" width="451" height="22" fill="#7b938a"/><path d="M276 344h105" stroke="#ec9461" stroke-width="4"/>';
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="450" viewBox="0 0 780 450"><defs><linearGradient id="light" x2="1" y2="1"><stop stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient><linearGradient id="floor" x2="0" y2="1"><stop stop-color="${p[2]}"/><stop offset="1" stop-color="#78908b"/></linearGradient></defs><rect width="780" height="450" fill="url(#light)"/><path d="M0 0h86v314L0 383" fill="#829896" opacity=".3"/><path d="M0 365 85 310h626l69 55v85H0" fill="url(#floor)"/><path d="M85 310h625M0 401h780M187 310 107 450M334 310 310 450M481 310 513 450M629 310 718 450" stroke="#ccdad0" opacity=".35" stroke-width="1.4"/>${detail}<path d="M0 361 85 306h60M632 306h78l70 55" stroke="#e1e4d5" stroke-width="8"/><path d="M0 0h780v450H0Z" fill="#173239" opacity=".06"/></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const state = { mode: 'live', active: false, paused: false, session: null, records: [], sessions: [], db: null, location: '', keep: true, exampleIndex: 0, filter: 'all', stream: null, recorder: null, chunkSeq: 0, chunkChain: Promise.resolve(), timer: null, origin: 0, pauseAt: 0, pausedMs: 0, busy: false, stopping: false, detailId: null, audioURL: null, wake: null, saveFailures: 0, view: 'capture', demoLocation: '', liveLocation: '' };
function toast(msg, error = false) { $('toast').textContent = msg; $('toast').classList.toggle('error', error); $('toast').classList.add('visible'); clearTimeout(toast.t); toast.t = setTimeout(() => $('toast').classList.remove('visible'), 3200); }
function alertBox(msg) { $('runtimeAlert').textContent = msg; $('runtimeAlert').classList.toggle('hidden', !msg); }
function fmtClock(ms) { const s = Math.floor(Math.max(0, ms) / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
function fmtTime(t) { return new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }); }
function fmtDate(t) { return new Date(t).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }); }
function elapsed() { return state.active ? Math.max(0, (state.paused ? state.pauseAt : performance.now()) - state.origin - state.pausedMs) : 0; }
function readSetting(key, fallback) { try {
    return JSON.parse(localStorage.getItem('field-note-' + key)) ?? fallback;
}
catch {
    return fallback;
} }
function saveSetting(key, value) { try {
    localStorage.setItem('field-note-' + key, JSON.stringify(value));
}
catch { } }
function openDB() { return new Promise((resolve, reject) => { const req = indexedDB.open('field-note-prototype-v1', 1); req.onupgradeneeded = () => { const db = req.result; db.createObjectStore('records', { keyPath: 'id' }); db.createObjectStore('sessions', { keyPath: 'id' }); const chunks = db.createObjectStore('chunks', { keyPath: 'id' }); chunks.createIndex('sessionId', 'sessionId', { unique: false }); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); req.onblocked = () => reject(new Error('저장소가 다른 창에서 사용 중입니다. 다른 창을 닫고 다시 열어주세요.')); }); }
function transaction(store, mode, operation) { return new Promise((resolve, reject) => { if (!state.db)
    return reject(new Error('저장소를 사용할 수 없습니다.')); let tx; try {
    tx = state.db.transaction(store, mode);
    const req = operation(tx.objectStore(store));
    let result;
    req.onsuccess = () => result = req.result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || req.error);
    tx.onabort = () => reject(tx.error || new Error('저장 취소'));
}
catch (e) {
    reject(e);
} }); }
const put = (store, item) => transaction(store, 'readwrite', s => s.put(item));
const getAll = store => transaction(store, 'readonly', s => s.getAll());
const del = (store, id) => transaction(store, 'readwrite', s => s.delete(id));
async function getChunks(sessionId) { return transaction('chunks', 'readonly', s => s.index('sessionId').getAll(sessionId)); }
async function sessionBlob(id) { const chunks = await getChunks(id); chunks.sort((a, b) => a.seq - b.seq); const session = state.sessions.find(s => s.id === id); return new Blob(chunks.map(c => c.blob), { type: session?.mime || chunks[0]?.blob?.type || 'audio/webm' }); }
function locationRender() { $('locationText').textContent = state.location || (state.active ? '위치 미지정' : '점검 시작 시 위치 설정'); $('keepLocation').checked = state.keep; }
function tagMarkup(r) { return `<span class="tag saved">이 기기 저장</span>${r.mode === 'demo' ? '<span class="tag">예시 문장</span>' : r.transcriptionStatus === 'browser' ? '<span class="tag">음성 인식</span>' : r.text ? '<span class="tag">직접 수정</span>' : '<span class="tag pending">음성 확인 필요</span>'}`; }
function recordDescription(r) { return r.text || '음성 원본 기록 · 내용 확인 필요'; }
function renderRecordsCore() {
    const rs = [...state.records].sort((a, b) => b.createdAt - a.createdAt);
    $('totalCount').textContent = rs.length;
    $('listCount').textContent = rs.length;
    $('recentCounter').textContent = `${rs.length}건`;
    $('recentList').innerHTML = rs.length ? rs.slice(0, 3).map(r => `<button class="recent-card" data-record="${r.id}"><img src="${r.photo}" alt="${esc(r.location || '위치 미지정')} 촬영 기록"><div class="recent-body"><div class="recent-meta"><b>${esc(r.location || '위치 미지정')}</b><span>· ${fmtTime(r.createdAt)}</span></div><p class="recent-text">${esc(recordDescription(r))}</p><div class="record-tags">${tagMarkup(r)}</div></div></button>`).join('') : `<div class="empty-recent">${icon('image')}<strong>촬영하면 여기에 쌓입니다.</strong><p>사진을 고르고 설명을 다시 붙이는 대신<br>기록이 남았는지만 확인하세요.</p></div>`;
    const current = state.session ? rs.filter(r => r.sessionId === state.session.id) : [];
    $('sessionCount').textContent = `${current.length}건`;
    $('lastThumb').innerHTML = current.length ? `<img src="${current[0].photo}" alt="최근 등록 사진">` : icon('image');
    const query = $('search').value.trim().toLowerCase();
    const filtered = rs.filter(r => (state.filter === 'all' || state.filter === 'demo' && r.mode === 'demo' || state.filter === 'pending' && r.mode === 'live' && !r.text) && `${r.location} ${r.text}`.toLowerCase().includes(query));
    $('recordGrid').innerHTML = filtered.length ? filtered.map(r => `<button class="grid-card" data-record="${r.id}"><div class="photo"><img src="${r.photo}" alt="${esc(r.location || '위치 미지정')} 사진"><span class="photo-index">${r.mode === 'demo' ? '체험' : '촬영'} ${String(r.number).padStart(2, '0')}</span></div><div class="grid-body"><div class="grid-loc">${esc(r.location || '위치 미지정')}</div><p class="grid-desc">${esc(recordDescription(r))}</p><div class="grid-bottom"><span>${tagMarkup(r)}</span><span>${fmtDate(r.createdAt)} ${fmtTime(r.createdAt)}</span></div></div></button>`).join('') : `<div class="empty-list">${icon('image')}<h3>${query || state.filter !== 'all' ? '해당하는 기록이 없습니다.' : '아직 등록한 기록이 없습니다.'}</h3><p>현장 등록에서 점검을 시작하고 촬영해보세요.<br>사진과 위치가 자동으로 목록에 남습니다.</p></div>`;
    $('exportBtn').disabled = !rs.length;
}
function updateViewLegacy(view) { state.view = view; $('captureView').classList.toggle('hidden', view !== 'capture'); $('listView').classList.toggle('hidden', view !== 'list'); $('captureTab').classList.toggle('active', view === 'capture'); $('listTab').classList.toggle('active', view === 'list'); if (view === 'list' && state.active && !state.paused) {
    pauseSession(true);
    toast('목록을 보는 동안 녹음을 일시정지합니다.');
} }
function setScene() { const ex = examples[state.exampleIndex % examples.length]; $('sceneImage').src = sceneData(ex.scene); }
function showNextExample() { const ex = examples[state.exampleIndex % examples.length]; setScene(); $('captionLabel').textContent = '음성 입력 예시 · 실제 인식 아님'; $('captionText').textContent = ex.text; $('captionSub').textContent = '촬영을 누르면 이 예시 설명이 사진과 함께 저장됩니다.'; }
function uiState() {
    document.body.classList.toggle('session-on', state.active);
    $('startArea').classList.toggle('hidden', state.active);
    for (const id of ['lastShortcut', 'shutterWrap', 'sessionActions'])
        $(id).classList.toggle('hidden', !state.active);
    $('cameraStage').classList.toggle('recording', state.active && !state.paused);
    $('cameraStage').classList.toggle('paused', state.paused);
    $('stateBadge').classList.toggle('recording', state.active && !state.paused);
    $('stateBadge').classList.toggle('paused', state.paused);
    $('stateLabel').textContent = state.paused ? '녹음 일시정지' : state.active ? (state.mode === 'demo' ? '연속 점검 · 체험 중' : '연속 녹음 중') : '점검 시작 전';
    $('pauseBtn').innerHTML = icon(state.paused ? 'play' : 'pause');
    $('pauseBtn').ariaLabel = state.paused ? '녹음 이어하기' : '녹음 일시정지';
    $('shutter').disabled = state.paused || state.busy || state.stopping;
    $('finishBtn').disabled = state.stopping;
    $('demoMode').disabled = state.active || state.busy;
    $('liveMode').disabled = state.active || state.busy;
    $('locationBtn').disabled = state.stopping;
    locationRender();
}
function setMode(mode) {
    if (state.active || state.busy)
        return;
    state.mode = mode;
    state.location = state[mode + 'Location'];
    saveSetting('mode', mode);
    $('demoMode').classList.toggle('selected', mode === 'demo');
    $('liveMode').classList.toggle('selected', mode === 'live');
    $('modeNote').innerHTML = mode === 'demo' ? '<b>화면 체험 중</b> · 음성은 예시 문장으로 표시됩니다.' : '<b>음성·카메라 실사용</b> · 자유롭게 말하고 문장이 보이면 촬영하세요.';
    $('sceneImage').classList.remove('hidden');
    $('liveVideo').classList.add('hidden');
    $('sampleBadge').textContent = mode === 'demo' ? '예시 이미지 · 실제 촬영 아님' : '대기 화면 · 시작 시 카메라 연결';
    $('sampleBadge').classList.remove('hidden');
    $('startDescription').innerHTML = mode === 'demo' ? '체험에서는 카메라·마이크 권한 없이<br>연속 등록 흐름을 확인할 수 있어요.' : '시작 시 카메라·마이크 권한을 요청합니다.<br>인식 문장과 사진·원본 음성을 이 기기에 저장합니다.';
    $('captionLabel').textContent = '사진과 설명을 한 번에';
    $('captionText').innerHTML = '점검은 시작할 때 한 번만.<br>그다음은 촬영 버튼 하나.';
    $('captionSub').textContent = mode === 'demo' ? '녹음 시작 · 종료 · 등록을 매번 누르지 않습니다.' : '말한 문장이 보이면 촬영하세요. 말하는 순서는 자유롭습니다.';
    $('elapsed').textContent = '00:00';
    alertBox('');
    uiState();
}
async function acquireWake() { try {
    state.wake = await navigator.wakeLock?.request('screen');
}
catch { } }
async function startSession() {
    if (state.active || state.busy)
        return;
    if (!state.db) {
        toast('브라우저 저장소를 사용할 수 없어 시작할 수 없습니다.', true);
        return;
    }
    state.busy = true;
    $('startBtn').disabled = true;
    uiState();
    alertBox('');
    let stream = null, startingSession = null;
    try {
        if (state.mode === 'live') {
            speechState.manualPaused = false;
            if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
                throw new Error('카메라·마이크 사용에는 HTTPS 또는 localhost가 필요합니다. 현재 환경에서는 화면 체험을 이용하세요.');
            if (!window.MediaRecorder)
                throw new Error('이 브라우저는 녹음을 지원하지 않습니다. 다른 브라우저에서 테스트하세요.');
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
            state.stream = stream;
            $('liveVideo').srcObject = stream;
            await $('liveVideo').play();
            $('liveVideo').classList.remove('hidden');
            $('sceneImage').classList.add('hidden');
            $('sampleBadge').classList.add('hidden');
        }
        const session = { id: uid(), mode: state.mode, createdAt: Date.now(), status: 'recording', mime: '', durationMs: 0, locationAtStart: state.location };
        startingSession = session;
        if (state.mode === 'live') {
            const choices = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
            const mime = choices.find(m => MediaRecorder.isTypeSupported(m));
            state.recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks()), mime ? { mimeType: mime } : {});
            session.mime = state.recorder.mimeType;
            state.chunkSeq = 0;
            state.chunkChain = Promise.resolve();
            state.saveFailures = 0;
            state.recorder.ondataavailable = e => { if (!e.data.size)
                return; const chunk = { id: `${session.id}:${state.chunkSeq}`, sessionId: session.id, seq: state.chunkSeq++, blob: e.data, receivedAt: Date.now() }; state.chunkChain = state.chunkChain.then(() => put('chunks', chunk)).catch(err => { state.saveFailures++; alertBox('녹음 저장 오류가 발생했습니다. 점검을 중단하고 기존 기록을 백업하세요.'); if (state.active && !state.paused)
                pauseSession(true); console.error(err); }); };
            state.recorder.onerror = e => { alertBox('녹음 장치 오류입니다. 점검을 종료한 뒤 다시 시작하세요.'); pauseSession(true); console.error(e.error); };
        }
        if (state.mode === 'demo' && !state.location) {
            state.location = '101동 1203호';
            state.demoLocation = state.location;
            saveSetting('demoLocation', state.location);
        }
        session.locationAtStart = state.location;
        await put('sessions', session);
        state.sessions.push(session);
        state.session = session;
        state.active = true;
        state.paused = false;
        state.origin = performance.now();
        state.pausedMs = 0;
        state.pauseAt = 0;
        state.exampleIndex = 0;
        if (state.recorder)
            state.recorder.start(1000);
        if (state.mode === 'demo')
            showNextExample();
        else {
            $('captionLabel').textContent = speechState.supported ? '한국어 음성인식 연결 중' : '원본 녹음 중';
            $('captionText').textContent = '지적 내용을 자유롭게 말해 주세요.';
            $('captionSub').textContent = speechState.supported ? '문장이 보이면 촬영하세요. 동·호수는 문장 어디에 있어도 됩니다.' : '이 브라우저는 음성인식을 지원하지 않아 원본 녹음만 저장합니다.';
            startSpeechRecognition();
            for (const track of stream.getTracks())
                track.onended = () => { if (state.active && !state.stopping) {
                    alertBox('카메라 또는 마이크 연결이 끊겼습니다. 점검을 종료하고 확인하세요.');
                    pauseSession(true);
                } };
        }
        state.timer = setInterval(() => { $('elapsed').textContent = fmtClock(elapsed()); }, 250);
        await acquireWake();
        toast(state.mode === 'demo' ? `체험 시작 · ${state.location || '위치 미지정'}` : '연속 녹음 시작 · 지적 내용을 말하면서 촬영하세요.');
    }
    catch (e) {
        stream?.getTracks().forEach(t => t.stop());
        state.stream = null;
        state.recorder = null;
        state.active = false;
        state.paused = false;
        if (startingSession) {
            startingSession.status = 'failed';
            await put('sessions', startingSession).catch(() => { });
            if (state.session?.id === startingSession.id)
                state.session = null;
        }
        const errors = { NotAllowedError: '카메라·마이크 권한이 허용되지 않았습니다. 브라우저 권한을 확인하거나 화면 체험을 이용하세요.', NotFoundError: '사용할 카메라 또는 마이크를 찾지 못했습니다. 화면 체험으로 흐름을 확인하세요.', NotReadableError: '카메라나 마이크를 다른 앱에서 사용 중일 수 있습니다. 장치를 확인하세요.' };
        alertBox(errors[e.name] || e.message);
        toast('점검을 시작하지 못했습니다.', true);
        setScene();
        $('sceneImage').classList.remove('hidden');
        $('liveVideo').classList.add('hidden');
    }
    finally {
        state.busy = false;
        $('startBtn').disabled = false;
        uiState();
        renderRecords();
    }
}
function pauseSession(force = false) {
    if (!state.active || state.stopping)
        return;
    if (force && state.paused)
        return;
    if (!state.paused) {
        state.pauseAt = performance.now();
        state.paused = true;
        if (state.recorder?.state === 'recording')
            state.recorder.pause();
        pauseSpeechRecognition();
        state.stream?.getAudioTracks().forEach(t => t.enabled = false);
        $('captionLabel').textContent = '녹음 일시정지';
        $('captionText').textContent = '잠시 멈췄습니다.';
        $('captionSub').textContent = '이어하기를 누르면 같은 위치에서 계속 기록합니다.';
    }
    else {
        state.pausedMs += performance.now() - state.pauseAt;
        state.paused = false;
        state.stream?.getAudioTracks().forEach(t => t.enabled = true);
        if (state.recorder?.state === 'paused')
            state.recorder.resume();
        if (state.mode === 'demo')
            showNextExample();
        else {
            resumeSpeechRecognition();
        }
        acquireWake();
    }
    uiState();
}
async function finishSession() {
    if (!state.active || state.stopping || state.busy)
        return;
    state.stopping = true;
    stopSpeechRecognition(false);
    uiState();
    const duration = elapsed();
    try {
        if (state.recorder && state.recorder.state !== 'inactive') {
            await new Promise(resolve => { state.recorder.addEventListener('stop', resolve, { once: true }); state.recorder.stop(); });
            await state.chunkChain;
        }
        state.stream?.getTracks().forEach(t => { t.onended = null; t.stop(); });
        state.session.status = state.saveFailures ? 'incomplete' : 'complete';
        state.session.endedAt = Date.now();
        state.session.durationMs = duration;
        await put('sessions', state.session);
        toast(state.saveFailures ? '일부 녹음 저장 실패 · 기록을 확인하세요.' : '점검 종료 · 저장된 기록을 확인하세요.', !!state.saveFailures);
    }
    catch (e) {
        alertBox('점검 종료 정보 저장에 실패했습니다. 기록 백업으로 보관하세요.');
        console.error(e);
    }
    finally {
        state.stream?.getTracks().forEach(t => { t.onended = null; t.stop(); });
        state.stream = null;
        state.recorder = null;
        state.active = false;
        state.paused = false;
        state.stopping = false;
        clearInterval(state.timer);
        await state.wake?.release().catch(() => { });
        state.wake = null;
        $('liveVideo').srcObject = null;
        $('liveVideo').classList.add('hidden');
        $('sceneImage').classList.remove('hidden');
        $('sampleBadge').classList.remove('hidden');
        $('captionLabel').textContent = '점검을 마쳤습니다.';
        $('captionText').textContent = '기록은 남았고, 정리는 가볍게.';
        $('captionSub').textContent = '다음 점검도 시작 버튼 한 번으로 이어가세요.';
        uiState();
        renderRecords();
        updateView('list');
    }
}
async function capture() {
    if (!state.active || state.paused || state.busy || state.stopping)
        return;
    state.busy = true;
    uiState();
    $('saveStatus').textContent = '이 기기에 저장 중…';
    const photoTime = Date.now(), offset = Math.round(elapsed());
    try {
        let photo, text = '', transcriptRaw = '', transcriptionStatus = 'not_supported';
        const ex = examples[state.exampleIndex % examples.length];
        if (state.mode === 'demo') {
            photo = sceneData(ex.scene);
            text = ex.text;
        }
        else {
            const speech = takeSpeechSnapshot();
            text = speech.text;
            transcriptRaw = speech.raw;
            transcriptionStatus = text ? 'browser' : speechState.supported ? 'pending' : 'not_supported';
            const v = $('liveVideo');
            if (!v.videoWidth)
                throw new Error('카메라 화면이 준비되지 않았습니다.');
            const scale = Math.min(1, 1600 / v.videoWidth);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
            photo = canvas.toDataURL('image/jpeg', .87);
        }
        const r = { id: uid(), sessionId: state.session.id, number: state.records.filter(r => r.sessionId === state.session.id).length + 1, mode: state.mode, createdAt: photoTime, location: state.location, text, transcriptRaw, photo, photoFormat: state.mode === 'demo' ? 'svg' : 'jpg', audioOffsetMs: offset, transcriptionStatus: state.mode === 'demo' ? 'demo' : transcriptionStatus, cloudStatus: 'not_connected' };
        await put('records', r);
        state.records.push(r);
        if (state.mode === 'live' && !text)
            markSpeechCapture(r.id);
        $('flash').classList.remove('fire');
        void $('flash').offsetWidth;
        $('flash').classList.add('fire');
        $('saveStatus').textContent = `${fmtTime(photoTime)} · 사진 ${String(r.number).padStart(2, '0')} 저장됨`;
        if (!state.keep) {
            state.location = '';
            state[state.mode + 'Location'] = '';
            saveSetting(state.mode + 'Location', '');
            locationRender();
        }
        state.exampleIndex++;
        if (state.mode === 'demo')
            showNextExample();
        else {
            $('captionText').textContent = text || '저장됐습니다. 다음 지적 내용을 말해 주세요.';
            $('captionSub').textContent = text ? '인식 문장과 사진을 함께 저장했습니다.' : '인식이 늦으면 촬영 직후 문장을 자동 연결합니다.';
        }
        renderRecords();
        toast(state.mode === 'demo' ? `사진 ${String(r.number).padStart(2, '0')} · 예시 설명 자동 저장` : `사진 ${String(r.number).padStart(2, '0')} · 촬영 시각과 원본 음성 기록`);
    }
    catch (e) {
        $('saveStatus').textContent = '저장 실패 · 다시 촬영해 주세요';
        alertBox(`사진이 저장되지 않았습니다. ${e.message}`);
        toast('저장 실패 · 기록을 확인하세요.', true);
    }
    finally {
        state.busy = false;
        uiState();
    }
}
function openLocation() { if (state.active && !state.paused)
    pauseSession(true); $('locationInput').value = state.location; $('locationExample').classList.toggle('hidden', state.mode !== 'demo'); $('locationHelp').textContent = state.mode === 'demo' ? '체험에서는 아래 예시를 눌러 위치 변경 흐름을 확인합니다.' : '점검 중에는 문장 속 동·호수를 자동으로 찾습니다. 여기서는 인식 결과를 수동 보정할 수 있습니다.'; const next = state.location.includes('1204') ? '101동 1205호' : '101동 1204호'; $('locationExample').dataset.next = next; $('locationExampleText').textContent = `“위치 변경, ${next}”`; $('locationDialog').showModal(); }
function applyLocation(value) { state.location = value.trim().replace(/\s+/g, ' ').slice(0, 80); state[state.mode + 'Location'] = state.location; saveSetting(state.mode + 'Location', state.location); locationRender(); $('locationDialog').close(); alertBox(''); toast(state.location ? `${state.location} · 다음 촬영부터 적용` : '위치가 초기화됐습니다.'); if (state.active && state.paused)
    pauseSession(); }
async function openDetailBase(id) {
    const r = state.records.find(r => r.id === id);
    if (!r)
        return;
    if (state.active && !state.paused)
        pauseSession(true);
    state.detailId = id;
    if (state.audioURL) {
        URL.revokeObjectURL(state.audioURL);
        state.audioURL = null;
    }
    $('detailBody').innerHTML = `<img class="detail-image" src="${r.photo}" alt="촬영 사진"><div class="detail-meta"><span class="detail-location">${esc(r.location || '위치 미지정')}</span><span>${fmtDate(r.createdAt)} ${fmtTime(r.createdAt)}</span></div><div class="record-tags" style="margin-bottom:17px">${tagMarkup(r)}</div><label class="field-label" for="detailText">지적 내용 · 담당 업체를 함께 기록</label><textarea id="detailText" class="field" placeholder="음성 인식 내용을 확인하거나 필요한 부분만 수정하세요.">${esc(r.text)}</textarea><div id="audioArea"></div><div class="detail-bottom"><button class="secondary" id="photoDownload">${icon('download')}사진 저장</button><button class="primary" id="detailSave">수정 저장</button></div><div class="detail-bottom"><button class="danger-link" id="deleteRecord">이 기록 삭제</button></div><p class="small-note">현재 기록은 이 브라우저에만 저장됩니다. 브라우저 음성인식은 네트워크를 사용할 수 있습니다.</p>`;
    $('detailDialog').showModal();
    $('detailSave').onclick = async () => { r.text = $('detailText').value.trim().slice(0, 4000); r.transcriptionStatus = r.mode === 'demo' ? 'demo' : 'manual'; r.updatedAt = Date.now(); try {
        await put('records', r);
        renderRecords();
        $('detailDialog').close();
        toast('지적 내용을 수정했습니다.');
    }
    catch {
        toast('수정 내용을 저장하지 못했습니다.', true);
    } };
    $('photoDownload').onclick = () => downloadDataURL(r.photo, `현장노트_${r.number}.${r.photoFormat}`);
    $('deleteRecord').onclick = async () => { if (!confirm('이 사진 기록을 삭제할까요? 다른 사진과 점검 음성 원본은 유지됩니다.'))
        return; try {
        await del('records', r.id);
        state.records = state.records.filter(x => x.id !== r.id);
        $('detailDialog').close();
        renderRecords();
        toast('기록을 삭제했습니다.');
    }
    catch {
        toast('삭제하지 못했습니다.', true);
    } };
    if (r.mode === 'demo') {
        $('audioArea').innerHTML = '<p class="small-note">화면 체험 기록입니다. 실제 음성 원본은 없습니다.</p>';
        return;
    }
    if (state.active && state.session?.id === r.sessionId) {
        $('audioArea').innerHTML = '<div class="info-box" style="margin-top:14px">녹음은 점검 종료 후 재생할 수 있습니다. 이 사진의 촬영 시점은 ' + fmtClock(r.audioOffsetMs) + '입니다.</div>';
        return;
    }
    try {
        const blob = await sessionBlob(r.sessionId);
        if (state.detailId !== id || !$('detailDialog').open)
            return;
        if (!blob.size) {
            $('audioArea').innerHTML = '<p class="small-note">이 기록에 저장된 음성이 없습니다.</p>';
            return;
        }
        state.audioURL = URL.createObjectURL(blob);
        $('audioArea').innerHTML = `<h3>점검 음성 원본</h3><audio id="detailAudio" class="detail-audio" controls preload="metadata" src="${state.audioURL}"></audio><p class="small-note">사진 촬영 시점 ${fmtClock(r.audioOffsetMs)} · 촬영 4초 전부터 듣도록 설정합니다. 사진별 음성 자동 분리가 아닌 연속 녹음 원본입니다.</p>`;
        const a = $('detailAudio');
        a.onloadedmetadata = () => { try {
            a.currentTime = Math.max(0, r.audioOffsetMs / 1000 - 4);
        }
        catch { } };
        a.onerror = () => { $('audioArea').insertAdjacentHTML('beforeend', '<p class="small-note">브라우저에서 재생하지 못했습니다. 기록 백업으로 원본 파일을 보관하세요.</p>'); };
    }
    catch {
        if (state.detailId === id)
            $('audioArea').innerHTML = '<p class="small-note">음성 원본을 불러오지 못했습니다.</p>';
    }
}
function downloadBlob(blob, name) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 15000); }
function dataURLBytes(url) { const idx = url.indexOf(','); const hdr = url.slice(0, idx), data = url.slice(idx + 1); if (hdr.includes(';base64'))
    return Uint8Array.from(atob(data), c => c.charCodeAt(0)); return new TextEncoder().encode(decodeURIComponent(data)); }
function downloadDataURL(url, name) { downloadBlob(new Blob([dataURLBytes(url)], { type: url.slice(5, url.indexOf(';')) }), name); }
// Minimal ZIP (stored, UTF-8). Makes an offline backup without external libraries.
const crcTable = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++)
    n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
function crc32(a) { let c = 0xffffffff; for (const b of a)
    c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipBlob(files) { const parts = [], directory = []; let offset = 0; const encoder = new TextEncoder(); for (const f of files) {
    const name = encoder.encode(f.name), data = f.data;
    const crc = crc32(data), lh = new Uint8Array(30 + name.length), v = new DataView(lh.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x800, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, name.length, true);
    lh.set(name, 30);
    parts.push(lh, data);
    const ch = new Uint8Array(46 + name.length), w = new DataView(ch.buffer);
    w.setUint32(0, 0x02014b50, true);
    w.setUint16(4, 20, true);
    w.setUint16(6, 20, true);
    w.setUint16(8, 0x800, true);
    w.setUint32(16, crc, true);
    w.setUint32(20, data.length, true);
    w.setUint32(24, data.length, true);
    w.setUint16(28, name.length, true);
    w.setUint32(42, offset, true);
    ch.set(name, 46);
    directory.push(ch);
    offset += lh.length + data.length;
} const len = directory.reduce((n, a) => n + a.length, 0), end = new Uint8Array(22), e = new DataView(end.buffer); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, len, true); e.setUint32(16, offset, true); return new Blob([...parts, ...directory, end], { type: 'application/zip' }); }
async function exportRecords() {
    if (!state.records.length)
        return;
    if (state.active) {
        toast('점검을 종료한 뒤 백업하세요. 녹음 원본을 함께 보관합니다.');
        return;
    }
    $('exportBtn').disabled = true;
    $('exportBtn').innerHTML = icon('download') + '백업 만드는 중';
    try {
        const files = [], metadata = [], enc = new TextEncoder();
        for (const r of state.records) {
            const file = `photos/${r.id}.${r.photoFormat}`;
            files.push({ name: file, data: dataURLBytes(r.photo) });
            const { photo, ...rest } = r;
            metadata.push({ ...rest, photoFile: file });
        }
        const sessions = [];
        for (const s of state.sessions) {
            if (s.mode === 'demo') {
                sessions.push({ ...s, audioFile: null });
                continue;
            }
            const b = await sessionBlob(s.id);
            if (b.size) {
                const name = `audio/${s.id}.${(s.mime || '').includes('mp4') ? 'm4a' : 'webm'}`;
                files.push({ name, data: new Uint8Array(await b.arrayBuffer()) });
                sessions.push({ ...s, audioFile: name });
            }
            else
                sessions.push({ ...s, audioFile: null });
        }
        files.push({ name: 'records.json', data: enc.encode(JSON.stringify({ schemaVersion: 2, exportedAt: new Date().toISOString(), storage: 'local-browser-only', records: metadata, sessions }, null, 2)) });
        files.push({ name: '읽어주세요.txt', data: enc.encode('현장노트 Voice 백업\n\nphotos: 촬영 사진 또는 체험 예시 이미지\naudio: 점검별 연속 녹음 원본\nrecords.json: 위치, 음성 인식 지적 내용, 사진 파일명, 점검 ID와 음성 내 촬영 시점(audioOffsetMs)\n\n체험 기록은 실제 음성인식 결과가 아닙니다. 실제 기록의 음성 인식 문장은 브라우저 결과이므로 원본 녹음과 함께 확인하세요.\n이 ZIP은 현장노트 Voice의 기록 가져오기로 복원할 수 있습니다. 같은 ID의 기록은 덮어쓰지 않습니다.\n') });
        downloadBlob(zipBlob(files), `현장노트_백업_${new Date().toISOString().slice(0, 10)}.zip`);
        toast('사진·목록·녹음 원본 백업을 만들었습니다.');
    }
    catch (e) {
        toast('백업을 만들지 못했습니다. 저장 공간과 파일 크기를 확인하세요.', true);
        console.error(e);
    }
    finally {
        $('exportBtn').disabled = false;
        $('exportBtn').innerHTML = icon('download') + '기록 백업';
    }
}
