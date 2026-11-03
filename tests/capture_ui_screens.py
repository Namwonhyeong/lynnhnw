#!/usr/bin/env python3
"""Capture the real mobile UI flow with Chromium's fake media device."""
from __future__ import annotations

import functools
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests' / 'output' / 'capture-ui'
OUT.mkdir(parents=True, exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main() -> None:
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/src/index.html'
    errors: list[str] = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path=os.environ['CHROMIUM_EXECUTABLE'],
                headless=True,
                args=['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
            )
            context = browser.new_context(viewport={'width': 390, 'height': 844}, timezone_id='Asia/Seoul')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(url)
            page.wait_for_function("typeof state !== 'undefined' && state.db !== null")
            page.screenshot(path=str(OUT / '01-start.png'))

            page.locator('#locationBtn').click()
            page.screenshot(path=str(OUT / '02-location.png'))
            page.locator('#locationInput').fill('101동 302호')
            page.locator('#locationApply').click()
            page.locator('#startBtn').click()
            page.wait_for_function("state.active && !state.busy && document.getElementById('liveVideo').videoWidth > 0")
            page.screenshot(path=str(OUT / '03-camera.png'))

            page.locator('#shutter').click()
            page.wait_for_function("!!state.draftPhoto && !state.busy")
            assert page.locator('#shutterLabel').inner_text() == '음성 입력 완료'
            assert page.locator('#annotationTools').is_visible()
            page.locator('#penTool').click()
            box = page.locator('#annotationCanvas').bounding_box()
            assert box
            page.mouse.move(box['x'] + box['width'] * .25, box['y'] + box['height'] * .55)
            page.mouse.down()
            page.mouse.move(box['x'] + box['width'] * .42, box['y'] + box['height'] * .42, steps=8)
            page.mouse.up()
            page.locator('#circleTool').click()
            page.mouse.move(box['x'] + box['width'] * .55, box['y'] + box['height'] * .28)
            page.mouse.down()
            page.mouse.move(box['x'] + box['width'] * .82, box['y'] + box['height'] * .72, steps=8)
            page.mouse.up()
            page.screenshot(path=str(OUT / '04-voice-annotation.png'))

            page.locator('#shutter').click()
            page.wait_for_function("!state.draftPhoto && state.records.length === 1 && !state.busy")
            assert page.locator('#lastShortcut').is_enabled()
            page.screenshot(path=str(OUT / '05-saved-edit.png'), full_page=True)

            page.locator('#lastShortcut').click()
            page.wait_for_function("document.getElementById('detailDialog').open")
            page.screenshot(path=str(OUT / '06-edit-dialog.png'))
            page.locator('#detailDialog .close-btn').click()
            page.locator('#listTab').click()
            page.screenshot(path=str(OUT / '07-records.png'), full_page=True)
            page.locator('#analyticsTab').click()
            page.screenshot(path=str(OUT / '08-analytics.png'), full_page=True)
            assert not errors, errors
            browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
