/* 현장노트 v2 · 개발 인수인계
 * v2 화면 상태, 키워드 분류, 목록·선택·필터·상세 편집
 * 원본 HTML의 인라인 스크립트 140–201행에서 분리했습니다.
 * classic script: 전역 이름과 로드 순서에 의존합니다. ESM 전환 시 별도 리팩터링이 필요합니다.
 */
'use strict';
/* DRAFT 02. No remote dependencies, analytics or external API requests.
   Excel styles/template generated with artifact_tool; variable rows and image parts
   are serialized locally as OOXML, using the existing offline ZIP writer. */
Object.assign(icons, { chart: '<path d="M4 3v18h17M8 16v-5M13 16V7M18 16V4"/>', sheet: '<path d="M14 2H5v20h14V7Z M14 2v5h5M8 11h8M8 15h8M8 19h8M11 11v8"/>', upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>' });
Object.assign(state, { selected: new Set(), listFormat: matchMedia('(max-width:600px)').matches ? 'cards' : 'table', calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1), exporting: false, importing: false });
const POSITION_RULES = [['공용욕실', /공용\s*욕실|거실\s*욕실/], ['안방욕실', /안방\s*욕실|부부\s*욕실/], ['욕실', /욕실|화장실/], ['거실', /거실/], ['안방', /안방/], ['작은방', /작은\s*방/], ['침실', /침실/], ['주방', /주방|부엌/], ['현관', /현관/], ['발코니', /발코니|베란다/], ['다용도실', /다용도실|세탁실/], ['드레스룸', /드레스\s*룸/], ['복도', /복도/], ['계단실', /계단실/], ['지하주차장', /지하\s*주차장/]];
const TRADE_RULES = [['타일', /타일|줄눈|메지/], ['도배', /도배|벽지/], ['창호', /창호|창틀|창짝|방충망|유리/], ['내장', /문선|몰딩|내장|걸레받이|문틀|문짝/], ['가구', /가구|싱크대|붙박이|수납장|주방\s*걸레받이/], ['방수', /방수/], ['도장', /도장|도색|페인트|퍼티/], ['전기', /전기|콘센트|스위치|조명|배선/], ['설비', /설비|배관|수전|배수|환기구|위생도기/], ['골조', /골조|철근|거푸집|알폼|갱폼|콘크리트|동바리/], ['실란트', /코킹|실리콘|실란트/]];
const TYPE_RULES = [['단차', /단차/], ['들뜸', /들뜸|들뜬/], ['누락·미시공', /누락|미시공|미설치|미충진|미충전/], ['찍힘·파손', /찍힘|파손|깨짐|찍힌/], ['균열', /균열|크랙/], ['틈새', /틈새|벌어짐|이격/], ['누수', /누수|물이\s*샘/], ['오염', /오염|얼룩/], ['수직·수평', /수직|수평/], ['작동 불량', /작동\s*불량|개폐\s*불량|고장/]];
function dayKey(t) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)); }
function uniqueSorted(a) { return [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y, 'ko', { numeric: true })); }
function automaticClassification(r) {
    const text = String(r.text || '').replace(/\s+/g, ' ').trim();
    let stored = String(r.location || '').trim(), unit = '', position = '미분류';
    const unitMatch = stored.match(/\d+\s*동\s*\d+\s*호/);
    const unitVoice = text.match(/\d+\s*동\s*\d+\s*호/);
    if (unitMatch)
        unit = unitMatch[0].replace(/\s*동\s*/, '동 ').replace(/\s*호/, '호');
    else if (unitVoice)
        unit = unitVoice[0].replace(/\s*동\s*/, '동 ').replace(/\s*호/, '호');
    else if (r.buildingMode === 'general' && stored)
        unit = stored;
    else if (/\d+\s*동|\d+\s*호/.test(stored))
        unit = stored;
    // Specialist room variants absorb generic 욕실 instead of counting twice.
    const positions = POSITION_RULES.filter(([n, re]) => re.test(text)).map(([n]) => n);
    if (positions.includes('공용욕실') || positions.includes('안방욕실')) {
        const extra = positions.filter(n => !['공용욕실', '안방욕실', '욕실', '거실', '안방'].includes(n));
        position = extra.length ? '미분류' : positions.includes('공용욕실') && positions.includes('안방욕실') ? '미분류' : positions[0];
    }
    else if (positions.length === 1)
        position = positions[0];
    else if (!positions.length) {
        const p = POSITION_RULES.find(([n, re]) => re.test(stored.replace(unit, '')));
        if (p)
            position = p[0];
        else if (stored && !unit)
            position = stored;
    }
    // The contractor name remains in the original text, never a required field.
    const trades = TRADE_RULES.filter(([n, re]) => re.test(text)).map(([n]) => n);
    let effective = trades.filter(n => !(n === '실란트' && trades.includes('창호')) && !(n === '내장' && trades.includes('가구')));
    const trade = effective.length === 1 ? effective[0] : '미분류';
    const types = TYPE_RULES.filter(([n, re]) => re.test(text)).map(([n]) => n);
    const type = types.length === 1 ? types[0] : '미분류';
    return { unit: unit || '미지정', position, trade, defectType: type };
}
function classifyRecord(r) { const a = automaticClassification(r); return { ...a, unit: r.unitOverride || a.unit, position: r.positionOverride || a.position, trade: r.tradeOverride || a.trade, defectType: r.typeOverride || a.defectType, note: r.note || '', reviewed: !!r.classificationReviewed }; }
function recordNote(r, { exported = false } = {}) { const c = classifyRecord(r); const flags = []; if (c.note)
    flags.push(c.note); if (!r.text)
    flags.push('음성 확인 필요'); if (!c.reviewed)
    flags.push('자동 분류 · 확인 전'); if (c.unit === '미지정')
    flags.push('위치 정보 미지정'); return flags.join(' / '); }
