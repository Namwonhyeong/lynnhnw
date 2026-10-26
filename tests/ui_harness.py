#!/usr/bin/env python3
"""Local-content UI test with an explicitly isolated in-memory store adapter.
No URL navigation; no native IndexedDB, device recording or persistence claims.
Run this when managed browser policy blocks local HTTP test navigation.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import shutil
import traceback
from playwright.sync_api import sync_playwright
from smoke_test import validate_xlsx

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/output/harness'
OUT.mkdir(parents=True, exist_ok=True)
REPORT = []
SCRIPTS = ['core.js','speech.js','photo-template.js','xlsx-template.js','records.js','analytics.js','excel.js','backup-import.js','main.js']

def record(name, detail=''):
    REPORT.append({'test': name, 'status': 'PASS', 'details': detail})
    print('PASS:', name, flush=True)

def mount(page, use_dist=False):
    if use_dist:
        html = (ROOT/'dist/index.html').read_text(encoding='utf-8')
        scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
    else:
        html = (ROOT/'src/index.html').read_text(encoding='utf-8')
        css = (ROOT/'src/css/styles.css').read_text(encoding='utf-8')
        html = html.replace('<link rel="stylesheet" href="css/styles.css">', '<style>'+css+'</style>')
        scripts = [(ROOT/'src/js'/n).read_text(encoding='utf-8') for n in SCRIPTS]
    html = re.sub(r'<script\b[^>]*>.*?</script>', '', html, flags=re.S)
    page.set_content(html, wait_until='load')
    for index, script in enumerate(scripts):
        if index == len(scripts)-1:
            page.add_script_tag(content=(ROOT/'tests/memory_store_adapter.js').read_text(encoding='utf-8'))
        page.add_script_tag(content=script)
    page.wait_for_function('typeof state !== "undefined" && state.db !== null')
    page.wait_for_function('!document.getElementById("startBtn").disabled')

def export(page, name, n):
    with page.expect_download(timeout=30000) as pending:
        page.locator('#excelBtn').click()
    path = OUT/name
    pending.value.save_as(path)
    validate_xlsx(path, n)
    page.wait_for_function('!state.exporting')

def main():
    errors=[]
    try:
        with sync_playwright() as p:
            kwargs={'headless':True,'args':['--no-sandbox']}
            exe=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
            if exe: kwargs['executable_path']=exe
            browser=p.chromium.launch(**kwargs)
            context=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':1000},timezone_id='Asia/Seoul')
            page=context.new_page()
            page.on('pageerror',lambda e:errors.append(str(e)))
            mount(page)
            assert page.evaluate('state.records.length')==0
            record('분리 소스 화면 초기화','로컬 HTML 렌더링 + 메모리 테스트 저장소; 네이티브 저장 검증 아님')
            page.locator('#listTab').click();page.locator('#seedListBtn').click()
            page.wait_for_function('state.records.length === 36')
            page.locator('#seedListBtn').click();page.wait_for_timeout(80)
            assert page.evaluate('state.records.length')==36
            record('체험 36건 생성·중복 방지')
            page.locator('#analyticsTab').click()
            assert page.evaluate('analysisRecords().length')==36
            assert page.evaluate('countBy(analysisRecords(),r=>classifyRecord(r).position)[0]')=={'name':'욕실','count':12}
            assert '8건' in page.locator('#ruleInsights').inner_text()
            page.screenshot(path=str(OUT/'analytics-desktop.png'),full_page=True)
            page.locator('#analyticsLive').click()
            assert page.evaluate('analysisRecords().length')==0
            assert page.locator('#analysisEmpty').is_visible()
            record('집계·규칙 요약·실제/체험 분리','욕실 12건; 반복 단차 8건; 실제 기록 0건 분리')
            page.locator('#listTab').click()
            export(page,'all-36.xlsx',36)
            record('사진 포함 엑셀 36건','7열 순서, 2시트, 36개 이미지, XML·캐시·수식 구조')
            page.locator('#filterPosition').select_option('욕실')
            assert page.evaluate('visibleRecords().length')==12
            page.locator('#recordTableBody [data-select]').first.check()
            export(page,'selected-one.xlsx',1)
            page.locator('#clearSelection').click();page.locator('#resetFilters').click()
            record('조회 필터·선택 내보내기','욕실 12건 중 선택 1건만 사진 포함 출력')
            rid=page.evaluate('visibleRecords()[0].id')
            page.locator(f'#recordTableBody [data-record="{rid}"]').first.click()
            page.locator('#detailNote').fill('개발 인수인계 시험 비고')
            page.locator('#detailSave').click()
            page.wait_for_function('!document.getElementById("detailDialog").open')
            assert page.evaluate('(id)=>state.records.find(r=>r.id===id).note',rid)=='개발 인수인계 시험 비고'
            # Exercise readback from the TEST adapter; not a browser persistence claim.
            assert page.evaluate('(async()=> (await getAll("records")).filter(r=>r.note === "개발 인수인계 시험 비고").length)()')==1
            record('상세 수정·테스트 저장소 반영','네이티브 디스크 저장/새로고침 검증 아님')
            with page.expect_download(timeout=30000) as pending:
                page.locator('#exportBtn').click()
            backup=OUT/'records.zip';pending.value.save_as(backup)
            page2=context.new_page();page2.on('pageerror',lambda e:errors.append(str(e)))
            mount(page2)
            page2.locator('#importInput').set_input_files(str(backup))
            page2.wait_for_function('state.records.length===36 && !state.importing')
            page2.locator('#importInput').set_input_files(str(backup));page2.wait_for_timeout(100)
            assert page2.evaluate('state.records.length')==36
            assert page2.evaluate('(id)=>state.records.find(r=>r.id===id).note',rid)=='개발 인수인계 시험 비고'
            record('ZIP 백업·빈 테스트 저장소로 복원·중복 방지')
            page2.locator('#captureTab').click();page2.locator('#startBtn').click()
            page2.wait_for_function('state.active && !state.busy')
            page2.locator('#shutter').click();page2.wait_for_function('!!state.draftPhoto && state.records.length===36 && !state.busy')
            assert page2.locator('#shutterLabel').inner_text()=='녹음 완료 OK'
            page2.locator('#shutter').click();page2.wait_for_function('!state.draftPhoto && state.records.length===37 && !state.busy')
            page2.locator('#shutter').click();page2.wait_for_function('!!state.draftPhoto && state.records.length===37 && !state.busy')
            page2.locator('#shutter').click();page2.wait_for_function('!state.draftPhoto && state.records.length===38 && !state.busy')
            page2.locator('#locationBtn').click();page2.locator('#locationInput').fill('101동 1204호');page2.locator('#locationApply').click()
            page2.locator('#shutter').click();page2.wait_for_function('!!state.draftPhoto && state.records.length===38 && !state.busy')
            page2.locator('#shutter').click();page2.wait_for_function('!state.draftPhoto && state.records.length===39 && !state.busy')
            assert page2.evaluate('state.records.slice(-3).map(r=>r.location)')==['101동 1203호','101동 1203호','101동 1204호']
            page2.locator('#finishBtn').click();page2.wait_for_function('!state.active && !state.stopping')
            record('체험 사진→설명→OK·위치 유지·변경','사진별 OK로 3건 생성, 이전 기록 위치 불변')
            page2.set_viewport_size({'width':390,'height':844})
            page2.locator('#analyticsTab').click();page2.locator('#analyticsDemo').click()
            page2.screenshot(path=str(OUT/'analytics-mobile.png'),full_page=True)
            assert not page2.evaluate('document.documentElement.scrollWidth > innerWidth+1')
            record('모바일 390px 화면 렌더링','문서 가로 넘침 없음')
            page3=context.new_page();page3.on('pageerror',lambda e:errors.append(str(e)))
            mount(page3,use_dist=True)
            page3.locator('#listTab').click();page3.locator('#seedListBtn').click();page3.wait_for_function('state.records.length===36')
            record('단일 HTML 빌드 산출물 UI','동일 테스트 저장소 어댑터로 화면·예시 생성 확인')
            assert not errors,errors
            record('시험 중 처리되지 않은 JS 오류 없음')
            browser.close()
    except Exception as exc:
        REPORT.append({'test':'suite','status':'FAIL','details':str(exc)})
        traceback.print_exc()
        return 1
    finally:
        (OUT/'results.json').write_text(json.dumps({'method':'in-memory UI harness; NOT native IndexedDB or hardware validation','tests':REPORT},ensure_ascii=False,indent=2),encoding='utf-8')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
