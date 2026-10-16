/* 현장노트 v2 · 개발 인수인계
 * 이벤트 연결과 앱 시작. 다른 JS 파일 이후 마지막에 로드합니다.
 * 원본 HTML의 인라인 스크립트 312–340행에서 분리했습니다.
 * classic script: 전역 이름과 로드 순서에 의존합니다. ESM 전환 시 별도 리팩터링이 필요합니다.
 */
'use strict';
function wireV2() {
    $('filterToggle').onclick = () => { const open = $('listFilterBlock').classList.toggle('open'); $('filterToggle').setAttribute('aria-expanded', String(open)); };
    $('analyticsTab').onclick = () => updateView('analytics');
    $('excelBtn').onclick = () => exportExcel(false);
    $('analyticsExcel').onclick = () => exportExcel(true);
    for (const id of ['filterUnit', 'filterPosition', 'filterTrade', 'filterFrom', 'filterTo'])
        $(id).onchange = renderRecords;
    $('resetFilters').onclick = () => resetListFilters();
    $('selectVisible').onchange = e => { for (const r of visibleRecords()) {
        if (e.target.checked)
            state.selected.add(r.id);
        else
            state.selected.delete(r.id);
    } renderListV2(); };
    $('clearSelection').onclick = () => { state.selected.clear(); renderListV2(); };
    function selectChanged(e) { const input = e.target.closest('[data-select]'); if (input) {
        if (input.checked)
            state.selected.add(input.dataset.select);
        else
            state.selected.delete(input.dataset.select);
        renderListV2();
    } }
    $('recordGrid').addEventListener('change', selectChanged);
    $('recordTableBody').addEventListener('change', selectChanged);
    $('recordTableBody').onclick = e => { const b = e.target.closest('[data-record]'); if (b)
        openDetail(b.dataset.record); };
    $('tableViewBtn').onclick = () => { state.listFormat = 'table'; renderListV2(); };
    $('cardViewBtn').onclick = () => { state.listFormat = 'cards'; renderListV2(); };
    $('analyticsLive').onclick = () => { state.analyticsMode = 'live'; $('analysisUnit').value = ''; renderAnalytics(); };
    $('analyticsDemo').onclick = () => { state.analyticsMode = 'demo'; $('analysisUnit').value = ''; renderAnalytics(); };
    for (const id of ['analysisUnit', 'analysisFrom', 'analysisTo'])
        $(id).onchange = renderAnalytics;
    $('analysisReset').onclick = () => { for (const id of ['analysisUnit', 'analysisFrom', 'analysisTo'])
        $(id).value = ''; renderAnalytics(); };
    $('seedListBtn').onclick = () => seedExamples('list');
    $('importBtn').onclick = () => { if (state.active) {
        toast('점검 종료 후 가져오세요.');
        return;
    } $('importInput').click(); };
    $('importInput').onchange = e => importBackup(e.target.files[0]);
    $('infoDialog').querySelector('.dialog-body').insertAdjacentHTML('beforeend', '<h3>사진 엑셀 · 집계</h3><p>내 등록에서 사진 포함 엑셀을 누르면 조회 중이거나 선택한 기록을 실제 .xlsx로 받습니다. 등록목록은 날짜·동호수·위치·공종·내용·비고·해당사진 순서이며 사진이 행별로 삽입됩니다. 집계 시트가 함께 들어갑니다.</p><p>분류는 음성으로 인식된 내용의 키워드를 사용합니다. 위치·공종·지적 유형·비고는 상세 화면에서 수정할 수 있습니다.</p><p>예측 영역은 화면 예시입니다. 발생률·위험 확률은 산출하지 않으며 사진 분석 모델과 여러 사용자용 클라우드는 아직 연결되어 있지 않습니다.</p><p>이전 초안의 ZIP 백업은 기록 가져오기로 합칠 수 있습니다. 같은 ID의 기록은 덮어쓰지 않습니다. 파일이나 브라우저를 바꿨을 때 기록이 안 보이면 이전 창에서 백업한 뒤 가져오세요.</p>');
}
hydrateIcons();
setScene();
$('infoBtn').onclick = () => { if (state.active && !state.paused)
    pauseSession(true); $('infoDialog').showModal(); };
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).close());
$('detailDialog').addEventListener('close', () => { const a = $('detailAudio'); if (a) {
    a.pause();
    a.removeAttribute('src');
    a.load();
} state.detailId = null; if (state.audioURL) {
    URL.revokeObjectURL(state.audioURL);
    state.audioURL = null;
} });
$('captureTab').onclick = () => updateView('capture');
$('listTab').onclick = () => updateView('list');
$('viewAll').onclick = () => updateView('list');
$('demoMode').onclick = () => setMode('demo');
$('liveMode').onclick = () => setMode('live');
$('startBtn').onclick = startSession;
$('shutter').onclick = capture;
$('pauseBtn').onclick = () => pauseSession();
$('speechBtn').onclick = toggleSpeechRecognition;
$('finishBtn').onclick = finishSession;
$('locationBtn').onclick = openLocation;
$('locationExample').onclick = () => applyLocation($('locationExample').dataset.next);
$('locationApply').onclick = () => applyLocation($('locationInput').value);
$('locationInput').onkeydown = e => { if (e.key === 'Enter')
    applyLocation(e.target.value); };
$('keepLocation').onchange = e => { state.keep = e.target.checked; saveSetting('keep', state.keep); toast(state.keep ? '다음 사진에도 현재 위치가 유지됩니다.' : '한 번 촬영하면 위치가 초기화됩니다.'); };
$('recentList').onclick = e => { const b = e.target.closest('[data-record]'); if (b)
    openDetail(b.dataset.record); };
$('recordGrid').onclick = e => { const b = e.target.closest('[data-record]'); if (b)
    openDetail(b.dataset.record); };
$('lastShortcut').onclick = () => { const r = [...state.records].reverse().find(r => r.sessionId === state.session?.id); if (r)
    openDetail(r.id);
else
    toast('아직 이번 점검에서 촬영한 사진이 없습니다.'); };
$('search').oninput = renderRecords;
document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { state.filter = b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('selected', x === b)); renderRecords(); });
$('exportBtn').onclick = exportRecords;
wireV2();
if ('serviceWorker' in navigator)
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { }));
window.addEventListener('beforeunload', e => { if (state.active && state.mode === 'live') {
    e.preventDefault();
    e.returnValue = '';
} });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.active && !state.paused && state.mode === 'live') {
    pauseSession(true);
    alertBox('다른 앱·탭으로 이동해 녹음을 일시정지했습니다. 화면을 켠 상태에서 이어하기를 눌러주세요.');
} });
window.addEventListener('pagehide', () => { stopSpeechRecognition(true); state.stream?.getTracks().forEach(t => t.stop()); });
(async () => { try {
    state.db = await openDB();
    state.records = await getAll('records');
    state.sessions = await getAll('sessions');
    for (const s of state.sessions) {
        if (s.status === 'recording') {
            s.status = 'interrupted';
            await put('sessions', s);
        }
    }
    state.demoLocation = readSetting('demoLocation', '');
    state.liveLocation = readSetting('liveLocation', '');
    state.keep = readSetting('keep', true);
    setMode('demo');
    renderRecords();
}
catch (e) {
    alertBox('이 환경에서는 브라우저 저장소에 접근할 수 없습니다. Chrome 또는 Edge에서 파일을 열어주세요. ' + e.message);
    $('startBtn').disabled = true;
    renderRecords();
} })();