function setOptions(id, values, empty) { const el = $(id), old = el.value; el.innerHTML = `<option value="">${esc(empty)}</option>` + uniqueSorted(values).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join(''); if ([...el.options].some(x => x.value === old))
    el.value = old; }
function modeMatches(r) { return r.mode !== 'demo' && (state.filter === 'all' || state.filter === 'pending' && !r.text); }
function visibleRecords() { const query = $('search').value.trim().toLowerCase(), u = $('filterUnit').value, p = $('filterPosition').value, t = $('filterTrade').value, from = $('filterFrom').value, to = $('filterTo').value; return [...state.records].filter(r => { if (!modeMatches(r))
    return false; const c = classifyRecord(r), day = dayKey(r.createdAt); return (!u || c.unit === u) && (!p || c.position === p) && (!t || c.trade === t) && (!from || day >= from) && (!to || day <= to) && `${c.unit} ${c.position} ${c.trade} ${c.note} ${r.text || ''}`.toLowerCase().includes(query); }).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)); }
function selectedRecords() { const rs = visibleRecords(), selected = rs.filter(r => state.selected.has(r.id)); return selected.length ? selected : rs; }
function calendarCells(year, month) { const first = new Date(year, month, 1), start = new Date(year, month, 1 - first.getDay()); return Array.from({ length: 42 }, (_, i) => { const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i); return { year: date.getFullYear(), month: date.getMonth(), date: date.getDate(), key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, current: date.getMonth() === month }; }); }
function renderCalendar(rs) { const month = state.calendarMonth, year = month.getFullYear(), index = month.getMonth(), groups = new Map(); for (const r of rs) { const key = dayKey(r.createdAt); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); } $('calendarTitle').textContent = `${year}년 ${index + 1}월`; const today = dayKey(Date.now()); $('calendarGrid').innerHTML = calendarCells(year, index).map(day => { const items = groups.get(day.key) || []; return `<section class="calendar-day ${day.current ? '' : 'outside'} ${day.key === today ? 'today' : ''}" aria-label="${day.key} ${items.length}건"><div class="calendar-date"><b>${day.date}</b>${items.length ? `<span>${items.length}건</span>` : ''}</div><div class="calendar-items">${items.slice(0, 3).map(r => { const c = classifyRecord(r); return `<button data-record="${esc(r.id)}" title="${esc(c.unit + ' ' + recordDescription(r))}"><img loading="lazy" src="${esc(r.photo)}" alt="${esc(c.unit)} 촬영 사진"><span>${esc(c.unit)}</span></button>`; }).join('')}${items.length > 3 ? `<small>+${items.length - 3}건 더보기</small>` : ''}</div></section>`; }).join(''); }
function renderRecords() { renderRecordsCore(); renderListV2(); if (state.view === 'analytics')
    renderAnalytics(); }
