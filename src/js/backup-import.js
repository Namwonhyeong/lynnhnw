/* 현장노트 v2 · 개발 인수인계
 * 기존 v1/v2 ZIP 백업 가져오기. 동일 ID는 덮어쓰지 않습니다.
 * 원본 HTML의 인라인 스크립트 295–311행에서 분리했습니다.
 * classic script: 전역 이름과 로드 순서에 의존합니다. ESM 전환 시 별도 리팩터링이 필요합니다.
 */
'use strict';
// ---------- Portable import for v1/v2 backups; merge only, never overwrite ----------
function parseStoredZip(buffer) { const data = new Uint8Array(buffer), view = new DataView(buffer), result = new Map(), dec = new TextDecoder(); let at = 0, total = 0; while (at + 4 <= data.length && view.getUint32(at, true) === 0x04034b50) {
    if (at + 30 > data.length)
        throw new Error('손상된 ZIP 헤더');
    const flags = view.getUint16(at + 6, true), method = view.getUint16(at + 8, true), crc = view.getUint32(at + 14, true), size = view.getUint32(at + 18, true), nameLen = view.getUint16(at + 26, true), extraLen = view.getUint16(at + 28, true);
    if (method !== 0 || (flags & 8))
        throw new Error('현장노트에서 만든 ZIP 백업만 가져올 수 있습니다.');
    const start = at + 30 + nameLen + extraLen;
    if (start + size > data.length)
        throw new Error('불완전한 ZIP 백업');
    const name = dec.decode(data.slice(at + 30, at + 30 + nameLen)), body = data.slice(start, start + size);
    if (name.includes('..') || name.startsWith('/') || name.includes('\\'))
        throw new Error('잘못된 백업 경로');
    if (crc32(body) !== crc)
        throw new Error('백업 파일 무결성 검사 실패');
    if (result.has(name))
        throw new Error('중복된 ZIP 항목');
    result.set(name, body);
    total += size;
    if (result.size > 25000 || total > 350 * 1024 * 1024)
        throw new Error('백업이 너무 큽니다.');
    at = start + size;
} if (!result.has('records.json'))
    throw new Error('records.json이 있는 현장노트 ZIP을 선택하세요.'); return result; }
function bytesToDataURL(bytes, type) { let text = ''; for (let i = 0; i < bytes.length; i += 16384)
    text += String.fromCharCode(...bytes.subarray(i, i + 16384)); return `data:${type};base64,` + btoa(text); }
