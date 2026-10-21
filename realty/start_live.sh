#!/bin/bash
# start_live.sh - Starts SofDom FastAPI backend & public global HTTPS tunnel

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$DIR/../.venv/bin/python3"
LOG_SERVER="/tmp/sofdom_server.log"
LOG_TUNNEL="/tmp/sofdom_tunnel.log"
URL_FILE="$DIR/LIVE_URL.txt"

# 1. Kill old instances
pkill -f "realty/main.py" 2>/dev/null || true
pkill -f "nokey@localhost.run" 2>/dev/null || true
sleep 1

# 2. Start FastAPI Server
echo "[*] Запуск бэкенда на порту 8080..."
nohup "$VENV" "$DIR/main.py" > "$LOG_SERVER" 2>&1 < /dev/null &
SERVER_PID=$!
sleep 2

# Verify server responded
if ! curl -s "http://127.0.0.1:8080/api/stats" > /dev/null; then
    echo "[!] Ошибка запуска бэкенда. Проверьте $LOG_SERVER"
    exit 1
fi
echo "[+] Бэкенд успешно запущен (PID $SERVER_PID)"

# 3. Start Public HTTPS SSH Tunnel
echo "[*] Открытие глобального публичного HTTPS туннеля..."
> "$LOG_TUNNEL"

nohup ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R 80:127.0.0.1:8080 nokey@localhost.run > "$LOG_TUNNEL" 2>&1 < /dev/null &
TUNNEL_PID=$!

# Wait for tunnel URL
for i in {1..12}; do
    URL=$(grep -o "https://[a-zA-Z0-9.-]*\.lhr\.life" "$LOG_TUNNEL" | head -n 1)
    if [ -n "$URL" ]; then
        echo "$URL" > "$URL_FILE"
        echo "$URL" > /tmp/live_url.txt
        echo "=========================================================="
        echo "🎉 ВАШ ПУБЛИЧНЫЙ САЙТ И БЭКЕНД РАБОТАЕТ ПО ССЫЛКЕ:"
        echo "👉 $URL"
        echo "=========================================================="
        break
    fi
    sleep 1
done

if [ -z "$URL" ]; then
    echo "[!] Не удалось получить URL туннеля за 12 секунд. Лог:"
    cat "$LOG_TUNNEL"
    exit 1
fi
