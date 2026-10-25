#!/usr/bin/env python3
"""Repeatable browser smoke test; no production service is contacted.
Native IndexedDB is used. Media checks use Chromium's fake devices, NOT hardware.
Run: python tests/smoke_test.py
"""
from __future__ import annotations
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import threading
import time
import xml.etree.ElementTree as ET
import zipfile
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests' / 'output'
OUT.mkdir(parents=True, exist_ok=True)
RESULTS: list[dict[str, str]] = []
N = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

def passed(name: str, details: str = '') -> None:
    RESULTS.append({'test': name, 'status': 'PASS', 'details': details})
    print('PASS:', name, flush=True)

def ready(page):
    page.wait_for_function("typeof state !== 'undefined' && state.db !== null", timeout=15000)
    page.wait_for_function("document.getElementById('startBtn') !== null")

def validate_xlsx(path: Path, count: int) -> None:
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
        for name in z.namelist():
            if name.endswith('.xml') or name.endswith('.rels'):
                ET.fromstring(z.read(name))
        workbook = ET.fromstring(z.read('xl/workbook.xml'))
        assert [s.attrib['name'] for s in workbook.findall('m:sheets/m:sheet', N)] == ['등록목록', '집계']
        sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        headers = [''.join(c.itertext()) for c in sheet.findall("m:sheetData/m:row[@r='4']/m:c", N)]
        assert headers == ['날짜', '동호수', '위치', '공종', '내용', '비고', '해당사진'], headers
        rows = [r for r in sheet.findall('m:sheetData/m:row', N) if int(r.attrib['r']) >= 5]
        assert len(rows) == count, len(rows)
        assert len([n for n in z.namelist() if n.startswith('xl/media/photo')]) == count
        summary = ET.fromstring(z.read('xl/worksheets/sheet2.xml'))
        cached = summary.find("m:sheetData/m:row/m:c[@r='B4']/m:v", N)
        assert cached is not None and int(cached.text) == count
        assert summary.findall('.//m:f', N)
        for n in ('xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'):
            assert not any(x.attrib.get('t') == 'e' for x in ET.fromstring(z.read(n)).findall('.//m:c', N))

def download_excel(page, path: Path, expected_count: int) -> None:
    with page.expect_download(timeout=30000) as pending:
        page.locator('#excelBtn').click()
    pending.value.save_as(path)
    validate_xlsx(path, expected_count)
    page.wait_for_function('!state.exporting')

