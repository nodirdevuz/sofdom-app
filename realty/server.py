#!/usr/bin/env python3
"""
server.py
Zero-cost standalone local server for Realty Sniper (Joymee Style).
Runs locally on MacBook Air M5. Accessible locally and from phone over Wi-Fi/Hotspot.
No Vercel, no Railway, 0 rubles cost, 0 risk of RKN blocks.
"""

import http.server
import socketserver
import json, os, subprocess, sys
from urllib.parse import urlparse, parse_qs

PORT = 8080
DIRECTORY = "/Users/macbookairm5/Desktop/Проекты/Снайпер/realty"

class RealtyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        
        # Route: Main page
        if parsed.path == "/" or parsed.path == "/index.html":
            self.path = "/realty_aggregator_demo.html"
            return super().do_GET()
            
        # Route: Secret apartment report
        elif parsed.path == "/secret":
            self.path = "/avito_secret_apartment_4326801484.html"
            return super().do_GET()

        # Route: Live API feed
        elif parsed.path == "/api/feed":
            feed_file = os.path.join(DIRECTORY, "feed_live.json")
            if os.path.exists(feed_file):
                with open(feed_file, "r", encoding="utf-8") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(data.encode("utf-8"))
                return
            else:
                self.send_error(404, "Feed not found")
                return

        # Route: Status
        elif parsed.path == "/api/status":
            feed_file = os.path.join(DIRECTORY, "feed_live.json")
            count = 0
            if os.path.exists(feed_file):
                with open(feed_file, "r", encoding="utf-8") as f:
                    count = len(json.load(f))
            status = {
                "status": "online",
                "total_apartments": count,
                "sources": ["avito_secret", "cian_owners"],
                "host": "MacBook Air M5 (Local)",
                "port": PORT
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(status, ensure_ascii=False).encode("utf-8"))
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/sync":
            # Run pipeline sync in background or synchronously
            py_bin = "/Users/macbookairm5/Desktop/Проекты/Авито/avito-tomsk/.venv/bin/python3"
            script = os.path.join(DIRECTORY, "pipeline_daemon.py")
            try:
                res = subprocess.run([py_bin, script], capture_output=True, text=True, timeout=30)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "output": res.stdout}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        self.send_error(404, "Unknown endpoint")

def run():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), RealtyHandler) as httpd:
        print(f"=====================================================")
        print(f"🚀 Realty Sniper Local Server is running on port {PORT}")
        print(f"💻 На Маке:     http://localhost:{PORT}")
        print(f"📱 На телефоне: http://172.20.10.3:{PORT} (через Wi-Fi)")
        print(f"🔒 Секретная:   http://localhost:{PORT}/secret")
        print(f"=====================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    run()
