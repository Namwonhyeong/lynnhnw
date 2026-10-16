#!/usr/bin/env python3
"""Local development server. No cloud API, uploads, or authentication.
Python 3.10+; standard library only. Default: loopback port 8080.
"""
from __future__ import annotations
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import webbrowser

ROOT = Path(__file__).resolve().parents[1]

class DevelopmentHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--dist", action="store_true", help="Serve the built single-file version")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Port must be between 1 and 65535")
    directory = ROOT / ("dist" if args.dist else "src")
    document = "index.html"
    if not (directory / document).is_file():
        print("Missing entry file. Run scripts/build.py first for --dist.", file=sys.stderr)
        return 1
    handler = functools.partial(DevelopmentHandler, directory=str(directory))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as exc:
        print(f"Cannot start server: {exc}\nTry: python scripts/serve.py --port 8081", file=sys.stderr)
        return 1
    url = f"http://127.0.0.1:{args.port}/{document}"
    print(f"Local development only: {url}\nPress Ctrl+C to stop.\nKeep the host and port unchanged to use the same browser records.", flush=True)
    if not args.no_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