def run() -> None:
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    base = f'http://127.0.0.1:{server.server_port}'
    errors: list[str] = []
    network: list[str] = []
    executable = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
    try:
        with sync_playwright() as p:
            kwargs = dict(headless=True, args=['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
            if executable:
                kwargs['executable_path'] = executable
            browser = p.chromium.launch(**kwargs)
            context = browser.new_context(accept_downloads=True, viewport={'width': 1440, 'height': 1000}, timezone_id='Asia/Seoul')
            page = context.new_page()
            page.on('pageerror', lambda err: errors.append(str(err)))
            page.on('request', lambda req: network.append(req.url) if req.url.startswith(('http:', 'https:')) and not req.url.startswith(base) else None)
            page.goto(base + '/src/index.html')
            ready(page)
            assert page.evaluate('state.records.length') == 0
            assert page.locator('#startBtn').is_enabled()
            passed('분리 소스 초기 로드', '실제 브라우저 IndexedDB, 테스트 저장소 어댑터 없음')

            page.locator('#listTab').click()
            page.locator('#seedListBtn').click()
            page.wait_for_function('state.records.length === 36')
            page.locator('#seedListBtn').click()
            page.wait_for_function('state.records.length === 36')
            passed('체험 36건 생성 및 재실행 중복 방지')

            page.locator('#analyticsTab').click()
            assert page.evaluate('analysisRecords().length') == 36
            counts = page.evaluate('countBy(analysisRecords(), r => classifyRecord(r).position)')
            assert counts[0] == {'name': '욕실', 'count': 12}, counts
            assert '8건' in page.locator('#ruleInsights').inner_text()
            page.screenshot(path=str(OUT / 'analytics-desktop.png'), full_page=True)
            passed('집계 및 규칙 요약', '욕실 12건; 욕실·타일·단차 반복 8건')
            page.locator('#analyticsLive').click()
            assert page.evaluate('analysisRecords().length') == 0
            assert page.locator('#analysisEmpty').is_visible()
            passed('실제/체험 집계 분리', '실제 기록 0건일 때 통계 임의 생성 없음')

            page.locator('#listTab').click()
            download_excel(page, OUT / 'all-36.xlsx', 36)
            passed('사진 포함 엑셀 36건', '요청 7열, 2개 시트, 이미지 36개, 수식·캐시·XML 구조 확인')
            page.locator('#filterPosition').select_option('욕실')
            assert page.evaluate('visibleRecords().length') == 12
            page.locator('#recordTableBody [data-select]').first.check()
            download_excel(page, OUT / 'selected-one.xlsx', 1)
            passed('필터와 선택 항목 엑셀', '욕실 12건 중 선택 1건만 내보내기')
            page.locator('#clearSelection').click()
            page.locator('#resetFilters').click()

            record_id = page.evaluate('visibleRecords()[0].id')
            page.locator(f'#recordTableBody [data-record="{record_id}"]').first.click()
            page.locator('#detailNote').fill('인수인계 자동 점검 비고')
            page.locator('#detailSave').click()
            page.wait_for_function("!document.getElementById('detailDialog').open")
            page.reload()
            ready(page)
            page.wait_for_function('state.records.length === 36')
            assert page.evaluate('(id) => state.records.find(r => r.id === id).note', record_id) == '인수인계 자동 점검 비고'
            passed('상세 수정과 새로고침 후 저장 유지', '네이티브 IndexedDB에서 36건과 수정 비고 유지')

            with page.expect_download(timeout=30000) as pending:
                page.locator('#exportBtn').click()
            backup = OUT / 'records-backup.zip'
            pending.value.save_as(backup)
            with zipfile.ZipFile(backup) as z:
                payload = json.loads(z.read('records.json'))
                assert payload['schemaVersion'] == 2
                assert len(payload['records']) == 36
                assert len([n for n in z.namelist() if n.startswith('photos/')]) == 36
            passed('기록 ZIP 백업 생성', '메타데이터 36건 + 사진 36개')

            imported = browser.new_context(accept_downloads=True, viewport={'width': 1440, 'height': 1000}, timezone_id='Asia/Seoul', permissions=['camera', 'microphone'])
            page2 = imported.new_page()
            page2.on('pageerror', lambda err: errors.append(str(err)))
            page2.goto(base + '/src/index.html')
            ready(page2)
            page2.locator('#importInput').set_input_files(str(backup))
            page2.wait_for_function('state.records.length === 36 && !state.importing')
            page2.locator('#importInput').set_input_files(str(backup))
            page2.wait_for_function('!state.importing')
            assert page2.evaluate('state.records.length') == 36
            assert page2.evaluate('(id) => state.records.find(r => r.id === id).note', record_id) == '인수인계 자동 점검 비고'
            passed('새 저장소로 백업 가져오기·중복 방지')

            page2.locator('#captureTab').click()
            page2.locator('#startBtn').click()
            page2.wait_for_function('state.active && !state.busy')
            page2.locator('#shutter').click()
            page2.wait_for_function('!!state.draftPhoto && state.records.length === 36 && !state.busy')
            assert page2.locator('#shutterLabel').inner_text() == '녹음 완료 OK'
            page2.locator('#shutter').click()
            page2.wait_for_function('!state.draftPhoto && state.records.length === 37 && !state.busy')
            page2.locator('#shutter').click()
            page2.wait_for_function('!!state.draftPhoto && state.records.length === 37 && !state.busy')
            page2.locator('#shutter').click()
            page2.wait_for_function('!state.draftPhoto && state.records.length === 38 && !state.busy')
            first_locations = page2.evaluate('state.records.slice(-2).map(r=>r.location)')
            assert first_locations == ['101동 1203호', '101동 1203호']
            page2.locator('#locationBtn').click()
            page2.locator('#locationInput').fill('101동 1204호')
            page2.locator('#locationApply').click()
            page2.locator('#shutter').click()
            page2.wait_for_function('!!state.draftPhoto && state.records.length === 38 && !state.busy')
            page2.locator('#shutter').click()
            page2.wait_for_function('!state.draftPhoto && state.records.length === 39 && !state.busy')
            assert page2.evaluate('state.records.slice(-3).map(r=>r.location)') == ['101동 1203호', '101동 1203호', '101동 1204호']
            page2.locator('#finishBtn').click()
            page2.wait_for_function('!state.active && !state.stopping')
            passed('사진→설명→OK·위치 유지·새 위치 적용', '사진별 OK로 체험 3건; 이전 위치 불변')

            page2.locator('#captureTab').click()
            page2.locator('#liveMode').click()
            page2.locator('#startBtn').click()
            page2.wait_for_function("state.active && !state.busy && state.recorder && state.recorder.state === 'recording'", timeout=15000)
            page2.wait_for_function("document.getElementById('liveVideo').videoWidth > 0")
            page2.wait_for_timeout(1150)
            page2.locator('#shutter').click()
            page2.wait_for_function('!!state.draftPhoto && state.records.length === 39 && !state.busy')
            page2.locator('#shutter').click()
            page2.wait_for_function('!state.draftPhoto && state.records.length === 40 && !state.busy')
            assert page2.evaluate('state.recorder.state') == 'recording'
            assert page2.evaluate('state.records.at(-1).text') == ''
            assert page2.evaluate("['pending','not_supported'].includes(state.records.at(-1).transcriptionStatus)")
            page2.locator('#pauseBtn').click()
            assert page2.evaluate('state.paused')
            assert page2.evaluate('state.recorder.state') == 'paused'
            page2.locator('#pauseBtn').click()
            page2.wait_for_timeout(400)
            page2.locator('#finishBtn').click()
            page2.wait_for_function('!state.active && !state.stopping')
            audio_bytes = page2.evaluate('(async () => (await sessionBlob(state.session.id)).size)()')
            assert audio_bytes > 0
            passed('가상 장치 촬영·연속 녹음·일시정지·종료', f'원본 Blob {audio_bytes} bytes; 실제 하드웨어·음성인식 시험 아님')

            page2.set_viewport_size({'width': 390, 'height': 844})
            page2.locator('#analyticsTab').click()
            page2.locator('#analyticsDemo').click()
            page2.screenshot(path=str(OUT / 'analytics-mobile.png'), full_page=True)
            overflow = page2.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
            assert not overflow
            passed('390px 모바일 폭 렌더링', '분석 화면 문서 가로 넘침 없음; 실제 휴대폰 조작성은 별도')

            fresh = browser.new_context(viewport={'width': 1440, 'height': 1000})
            page3 = fresh.new_page()
            page3.on('pageerror', lambda err: errors.append(str(err)))
            page3.goto(base + '/dist/index.html')
            ready(page3)
            page3.locator('#listTab').click()
            page3.locator('#seedListBtn').click()
            page3.wait_for_function('state.records.length === 36')
            passed('빌드된 단일 HTML 실행', '별도 CSS/JS 파일 요청 없이 예시 36건 생성')
            assert not errors, errors
            assert not network, network
            passed('처리되지 않은 JS 오류·외부 API 요청 없음', '점검한 프런트엔드 경로 기준')
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

def main() -> int:
    start = time.monotonic()
    ok = True
    try:
        run()
    except Exception as exc:
        ok = False
        RESULTS.append({'test': 'suite', 'status': 'FAIL', 'details': str(exc)})
        print('FAIL:', exc, flush=True)
        raise
    finally:
        (OUT / 'results.json').write_text(json.dumps({'success': ok, 'duration_seconds': round(time.monotonic()-start, 2), 'tests': RESULTS}, ensure_ascii=False, indent=2), encoding='utf-8')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
