/* 현장노트 v2 · 개발 인수인계
 * OOXML 기반 사진 포함 XLSX 생성. 외부 엑셀 라이브러리를 사용하지 않습니다.
 * 원본 HTML의 인라인 스크립트 246–294행에서 분리했습니다.
 * classic script: 전역 이름과 로드 순서에 의존합니다. ESM 전환 시 별도 리팩터링이 필요합니다.
 */
'use strict';
// ---------- Workbook export (real .xlsx, with embedded photographs) ----------
const XML_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
function xml(v) { return esc(String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')); }
function textCell(ref, value, style = 4) { return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value ?? '').slice(0, 32767))}</t></is></c>`; }
function numCell(ref, value, style = 4) { return `<c r="${ref}" s="${style}"><v>${Number.isFinite(value) ? value : 0}</v></c>`; }
function formulaCell(ref, formula, cached, style = 4) { return `<c r="${ref}" s="${style}"><f>${xml(formula)}</f><v>${Number.isFinite(cached) ? cached : 0}</v></c>`; }
function rowXML(r, cells, height = 24) { return `<row r="${r}" ht="${height}" customHeight="1">${cells}</row>`; }
function excelDate(ms) { return (Date.parse(dayKey(ms) + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 864e5; }
function sheetXML(data, { lastRow, cols, merges = [], freeze = 4, filter = '', drawing = false, extra = '', landscape = true } = {}) { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${XML_NS}" xmlns:r="${REL_NS}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:G${lastRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${freeze + 1}" sqref="A${freeze + 1}"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${data}</sheetData>${filter ? `<autoFilter ref="${filter}"/>` : ''}${merges.length ? `<mergeCells count="${merges.length}">${merges.map(r => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>` : ''}${extra}<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="${landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;L현장노트 · 등록목록&amp;R&amp;P / &amp;N</oddFooter></headerFooter>${drawing ? '<drawing r:id="rIdImages"/>' : ''}</worksheet>`; }
function imageForExcel(url) { return new Promise((resolve, reject) => { const img = new Image(), timer = setTimeout(() => reject(new Error('사진 변환 시간 초과')), 15000); img.onload = () => { clearTimeout(timer); try {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h)
        throw new Error('사진 크기 확인 불가');
    const scale = Math.min(1, 800 / w, 800 / h), canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const bytes = dataURLBytes(canvas.toDataURL('image/jpeg', .83));
    const fit = Math.min(250 / w, 144 / h);
    resolve({ bytes, width: Math.round(w * fit), height: Math.round(h * fit) });
}
catch (e) {
    reject(e);
} }; img.onerror = () => { clearTimeout(timer); reject(new Error('사진을 읽지 못했습니다. 기록 상세에서 확인하세요.')); }; img.src = url; }); }
function imageAnchor(index, row, image, description) { const x = Math.round((271 - image.width) / 2), y = Math.round((160 - image.height) / 2), emu = v => Math.round(v * 9525), mark = (tag, dx, dy) => `<xdr:${tag}><xdr:col>6</xdr:col><xdr:colOff>${emu(dx)}</xdr:colOff><xdr:row>${row - 1}</xdr:row><xdr:rowOff>${emu(dy)}</xdr:rowOff></xdr:${tag}>`; return `<xdr:twoCellAnchor editAs="twoCell">${mark('from', x, y)}${mark('to', x + image.width, y + image.height)}<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${index}" name="현장사진 ${index}" descr="${xml(description)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${index}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(image.width)}" cy="${emu(image.height)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`; }
function showExportProgress(msg) { let e = $('excelProgress'); if (!e) {
    e = document.createElement('div');
    e.id = 'excelProgress';
    e.className = 'excel-progress';
    e.setAttribute('role', 'status');
    e.setAttribute('aria-live', 'polite');
    document.body.appendChild(e);
} e.textContent = msg; }
function sourceLabel(rs) { const demo = rs.filter(r => r.mode === 'demo').length; return demo === rs.length ? '체험 예시 · 실제 현장 아님' : demo ? '실제·체험 혼합 (비고의 체험 표시 확인)' : '실제 촬영 기록'; }
function literalCriterion(ref) { return `SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${ref},"~","~~"),"*","~*"),"?","~?")`; }
function makeSummarySheet(rs, scope) {
    const map = XLSX_TEMPLATE.styles['xl/worksheets/sheet2.xml'], end = rs.length + 4, n = rs.length;
    const ps = countBy(rs, r => classifyRecord(r).position), ts = countBy(rs, r => classifyRecord(r).trade), us = countBy(rs, r => classifyRecord(r).unit), rows = [];
    rows.push(rowXML(1, textCell('A1', '현장노트 · 등록 데이터 집계', map.A1), 38));
    rows.push(rowXML(2, textCell('A2', `${scope} · ${sourceLabel(rs)} · 등록 건수이며 발생률·AI 예측 아님`, map.A2), 35));
    rows.push(rowXML(4, textCell('A4', '등록 건수', map.A4) + formulaCell('B4', `COUNTA('등록목록'!$A$5:$A$${end})`, n, map.B4) + textCell('E4', '실제 / 체험', map.A4) + numCell('F4', rs.filter(r => r.mode === 'live').length, map.B4) + numCell('G4', rs.filter(r => r.mode === 'demo').length, map.B4), 30));
    rows.push(rowXML(7, ['위치', '등록 건수', '등록 내 비중'].map((v, i) => textCell('ABC'[i] + '7', v, map.A7)).join('') + ['공종', '등록 건수', '등록 내 비중'].map((v, i) => textCell('EFG'[i] + '7', v, map.A7)).join(''), 28));
    for (let i = 0; i < Math.max(ps.length, ts.length); i++) {
        const r = i + 8, p = ps[i], t = ts[i];
        let cells = '';
        if (p)
            cells += textCell(`A${r}`, p.name, map.A8) + formulaCell(`B${r}`, `COUNTIF('등록목록'!$C$5:$C$${end},${literalCriterion('A' + r)})`, p.count, map.B8) + formulaCell(`C${r}`, `IFERROR(B${r}/$B$4,0)`, p.count / n, map.C8);
        if (t)
            cells += textCell(`E${r}`, t.name, map.A8) + formulaCell(`F${r}`, `COUNTIF('등록목록'!$D$5:$D$${end},${literalCriterion('E' + r)})`, t.count, map.B8) + formulaCell(`G${r}`, `IFERROR(F${r}/$B$4,0)`, t.count / n, map.C8);
        rows.push(rowXML(r, cells));
    }
    const unitStart = 11 + Math.max(ps.length, ts.length);
    rows.push(rowXML(unitStart, textCell('A' + unitStart, '동호수 / 층·실명', map.A7) + textCell('B' + unitStart, '등록 건수', map.A7) + textCell('C' + unitStart, '등록 내 비중', map.A7), 28));
    for (let i = 0; i < us.length; i++) {
        const r = unitStart + i + 1, u = us[i];
        rows.push(rowXML(r, textCell('A' + r, u.name, map.A8) + formulaCell('B' + r, `COUNTIF('등록목록'!$B$5:$B$${end},${literalCriterion('A' + r)})`, u.count, map.B8) + formulaCell('C' + r, `IFERROR(B${r}/$B$4,0)`, u.count / n, map.C8)));
    }
    const noteStart = unitStart + us.length + 3;
    const notes = ['집계 기준: 사진 등록 1건을 1건으로 계산합니다. 재점검·중복 사진은 자동 제거되지 않습니다.', '위치·공종: 내용 키워드 기반 자동 분류 또는 상세 화면에서 직접 확인한 분류입니다.', '주의: 전체 점검 대상 수·정상 사례가 없으므로 위치별 발생률이나 품질순위를 뜻하지 않습니다.', 'AI 예측: 모델 미연결. 미래 발생 가능성 및 확률은 산출하지 않습니다.', '보관: 이 엑셀에는 녹음 원본이 없습니다. 녹음까지 보관하려면 앱에서 기록 백업을 사용하세요.'];
    const merges = ['A1:G1', 'A2:G2'];
    notes.forEach((t, i) => { const r = noteStart + i; rows.push(rowXML(r, textCell('A' + r, t, map.A2), 28)); merges.push(`A${r}:G${r}`); });
    const bars = `<conditionalFormatting sqref="B8:B${7 + ps.length}"><cfRule type="dataBar" priority="1"><dataBar showValue="1"><cfvo type="min"/><cfvo type="max"/><color rgb="FFBED5CA"/></dataBar></cfRule></conditionalFormatting><conditionalFormatting sqref="F8:F${7 + ts.length}"><cfRule type="dataBar" priority="2"><dataBar showValue="1"><cfvo type="min"/><cfvo type="max"/><color rgb="FFBED5CA"/></dataBar></cfRule></conditionalFormatting>`;
    return sheetXML(rows.join(''), { lastRow: noteStart + notes.length - 1, cols: [29, 17, 19, 5, 29, 17, 19], merges, freeze: 7, extra: bars });
}
async function makeExcel(rs, { scope = '조회 중인 기록' } = {}) {
    if (!rs.length) {
        toast('내보낼 기록이 없습니다.');
        return null;
    }
    if (rs.length > 1000)
        throw new Error('사진 포함 내보내기는 한 번에 1,000건까지입니다. 날짜·위치 필터로 나눠주세요.');
    const sorted = [...rs].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)), map = XLSX_TEMPLATE.styles['xl/worksheets/sheet1.xml'], parts = { ...XLSX_TEMPLATE.parts }, files = [], rows = [], anchors = [], relationships = [];
    const meta = `${scope} · ${sorted.length}건 · ${sourceLabel(sorted)} · 생성 ${dayKey(Date.now())} (한국시간) · 자동 분류는 확인 필요`;
    rows.push(rowXML(1, textCell('A1', '현장노트 · 사진대지', map.A1), 38));
    rows.push(rowXML(2, textCell('A2', meta, map.A2), 34));
    rows.push(rowXML(3, '', 10));
    rows.push(rowXML(4, ['날짜', '동호수 / 층·실명', '세부 위치', '공종', '내용', '비고', '해당사진'].map((v, i) => textCell('ABCDEFG'[i] + '4', v, map.A4)).join(''), 30));
    for (let i = 0; i < sorted.length; i++) {
        const record = sorted[i], c = classifyRecord(record), r = i + 5, alt = i % 2 ? 6 : 5, s = (col) => map[col + alt];
        showExportProgress(`사진 엑셀 준비 · ${i + 1} / ${sorted.length}건`);
        const photo = await imageForExcel(record.photo);
        files.push({ name: `xl/media/photo${i + 1}.jpeg`, data: photo.bytes });
        anchors.push(imageAnchor(i + 1, r, photo, `${c.unit} ${c.position} ${record.text || ''}`));
        relationships.push(`<Relationship Id="rId${i + 1}" Type="${REL_NS}/image" Target="../media/photo${i + 1}.jpeg"/>`);
        rows.push(rowXML(r, numCell('A' + r, excelDate(record.createdAt), s('A')) + textCell('B' + r, c.unit, s('B')) + textCell('C' + r, c.position, s('B')) + textCell('D' + r, c.trade, s('B')) + textCell('E' + r, record.text || '음성 확인 필요 · 녹음 원본 확인', s('E')) + textCell('F' + r, recordNote(record, { exported: true }), s('F')) + textCell('G' + r, '', s('G')), 120));
        if (i % 5 === 0)
            await new Promise(resolve => setTimeout(resolve, 0));
    }
    parts['xl/worksheets/sheet1.xml'] = sheetXML(rows.join(''), { lastRow: sorted.length + 4, cols: [14, 22, 17, 17, 48, 34, 38], merges: ['A1:G1', 'A2:G2'], freeze: 4, filter: `A4:G${sorted.length + 4}`, drawing: true });
    parts['xl/worksheets/sheet2.xml'] = makeSummarySheet(sorted, scope);
    parts['xl/worksheets/_rels/sheet1.xml.rels'] = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PKG_NS}"><Relationship Id="rIdImages" Type="${REL_NS}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`;
    parts['xl/drawings/drawing1.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL_NS}">${anchors.join('')}</xdr:wsDr>`;
    parts['xl/drawings/_rels/drawing1.xml.rels'] = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PKG_NS}">${relationships.join('')}</Relationships>`;
    parts['[Content_Types].xml'] = parts['[Content_Types].xml'].replace('</Types>', `<Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
    parts['xl/workbook.xml'] = parts['xl/workbook.xml'].replace('</x:workbook>', `<x:definedNames><x:definedName name="_xlnm.Print_Area" localSheetId="0">'등록목록'!$A$1:$G$${sorted.length + 4}</x:definedName><x:definedName name="_xlnm.Print_Titles" localSheetId="0">'등록목록'!$1:$4</x:definedName></x:definedNames><x:calcPr calcId="191029" fullCalcOnLoad="1"/></x:workbook>`);
    const enc = new TextEncoder();
    for (const [name, content] of Object.entries(parts))
        files.push({ name, data: enc.encode(content) });
    return new Blob([zipBlob(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
async function exportExcel(fromAnalytics = false) { if (state.exporting)
    return; if (state.active) {
    toast('점검을 종료한 뒤 엑셀을 내보내세요.');
    return;
} const rows = fromAnalytics ? analysisRecords() : selectedRecords(); if (!rows.length)
    return; const selected = !fromAnalytics && visibleRecords().some(r => state.selected.has(r.id)); const scope = fromAnalytics ? '집계 화면 조회 범위' : selected ? '선택한 등록 기록' : '등록 목록 조회 범위'; state.exporting = true; $('excelBtn').disabled = true; $('analyticsExcel').disabled = true; try {
    const file = await makeExcel(rows, { scope });
    if (file) {
        downloadBlob(file, `현장노트_${sourceLabel(rows).startsWith('체험') ? '체험_' : ''}사진대지_${dayKey(Date.now()).replaceAll('-', '')}_${rows.length}건.xlsx`);
        toast(`사진 ${rows.length}장의 사진대지와 집계 시트를 내보냈습니다.`);
    }
}
catch (e) {
    console.error(e);
    toast(`엑셀 내보내기 실패: ${e.message}`, true);
}
finally {
    state.exporting = false;
    $('excelProgress')?.remove();
    renderRecords();
    if (state.view === 'analytics')
        renderAnalytics();
} }
