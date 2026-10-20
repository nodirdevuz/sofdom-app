#!/usr/bin/env python3
"""
server.py
Zero-cost standalone FastAPI server for Realty Sniper (Tomsk).
Runs locally on MacBook Air M5. Accessible locally and from phone over Wi-Fi / Hotspot.
No Vercel, no Railway, 0 rubles cost, 0 risk of RKN blocks.
"""

import sys
import os
import uvicorn

PORT = 8080
HOST = "0.0.0.0"

def run():
    print("=====================================================")
    print(f"🚀 Realty Sniper Local Backend (FastAPI + SQLite)")
    print(f"💻 На Маке:     http://localhost:{PORT}")
    print(f"📱 В сети Wi-Fi: http://172.20.10.3:{PORT}")
    print(f"🔒 Секретная:   http://localhost:{PORT}/secret")
    print(f"📖 Swagger API: http://localhost:{PORT}/docs")
    print("=====================================================")
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)

if __name__ == "__main__":
    run()