function renderListV2() {
    const ids = new Set(actualRecords().map(r => r.id));
    for (const id of state.selected)
        if (!ids.has(id))
            state.selected.delete(id);
    const base = actualRecords().filter(modeMatches), classes = base.map(classifyRecord);
    setOptions('filterUnit', classes.map(c => c.unit), '전체 위치 정보');
    setOptions('filterPosition', classes.map(c => c.position), '전체 위치');
    setOptions('filterTrade', classes.map(c => c.trade), '전체 공종');
    const filterCount = ['filterUnit', 'filterPosition', 'filterTrade', 'filterFrom', 'filterTo'].filter(id => $(id).value).length;
    $('filterBadge').textContent = filterCount ? '적용 ' + filterCount + '개' : '';
    const rs = visibleRecords(), n = rs.filter(r => state.selected.has(r.id)).length;
    $('visibleCount').textContent = rs.length;
    $('selectedLabel').textContent = `선택 ${n}건`;
    $('selectVisible').checked = rs.length > 0 && n === rs.length;
    $('selectVisible').indeterminate = n > 0 && n < rs.length;
    $('selectVisible').disabled = !rs.length;
    $('clearSelection').classList.toggle('hidden', !state.selected.size);
    $('excelBtn').disabled = !rs.length || state.exporting;
    $('templateExcelBtn').disabled = !rs.length || state.exporting;
    $('excelBtn').innerHTML = icon('sheet') + `하자목록 내보내기${rs.length ? ' · ' + (n || rs.length) + '건' : ''}`;
    $('templateExcelBtn').innerHTML = icon('sheet') + `사진대지 내보내기${rs.length ? ' · ' + (n || rs.length) + '건' : ''}`;
    $('tableViewBtn').classList.toggle('active', state.listFormat === 'table');
    $('cardViewBtn').classList.toggle('active', state.listFormat === 'cards');
    $('calendarViewBtn').classList.toggle('active', state.listFormat === 'calendar');
    $('recordTableWrap').classList.toggle('hidden', state.listFormat !== 'table');
    $('recordGrid').classList.toggle('hidden', state.listFormat !== 'cards');
    $('calendarView').classList.toggle('hidden', state.listFormat !== 'calendar');
    $('recordTableBody').innerHTML = rs.length ? rs.map(r => { const c = classifyRecord(r), picked = state.selected.has(r.id); return `<tr class="${picked ? 'selected-row' : ''}"><td><input class="row-select" type="checkbox" data-select="${esc(r.id)}" aria-label="${esc(c.unit + ' ' + (r.text || '사진'))} 선택" ${picked ? 'checked' : ''}></td><td class="date-col">${dayKey(r.createdAt)}<br>${fmtTime(r.createdAt)}</td><td class="unit-col"><button class="cell-link" data-record="${esc(r.id)}">${esc(c.unit)}</button></td><td class="position-col">${classChip(c.position)}</td><td class="trade-col">${classChip(c.trade)}${!c.reviewed ? '<span class="auto-note">자동 분류</span>' : ''}</td><td class="content-col"><button class="cell-link" data-record="${esc(r.id)}">${esc(recordDescription(r))}</button></td><td class="note-col">${esc(recordNote(r) || '—')}</td><td><button class="table-photo" data-record="${esc(r.id)}" aria-label="${esc(c.unit)} 사진 및 분류 수정"><img loading="lazy" src="${esc(r.photo)}" alt="촬영 사진"></button></td></tr>`; }).join('') : '<tr><td colspan="8"><div class="analytics-empty-inline">조회되는 기록이 없습니다. 필터를 바꾸거나 현장 등록에서 촬영하세요.</div></td></tr>';
    $('recordGrid').innerHTML = rs.length ? rs.map(r => { const c = classifyRecord(r), picked = state.selected.has(r.id); return `<article class="grid-card ${picked ? 'selected-row' : ''}"><label class="card-pick"><input class="row-select" type="checkbox" data-select="${esc(r.id)}" aria-label="${esc(c.unit)} 기록 선택" ${picked ? 'checked' : ''}></label><button class="card-open" data-record="${esc(r.id)}"><div class="photo"><img loading="lazy" src="${esc(r.photo)}" alt="촬영 사진"><span class="photo-index">촬영</span></div><div class="grid-body"><div class="grid-loc">${esc(c.unit)}</div><div class="card-classification">${classChip(c.position)}${classChip(c.trade)}</div><p class="grid-desc">${esc(recordDescription(r))}</p><div class="grid-bottom"><span>${dayKey(r.createdAt)} ${fmtTime(r.createdAt)}</span><span class="auto-note">${c.reviewed ? '분류 확인됨' : '자동 분류 · 확인 전'}</span></div></div></button></article>`; }).join('') : '<div class="data-empty">' + icon('image') + '<h3>조회되는 기록이 없습니다.</h3><p>현장 등록에서 촬영하면<br>사진과 음성 인식 내용이 여기에 쌓입니다.</p></div>';
    renderCalendar(rs);
    const hiddenSelected = state.selected.size - n;
    $('listFootnote').textContent = (hiddenSelected ? `현재 필터 밖 선택 ${hiddenSelected}건은 내보내기에서 제외됩니다. ` : '') + '사진대지: 날짜 / 동호수·층실 / 세부 위치 / 공종 / 내용 / 비고 / 해당사진';
}
function classChip(text) { return `<span class="class-chip ${text === '미분류' || text === '미지정' ? 'unknown' : ''}">${esc(text)}</span>`; }
function updateView(view) { state.view = view; for (const v of ['capture', 'list', 'analytics']) {
    $(v + 'View').classList.toggle('hidden', v !== view);
    $(v + 'Tab').classList.toggle('active', v === view);
} if (view !== 'capture' && state.active && !state.paused) {
    pauseSession(true);
    toast('기록을 확인하는 동안 녹음을 일시정지합니다.');
} if (view === 'list')
    renderListV2(); if (view === 'analytics')
    renderAnalytics(); }
