#!/usr/bin/env python3
"""Combine local CSS and classic scripts into a single distributable HTML.
Uses Python standard library only. The original supplied file is never edited.
"""
from __future__ import annotations
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src"

def read_asset(relative: str) -> str:
    path = (SOURCE / relative).resolve()
    if not path.is_relative_to(SOURCE.resolve()):
        raise ValueError("Asset must stay inside src/: " + relative)
    return path.read_text(encoding="utf-8")

def build() -> Path:
    html = (SOURCE / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
        lambda m: "<style>\n" + read_asset(m[1]) + "\n</style>", html)
    html = re.sub(r'<script src="([^"]+)"></script>',
        lambda m: "<script>\n" + read_asset(m[1]).replace("</script", "<\\/script") + "\n</script>", html)
    target = ROOT / "dist" / "index.html"
    target.parent.mkdir(exist_ok=True)
    target.write_text(html, encoding="utf-8")
    for name in ("manifest.webmanifest", "sw.js"):
        shutil.copyfile(SOURCE / name, target.parent / name)
    return target

if __name__ == "__main__":
    print("Built:", build())