function validLocalImage(s) { return typeof s === 'string' && s.length <= 25 * 1024 * 1024 && /^data:image\/(jpeg|jpg|png|webp|svg\+xml)(;[^,]*)?,/.test(s) && !/["<>\r\n]/.test(s); }
async function importBackup(file) {
    if (!file || state.importing)
        return;
    if (state.active) {
        toast('점검 종료 후 가져오세요.');
        return;
    }
    if (file.size > 350 * 1024 * 1024) {
        toast('백업은 350MB 이하로 나눠주세요.', true);
        return;
    }
    state.importing = true;
    $('importBtn').disabled = true;
    try {
        showExportProgress('기록 백업 확인 중');
        let payload, files = null;
        if (/\.zip$/i.test(file.name)) {
            files = parseStoredZip(await file.arrayBuffer());
            payload = JSON.parse(new TextDecoder().decode(files.get('records.json')));
        }
        else
            payload = JSON.parse(await file.text());
        if (!payload || ![1, 2].includes(payload.schemaVersion) || !Array.isArray(payload.records) || payload.records.length > 10000)
            throw new Error('지원하지 않는 백업 형식입니다.');
        const existing = new Set(state.records.map(r => r.id)), newIds = new Set(), added = [];
        const sessionsIn = Array.isArray(payload.sessions) ? payload.sessions : [], sids = new Set(state.sessions.map(s => s.id));
        for (const r of payload.records) {
            if (typeof r.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,200}$/.test(r.id) || typeof r.sessionId !== 'string' || !/^[A-Za-z0-9_.:-]{1,200}$/.test(r.sessionId) || !['demo', 'live'].includes(r.mode) || !Number.isFinite(r.createdAt) || r.createdAt < Date.UTC(2000, 0, 1) || r.createdAt > Date.UTC(2100, 0, 1))
                throw new Error('기록의 ID 또는 날짜가 올바르지 않습니다.');
            if (existing.has(r.id) || newIds.has(r.id))
                continue;
            let photo = r.photo;
            if (files && r.photoFile) {
                const bytes = files.get(r.photoFile);
                if (!bytes)
                    throw new Error('백업에 사진이 빠져 있습니다.');
                let type = /\.svg$/i.test(r.photoFile) ? 'image/svg+xml' : /\.png$/i.test(r.photoFile) ? 'image/png' : /\.webp$/i.test(r.photoFile) ? 'image/webp' : 'image/jpeg';
                photo = bytesToDataURL(bytes, type);
            }
            if (!validLocalImage(photo))
                throw new Error('사진 데이터가 없거나 잘못되었습니다. JSON 목록만 있으면 원래 ZIP을 선택하세요.');
            const importedStatus = ['browser', 'manual', 'pending', 'not_supported'].includes(r.transcriptionStatus) ? r.transcriptionStatus : r.text ? 'manual' : 'pending';
            const safe = { id: r.id, sessionId: r.sessionId.slice(0, 200), number: Number.isInteger(r.number) ? r.number : added.length + 1, mode: r.mode, createdAt: r.createdAt, location: String(r.location || '').slice(0, 80), text: String(r.text || '').slice(0, 4000), transcriptRaw: String(r.transcriptRaw || '').slice(0, 4000), photo, photoFormat: /image\/svg/.test(photo) ? 'svg' : /image\/png/.test(photo) ? 'png' : /image\/webp/.test(photo) ? 'webp' : 'jpg', audioOffsetMs: Number.isFinite(r.audioOffsetMs) ? Math.max(0, r.audioOffsetMs) : 0, transcriptionStatus: r.mode === 'demo' ? 'demo' : importedStatus, cloudStatus: 'not_connected', classificationReviewed: !!r.classificationReviewed };
            for (const k of ['unitOverride', 'positionOverride', 'tradeOverride', 'typeOverride', 'demoSource'])
                if (typeof r[k] === 'string')
                    safe[k] = r[k].slice(0, 80);
            safe.note = String(r.note || '').slice(0, 1000);
            added.push(safe);
            newIds.add(safe.id);
        }
        const addedS = [], chunks = [];
        for (const s of sessionsIn) {
            if (typeof s.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,200}$/.test(s.id) || sids.has(s.id) || !['demo', 'live'].includes(s.mode))
                continue;
            const ns = { id: s.id.slice(0, 200), mode: s.mode, status: 'finished', startedAt: Number(s.startedAt) || Date.now(), endedAt: Number(s.endedAt) || Date.now(), mime: String(s.mime || '').includes('mp4') || /\.m4a$/i.test(s.audioFile || '') ? 'audio/mp4' : 'audio/webm' };
            if (files && typeof s.audioFile === 'string' && files.has(s.audioFile) && s.mode === 'live') {
                const audio = files.get(s.audioFile);
                chunks.push({ id: `${ns.id}:import-0`, sessionId: ns.id, seq: 0, blob: new Blob([audio], { type: ns.mime }) });
            }
            addedS.push(ns);
            sids.add(ns.id);
        }
        for (const r of added)
            if (!sids.has(r.sessionId)) {
                addedS.push({ id: r.sessionId, mode: r.mode, status: 'finished', startedAt: r.createdAt });
                sids.add(r.sessionId);
            }
        if (!added.length && !addedS.length) {
            toast('이미 있는 기록입니다. 덮어쓰지 않았습니다.');
            return;
        }
        showExportProgress(`${added.length}건의 사진과 메타데이터 가져오는 중`);
        await new Promise((resolve, reject) => { const tx = state.db.transaction(['records', 'sessions', 'chunks'], 'readwrite'); for (const r of added)
            tx.objectStore('records').put(r); for (const s of addedS)
            tx.objectStore('sessions').put(s); for (const c of chunks)
            tx.objectStore('chunks').put(c); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('저장 공간 부족')); });
        state.records.push(...added);
        state.sessions.push(...addedS);
        state.filter = 'all';
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('selected', b.dataset.filter === 'all'));
        resetListFilters(false);
        renderRecords();
        updateView('list');
        toast(`${added.length}건을 가져왔습니다. 기존 기록은 유지됩니다.`);
    }
    catch (e) {
        console.error(e);
        toast(`가져오기 실패: ${e.message}`, true);
    }
    finally {
        state.importing = false;
        $('importBtn').disabled = false;
        $('importInput').value = '';
        $('excelProgress')?.remove();
    }
}
