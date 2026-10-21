#!/usr/bin/env python3
"""
bot.py
Telegram Bot & Alert Dispatcher for Realty Sniper (Tomsk).
Provides:
 1. /start — Welcome greeting & WebApp launch button.
 2. /status — Subscription status, plan, remaining contact unlocks today.
 3. /latest — Top 3 newest direct-owner listings in Tomsk.
 4. Dispatcher: Broadcasts new Tomsk owner listings (especially Secret Early Access)
    to subscribed users in real time.
"""

import os
import sys
import json
import time
import httpx
from datetime import datetime

# Path setup
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import db

TELEGRAM_API_BASE = "https://api.telegram.org/bot"

class RealtyTelegramBot:
    def __init__(self, token: str = None):
        self.token = token or os.environ.get("TELEGRAM_BOT_TOKEN", "MOCK_TOKEN")
        self.base_url = f"{TELEGRAM_API_BASE}{self.token}"
        self.is_mock = (self.token == "MOCK_TOKEN" or not self.token)

    def send_message(self, chat_id: str, text: str, reply_markup: dict = None) -> bool:
        """Sends a text message with optional inline keyboard."""
        if self.is_mock:
            print(f"[MOCK BOT] -> Sent to {chat_id}:\n{text}\nMarkup: {reply_markup}\n")
            return True
        try:
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": False
            }
            if reply_markup:
                payload["reply_markup"] = json.dumps(reply_markup)
            res = httpx.post(f"{self.base_url}/sendMessage", json=payload, timeout=8.0)
            return res.status_code == 200
        except Exception as e:
            print(f"[!] Telegram send_message error: {e}")
            return False

    def send_photo(self, chat_id: str, photo_url: str, caption: str, reply_markup: dict = None) -> bool:
        """Sends a photo with HTML caption and inline keyboard."""
        if self.is_mock:
            print(f"[MOCK BOT] -> Sent Photo to {chat_id} ({photo_url}):\n{caption}\n")
            return True
        try:
            payload = {
                "chat_id": chat_id,
                "photo": photo_url,
                "caption": caption,
                "parse_mode": "HTML"
            }
            if reply_markup:
                payload["reply_markup"] = json.dumps(reply_markup)
            res = httpx.post(f"{self.base_url}/sendPhoto", json=payload, timeout=10.0)
            if res.status_code != 200:
                # Fallback to plain text if photo URL failed
                return self.send_message(chat_id, caption, reply_markup)
            return True
        except Exception as e:
            print(f"[!] Telegram send_photo error: {e}")
            return self.send_message(chat_id, caption, reply_markup)

    def format_apartment_alert(self, apt: dict, webapp_url: str = "http://localhost:5173") -> tuple:
        """Formats an apartment into an eye-catching Telegram alert message and inline button."""
        is_secret = bool(apt.get("is_secret_early_access"))
        price_badge = f"{apt['price']:,}".replace(",", " ") + " ₽/мес"
        
        secret_header = "⚡ <b>[СЕКРЕТНЫЙ РАННИЙ ДОСТУП]</b>\n<i>Доступно только в Снайпере за 6 часов до Авито!</i>\n\n" if is_secret else "🔥 <b>НОВОЕ ОБЪЯВЛЕНИЕ ОТ СОБСТВЕННИКА</b>\n\n"
        
        district_str = f"📍 <b>Район:</b> {apt.get('district') or 'Томск'}\n"
        addr_str = f"🏢 <b>Адрес:</b> {apt.get('address')}\n"
        specs_str = f"📐 <b>Параметры:</b> {apt.get('rooms')}, {apt.get('area')} м², {apt.get('floor')}/{apt.get('total_floors')} эт.\n"
        price_str = f"💰 <b>Цена:</b> <b>{price_badge}</b> (Залог: {apt.get('deposit', 0)} ₽, Комиссия: 0 ₽!)\n\n"
        
        desc_preview = (apt.get("description") or "").strip()
        if len(desc_preview) > 180:
            desc_preview = desc_preview[:180] + "..."
        desc_str = f"📝 <i>«{desc_preview}»</i>\n" if desc_preview else ""
        
        caption = f"{secret_header}{district_str}{addr_str}{specs_str}{price_str}{desc_str}"

        # Photos
        photos = []
        try:
            if isinstance(apt.get("photos_json"), str):
                photos = json.loads(apt.get("photos_json") or "[]")
            elif isinstance(apt.get("photos_json"), list):
                photos = apt.get("photos_json")
        except Exception:
            pass
        first_photo = photos[0] if photos else "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800"

        # Inline button
        detail_url = f"{webapp_url}/?apt={apt['id']}"
        markup = {
            "inline_keyboard": [
                [
                    {"text": "🎯 Открыть на карте и разблокировать", "url": detail_url}
                ]
            ]
        }
        return caption, first_photo, markup

    def dispatch_pending_alerts(self, webapp_url: str = "http://localhost:5173") -> int:
        """Fetches unalerted listings and sends them to all subscribed users."""
        unalerted = db.get_unalerted_apartments(limit=10)
        if not unalerted:
            return 0

        subscribers = db.get_subscribers_for_alerts()
        if not subscribers and not self.is_mock:
            print("[*] No active subscribers with linked Telegram chat ID.")
            # Still mark as alerted so queue doesn't blow up
            db.mark_apartments_alerted([a["id"] for a in unalerted])
            return 0

        sent_count = 0
        alerted_ids = []

        for apt in unalerted:
            caption, photo, markup = self.format_apartment_alert(apt, webapp_url)
            
            # Send to subscribers (or stdout in mock mode)
            if self.is_mock:
                self.send_photo("mock_chat_id", photo, caption, markup)
                sent_count += 1
            else:
                for sub in subscribers:
                    chat_id = sub["telegram_chat_id"]
                    success = self.send_photo(chat_id, photo, caption, markup)
                    if success:
                        sent_count += 1
                        
            alerted_ids.append(apt["id"])

        db.mark_apartments_alerted(alerted_ids)
        print(f"[✓] Dispatched {sent_count} alerts for {len(alerted_ids)} apartments.")
        return sent_count

if __name__ == "__main__":
    bot = RealtyTelegramBot()
    print("Testing RealtyTelegramBot Mock Dispatch...")
    dispatched = bot.dispatch_pending_alerts()
    print("Dispatch finished. Alerts sent:", dispatched)
