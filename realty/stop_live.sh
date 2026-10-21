#!/bin/bash
# stop_live.sh - Stops SofDom backend and tunnel cleanly

echo "[*] Остановка бэкенда и туннеля SofDom..."
pkill -f "realty/main.py" 2>/dev/null || true
pkill -f "nokey@localhost.run" 2>/dev/null || true
pkill -f "cloudflared" 2>/dev/null || true
sleep 1

# Verify nothing is listening on 8080
if lsof -i :8080 > /dev/null 2>&1; then
    echo "[!] Порт 8080 всё ещё занят, принудительное завершение..."
    kill -9 $(lsof -t -i :8080) 2>/dev/null || true
fi

echo "[+] Все процессы остановлены. Порт 8080 свободен. Батарея в безопасности."
