/* 현장노트 v2 · 개발 인수인계
 * 실제/체험 분리 집계, 반복 지적 요약, 체험 데이터 36건
 * 원본 HTML의 인라인 스크립트 202–245행에서 분리했습니다.
 * classic script: 전역 이름과 로드 순서에 의존합니다. ESM 전환 시 별도 리팩터링이 필요합니다.
 */
'use strict';
function countBy(rs, getter) { const m = new Map(); for (const r of rs) {
    const k = getter(r) || '미분류';
    m.set(k, (m.get(k) || 0) + 1);
} return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko', { numeric: true })); }
function modeAnalyticsRecords() { return state.records.filter(r => r.mode === state.analyticsMode); }
function analysisRecords() { const u = $('analysisUnit').value, from = $('analysisFrom').value, to = $('analysisTo').value; return modeAnalyticsRecords().filter(r => { const day = dayKey(r.createdAt); return (!u || classifyRecord(r).unit === u) && (!from || day >= from) && (!to || day <= to); }); }
function renderBars(id, arr, total, maxItems = 6) { const max = arr[0]?.count || 1; $(id).innerHTML = arr.length ? arr.slice(0, maxItems).map((v, i) => `<div class="bar-row"><div class="bar-label" title="${esc(v.name)}"><small>${String(i + 1).padStart(2, '0')}</small>${esc(v.name)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, v.count / max * 100)}%"></div></div><div class="bar-num">${v.count}<small>${total ? Math.round(v.count / total * 100) : 0}%</small></div></div>`).join('') : '<div class="analytics-empty-inline">분류 가능한 기록이 없습니다.</div>'; }
function renderAnalytics() {
    const base = modeAnalyticsRecords();
    setOptions('analysisUnit', base.map(r => classifyRecord(r).unit), '전체 동호수');
    const rs = analysisRecords(), n = rs.length, demo = state.analyticsMode === 'demo';
    $('analyticsLive').classList.toggle('active', !demo);
    $('analyticsDemo').classList.toggle('active', demo);
    $('analysisBanner').classList.toggle('is-demo', demo);
    $('analysisBanner').innerHTML = `<span><b>${demo ? '체험 기록만 집계' : '실제 촬영 기록만 집계'}</b> · 조회 ${n}건 / ${demo ? '체험' : '실제'} 전체 ${base.length}건${demo ? ' · 예시 문장과 예시 이미지, 실제 현장 자료 아님' : ' · 체험 자료 제외'}</span><button class="text-button" id="seedAnalysisBtn">예시 36건으로 기능 체험</button>`;
    $('seedAnalysisBtn').onclick = () => seedExamples('analytics');
    $('analysisEmpty').classList.toggle('hidden', n > 0);
    $('analysisContent').classList.toggle('hidden', !n);
    $('analyticsExcel').disabled = !n || state.exporting;
    if (!n) {
        $('analysisEmpty').innerHTML = icon('chart') + `<h3>${base.length ? '이 조건에 맞는 기록이 없습니다.' : demo ? '체험 기록이 아직 없습니다.' : '실제 등록 데이터가 아직 없습니다.'}</h3><p>${base.length ? '동호수 또는 날짜 필터를 바꿔보세요.' : '현재는 집계할 데이터가 없어 통계와 발생 가능성을 계산하지 않습니다.<br>예시 데이터로 엑셀·집계 화면을 먼저 확인할 수 있습니다.'}</p><button class="secondary" id="seedEmptyBtn">예시 36건으로 둘러보기</button>`;
        $('seedEmptyBtn').onclick = () => seedExamples('analytics');
    }
    const positions = countBy(rs, r => classifyRecord(r).position), trades = countBy(rs, r => classifyRecord(r).trade), types = countBy(rs, r => classifyRecord(r).defectType), units = countBy(rs, r => classifyRecord(r).unit);
    const knownPosition = positions.filter(x => x.name !== '미분류'), tops = knownPosition.length ? knownPosition.filter(x => x.count === knownPosition[0].count) : [], top = tops[0], unitCount = units.filter(x => x.name !== '미지정').length, unknown = rs.filter(r => { const c = classifyRecord(r); return c.position === '미분류' || c.trade === '미분류' || c.unit === '미지정'; }).length, unreviewed = rs.filter(r => !classifyRecord(r).reviewed).length;
    $('kpiGrid').innerHTML = `<div class="kpi"><div class="kpi-label">${icon('grid')}등록된 지적</div><div class="kpi-value">${n}<small>건</small></div><div class="kpi-sub">조회 범위 · ${demo ? '체험' : '실제'} 기록만</div></div><div class="kpi"><div class="kpi-label">${icon('pin')}기록이 있는 동호수</div><div class="kpi-value">${unitCount}<small>개</small></div><div class="kpi-sub">전체 점검 세대 수와 다릅니다.</div></div><div class="kpi featured"><div class="kpi-label">등록 최다 위치${tops.length > 1 ? ' · 공동' : ''}</div><div class="kpi-value">${top ? esc(top.name) + (tops.length > 1 ? ` 외 ${tops.length - 1}곳` : '') : '분류 전'}</div><div class="kpi-sub">${top ? `${top.count}건 · 조회 기록의 ${Math.round(top.count / n * 100)}%` : '위치 분류 후 표시'}</div></div><div class="kpi"><div class="kpi-label">${icon('info')}미분류·위치 미지정</div><div class="kpi-value">${unknown}<small>건</small></div><div class="kpi-sub">자동 분류 확인 전 ${unreviewed}건</div></div>`;
    renderBars('positionBars', positions, n);
    renderBars('tradeBars', trades, n);
    renderBars('typeBars', types, n);
    renderBars('unitBars', units, n, 5);
    const rp = positions.slice(0, 5), ct = trades.slice(0, 5), cross = new Map();
    for (const r of rs) {
        const c = classifyRecord(r), k = JSON.stringify([c.position, c.trade]);
        cross.set(k, (cross.get(k) || 0) + 1);
    }
    const maxCross = Math.max(1, ...cross.values());
    $('heatMap').innerHTML = n ? `<table class="heat-table"><thead><tr><th>위치 / 공종</th>${ct.map(x => `<th>${esc(x.name)}</th>`).join('')}</tr></thead><tbody>${rp.map(p => `<tr><th>${esc(p.name)}</th>${ct.map(t => { const v = cross.get(JSON.stringify([p.name, t.name])) || 0; return `<td class="h${v ? Math.max(1, Math.ceil(v / maxCross * 4)) : 0}" title="${esc(p.name + ' · ' + t.name)} ${v}건">${v || '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>` : '';
    let end = $('analysisTo').value || (rs.length ? dayKey(Math.max(...rs.map(r => r.createdAt))) : dayKey(Date.now()));
    let endUTC = Date.parse(end + 'T00:00:00Z'), days = Array.from({ length: 7 }, (_, i) => new Date(endUTC - (6 - i) * 864e5).toISOString().slice(0, 10));
    const byDate = new Map(countBy(rs, r => dayKey(r.createdAt)).map(v => [v.name, v.count])), mx = Math.max(1, ...days.map(d => byDate.get(d) || 0));
    $('trendPeriod').textContent = `${days[0]} ~ ${days[6]} · 조회 범위 내 기록`;
    $('trendBars').innerHTML = days.map(d => { const v = byDate.get(d) || 0; return `<div class="frequency-day"><div class="frequency-num">${v}</div><div class="frequency-bar" style="height:${v ? Math.max(4, v / mx * 82) : 2}px"></div><div class="frequency-label">${d.slice(5).replace('-', '/')}</div></div>`; }).join('');
    renderInsights(rs);
    hydrateIcons($('analyticsView'));
}
function renderInsights(rs) {
    const m = new Map();
    for (const r of rs) {
        const c = classifyRecord(r);
        if ([c.position, c.trade, c.defectType].includes('미분류'))
            continue;
        const key = JSON.stringify([c.position, c.trade, c.defectType]);
        let group = m.get(key);
        if (!group) {
            group = { ...c, count: 0, units: new Set() };
            m.set(key, group);
        }
        group.count++;
        if (c.unit !== '미지정')
            group.units.add(c.unit);
    }
    const groups = [...m.values()].filter(g => g.count >= 3).sort((a, b) => b.count - a.count || a.position.localeCompare(b.position, 'ko')).slice(0, 3);
    $('ruleInsights').innerHTML = groups.length ? groups.map(g => `<div class="insight-item"><b>${esc(g.position)} · ${esc(g.trade)} · ${esc(g.defectType)}</b><p>조회 기록에서 같은 조합이 <b style="display:inline;font-size:inherit">${g.count}건</b> 등록됐습니다.${g.units.size ? ' 기록이 있는 동호수는 ' + g.units.size + '개입니다.' : ''} 다음 동일 공정 점검에서 우선 확인할 후보입니다.</p><span>${state.analyticsMode === 'demo' ? '체험 데이터' : '등록 데이터'} 근거 · 규칙 기반</span></div>`).join('') : `<div class="insight-item"><b>반복 요약을 만들 근거가 부족합니다.</b><p>같은 위치·공종·유형으로 분류된 기록이 3건 이상 쌓이면 반복 조합을 보여줍니다. 데이터가 없을 때 위험도나 예측 결과를 만들지 않습니다.</p></div>`;
}
function makeDemoRows() {
    const specs = [
        ['욕실', '바닥 타일 단차, ○○타일 확인.', 2, 8], ['욕실', '벽 타일 들뜸, ○○타일 보수.', 2, 4],
        ['거실', '창호 하부 코킹 누락, ○○창호 보수.', 0, 5], ['거실', '벽지 들뜸, ○○도배 보수.', 1, 3],
        ['주방', '걸레받이 미시공, ○○가구 확인.', 3, 4], ['주방', '싱크대 문짝 찍힘, ○○가구 보수.', 3, 2],
        ['안방', '문선 찍힘, ○○내장 보수.', 1, 3], ['안방', '벽지 들뜸, ○○도배 보수.', 1, 2],
        ['현관', '몰딩 이음부 틈새, ○○내장 보수.', 0, 3], ['작은방', '콘센트 미설치, ○○전기 확인.', 1, 2]
    ];
    const units = ['101동 1203호', '101동 1204호', '101동 1303호', '102동 803호', '102동 804호', '102동 903호'];
    let idx = 0;
    const now = Date.now(), sid = 'analysis-demo-v2';
    const rows = [];
    for (const [pos, desc, scene, n] of specs)
        for (let k = 0; k < n; k++) {
            idx++;
            const day = (idx * 3 + k) % 7;
            rows.push({ id: `demo-v2-${String(idx).padStart(3, '0')}`, sessionId: sid, number: idx, mode: 'demo', createdAt: now - day * 864e5 - idx * 6e4, location: units[(idx - 1) % units.length], text: pos + ' ' + desc, photo: sceneData(scene), photoFormat: 'svg', audioOffsetMs: 0, transcriptionStatus: 'demo', cloudStatus: 'not_connected', demoSource: 'analysis-demo-v2', note: '' });
        }
    return rows;
}
async function seedExamples(destination = 'analytics') {
    if (!state.db) {
        toast('저장소를 사용할 수 없습니다.', true);
        return;
    }
    if (state.active && !state.paused)
        pauseSession(true);
    try {
        const examples = makeDemoRows(), existing = new Set(state.records.map(r => r.id));
        const add = examples.filter(r => !existing.has(r.id));
        if (add.length) {
            await new Promise((resolve, reject) => { const tx = state.db.transaction(['records', 'sessions'], 'readwrite'); for (const r of add)
                tx.objectStore('records').put(r); tx.objectStore('sessions').put({ id: 'analysis-demo-v2', mode: 'demo', status: 'finished', startedAt: Date.now(), endedAt: Date.now(), mime: '', demoSource: 'analysis-demo-v2' }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
            state.records.push(...add);
            if (!state.sessions.some(x => x.id === 'analysis-demo-v2'))
                state.sessions.push({ id: 'analysis-demo-v2', mode: 'demo', status: 'finished' });
        }
        state.analyticsMode = 'demo';
        state.filter = 'demo';
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('selected', b.dataset.filter === 'demo'));
        resetListFilters(false);
        $('analysisUnit').value = '';
        $('analysisFrom').value = '';
        $('analysisTo').value = '';
        renderRecords();
        updateView(destination);
        toast(add.length ? `체험 기록 ${add.length}건을 추가했습니다. 실제 기록과 분리됩니다.` : '이미 추가된 체험 기록을 보여줍니다.');
    }
    catch (e) {
        console.error(e);
        toast('체험 데이터를 저장하지 못했습니다.', true);
    }
}
function resetListFilters(rerender = true) { for (const id of ['search', 'filterUnit', 'filterPosition', 'filterTrade', 'filterFrom', 'filterTo'])
    $(id).value = ''; if (rerender)
    renderRecords(); }