async function openDetail(id) {
    // Start loading the original detail/audio UI immediately. Metadata fields do not add capture steps.
    const pending = openDetailBase(id);
    const r = state.records.find(x => x.id === id);
    if (!r)
        return;
    const c = classifyRecord(r);
    $('detailText').insertAdjacentHTML('afterend', `<div class="detail-fields"><h3>엑셀·집계용 분류</h3><p>자동 분류는 키워드 기반 초안입니다. 수정은 여기서만, 현장 촬영 때는 입력하지 않아도 됩니다.</p><div class="detail-fields-grid"><div><label for="detailUnit">동호수 / 층·실명</label><input class="field" id="detailUnit" maxlength="80" value="${esc(c.unit === '미지정' ? '' : c.unit)}" placeholder="예: 101동 1203호 또는 3층 회의실"></div><div><label for="detailPosition">세부 위치</label><input class="field" id="detailPosition" maxlength="80" list="positionOptions" value="${esc(c.position)}"></div><div><label for="detailTrade">공종</label><input class="field" id="detailTrade" maxlength="80" list="tradeOptions" value="${esc(c.trade)}"></div><div><label for="detailType">지적 유형 · 집계용</label><input class="field" id="detailType" maxlength="80" list="typeOptions" value="${esc(c.defectType)}"></div><div class="full"><label for="detailNote">비고</label><input class="field" id="detailNote" maxlength="1000" placeholder="필요한 추가 메모만" value="${esc(c.note)}"></div></div><button class="text-button" id="reclassify">수정한 내용으로 다시 자동 분류</button><datalist id="positionOptions">${POSITION_RULES.map(([n]) => `<option value="${esc(n)}">`).join('')}</datalist><datalist id="tradeOptions">${TRADE_RULES.map(([n]) => `<option value="${esc(n)}">`).join('')}</datalist><datalist id="typeOptions">${TYPE_RULES.map(([n]) => `<option value="${esc(n)}">`).join('')}</datalist></div>`);
    $('reclassify').onclick = () => { const a = automaticClassification({ ...r, text: $('detailText').value }); $('detailPosition').value = a.position; $('detailTrade').value = a.trade; $('detailType').value = a.defectType; toast('내용의 키워드로 다시 분류했습니다. 확인 후 저장하세요.'); };
    $('detailSave').onclick = async () => { const next = { ...r, text: $('detailText').value.trim().slice(0, 4000), unitOverride: $('detailUnit').value.trim().slice(0, 80) || '미지정', positionOverride: $('detailPosition').value.trim().slice(0, 80) || '미분류', tradeOverride: $('detailTrade').value.trim().slice(0, 80) || '미분류', typeOverride: $('detailType').value.trim().slice(0, 80) || '미분류', note: $('detailNote').value.trim().slice(0, 1000), classificationReviewed: true, transcriptionStatus: 'manual', updatedAt: Date.now() }; try {
        await put('records', next);
        state.records = state.records.map(x => x.id === id ? next : x);
        renderRecords();
        $('detailDialog').close();
        toast('내용과 분류를 저장했습니다. 엑셀·집계에 반영됩니다.');
    }
    catch (e) {
        toast('수정 내용을 저장하지 못했습니다.', true);
    } };
    await pending;
}
