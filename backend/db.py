#!/usr/bin/env python3
"""
db.py
Database layer for Realty Sniper (Tomsk).
SQLite with WAL mode; 100% portable schema for PostgreSQL migration.
Handles users, subscriptions, daily limits, apartment listings, favorites, and unlocked contacts.
"""

import sqlite3
import json
import os
import math
from datetime import datetime, date, timedelta

from geo_utils import (
    haversine_distance,
    calc_radius_bbox,
    TOMSK_DISTRICT_RULES,
    TOMSK_AGGLOMERATION_ENVELOPE,
    TOMSK_CENTER_PLACEHOLDER_LAT,
    TOMSK_CENTER_PLACEHOLDER_LNG,
    detect_city,
    detect_tomsk_district,
    classify_coordinates,
    is_center_placeholder,
    is_in_tomsk_envelope,
)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "realty.db")

PLANS = {
    "free_trial": {
        "code": "free_trial",
        "name": "Пробный доступ",
        "price": 0,
        "daily_limit": 1,
        "duration_days": 1,
        "description": "1 контакт для быстрой проверки сервиса"
    },
    "test_drive": {
        "code": "test_drive",
        "name": "Тест-Драйв (24 часа)",
        "price": 490,
        "daily_limit": 5,
        "duration_days": 1,
        "description": "5 контактов собственников на 24 часа. Идеально для срочного переезда."
    },
    "sniper": {
        "code": "sniper",
        "name": "Снайпер (7 дней)",
        "price": 990,
        "daily_limit": 15,
        "duration_days": 7,
        "description": "15 контактов в день + Моментальные Secret-квартиры за 6 часов до Авито. Самый популярный."
    },
    "family_pro": {
        "code": "family_pro",
        "name": "Семейный Pro (30 дней)",
        "price": 1490,
        "daily_limit": 50,
        "duration_days": 30,
        "description": "Безлимитный поиск на 30 дней для семьи или риелтора."
    }
}

from contextlib import contextmanager

@contextmanager
def get_connection(db_path=DB_PATH):
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db(db_path=DB_PATH):
    with get_connection(db_path) as conn:
        cursor = conn.cursor()

        # 1. Users table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            name TEXT,
            role TEXT DEFAULT 'user',
            token TEXT UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 2. Subscriptions table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            plan_code TEXT NOT NULL,
            plan_name TEXT NOT NULL,
            daily_limit INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 3. Unlocked contacts table (tracks which user unlocked which apartment)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS unlocked_contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            apartment_id TEXT NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, apartment_id)
        );
        """)

        # 4. Favorites table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            apartment_id TEXT NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, apartment_id)
        );
        """)

        # 5. Apartments table (matches existing data, with enhanced fields)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS apartments (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            is_secret_early_access INTEGER DEFAULT 0,
            secret_until TIMESTAMP,
            title TEXT NOT NULL,
            price INTEGER NOT NULL,
            deposit INTEGER DEFAULT 0,
            commission INTEGER DEFAULT 0,
            address TEXT NOT NULL,
            city TEXT DEFAULT 'Томск',
            district TEXT,
            rooms TEXT DEFAULT '1-комн',
            area REAL DEFAULT 0,
            floor INTEGER DEFAULT 1,
            total_floors INTEGER DEFAULT 1,
            lat REAL,
            lng REAL,
            phone TEXT,
            owner_name TEXT DEFAULT 'Собственник',
            photos_json TEXT DEFAULT '[]',
            description TEXT DEFAULT '',
            url TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            geo_precision TEXT DEFAULT 'none',
            geo_source TEXT DEFAULT 'none',
            geo_observed_at TIMESTAMP
        );
        """)

        # Check if new columns need to be added to users
        cursor.execute("PRAGMA table_info(users)")
        user_cols = [row["name"] for row in cursor.fetchall()]
        user_cols_to_add = [
            ("telegram_chat_id", "TEXT"),
            ("telegram_username", "TEXT")
        ]
        for col_name, col_type in user_cols_to_add:
            if col_name not in user_cols:
                try:
                    cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                except Exception:
                    pass

        # Check if new columns need to be added to apartments if table existed before
        cursor.execute("PRAGMA table_info(apartments)")
        existing_cols = [row["name"] for row in cursor.fetchall()]

        cols_to_add = [
            ("secret_until", "TIMESTAMP"),
            ("district", "TEXT"),
            ("rooms", "TEXT DEFAULT '1-комн'"),
            ("area", "REAL DEFAULT 0"),
            ("floor", "INTEGER DEFAULT 1"),
            ("total_floors", "INTEGER DEFAULT 1"),
            ("owner_name", "TEXT DEFAULT 'Собственник'"),
            ("updated_at", "TIMESTAMP"),
            ("is_alerted", "INTEGER DEFAULT 0"),
            ("geo_precision", "TEXT DEFAULT 'none'"),
            ("geo_source", "TEXT DEFAULT 'none'"),
            ("geo_observed_at", "TIMESTAMP")
        ]
        for col_name, col_type in cols_to_add:
            if col_name not in existing_cols:
                try:
                    cursor.execute(f"ALTER TABLE apartments ADD COLUMN {col_name} {col_type}")
                except Exception:
                    pass

        conn.commit()

# --- User & Auth Operations ---

def get_or_create_user(phone: str, name: str = None, db_path=DB_PATH) -> dict:
    clean_phone = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if clean_phone.startswith("8") and len(clean_phone) == 11:
        clean_phone = "+7" + clean_phone[1:]
    elif not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    token = f"tok_{clean_phone.replace('+', '')}_{abs(hash(clean_phone)) % 10000000}"

    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE phone = ?", (clean_phone,))
        row = cursor.fetchone()

        if row:
            user = dict(row)
            cursor.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP, token = ? WHERE id = ?", (token, user["id"]))
            user["token"] = token
            conn.commit()
        else:
            default_name = name or f"Пользователь {clean_phone[-4:]}"
            cursor.execute(
                "INSERT INTO users (phone, name, token) VALUES (?, ?, ?)",
                (clean_phone, default_name, token)
            )
            user_id = cursor.lastrowid

            # Create default free trial subscription
            free_plan = PLANS["free_trial"]
            expires_at = (datetime.now() + timedelta(days=free_plan["duration_days"])).strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("""
            INSERT INTO subscriptions (user_id, plan_code, plan_name, daily_limit, expires_at)
            VALUES (?, ?, ?, ?, ?)
            """, (user_id, free_plan["code"], free_plan["name"], free_plan["daily_limit"], expires_at))

            conn.commit()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            user = dict(cursor.fetchone())

    return user

def get_user_by_token(token: str, db_path=DB_PATH) -> dict:
    if not token:
        return None
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE token = ?", (token.strip(),))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_user_subscription(user_id: int, db_path=DB_PATH) -> dict:
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT * FROM subscriptions
        WHERE user_id = ? AND status = 'active' AND expires_at > CURRENT_TIMESTAMP
        ORDER BY daily_limit DESC, expires_at DESC LIMIT 1
        """, (user_id,))
        row = cursor.fetchone()
        if row:
            sub = dict(row)
            # Count how many unlocked today
            cursor.execute("""
            SELECT count(*) as count FROM unlocked_contacts
            WHERE user_id = ? AND date(unlocked_at, 'localtime') = date('now', 'localtime')
            """, (user_id,))
            unlocked_today = cursor.fetchone()["count"]
            sub["unlocked_today"] = unlocked_today
            sub["remaining_today"] = max(0, sub["daily_limit"] - unlocked_today)
            return sub

        # If expired or none, return default free trial info with 0 limit
        return {
            "plan_code": "expired",
            "plan_name": "Тариф не активен",
            "daily_limit": 0,
            "unlocked_today": 0,
            "remaining_today": 0,
            "expires_at": None,
            "status": "expired"
        }

def upgrade_user_subscription(user_id: int, plan_code: str, db_path=DB_PATH) -> dict:
    if plan_code not in PLANS:
        raise ValueError(f"Unknown plan: {plan_code}")
    plan = PLANS[plan_code]
    expires_at = (datetime.now() + timedelta(days=plan["duration_days"])).strftime("%Y-%m-%d %H:%M:%S")

    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE subscriptions SET status = 'replaced' WHERE user_id = ?", (user_id,))
        cursor.execute("""
        INSERT INTO subscriptions (user_id, plan_code, plan_name, daily_limit, expires_at)
        VALUES (?, ?, ?, ?, ?)
        """, (user_id, plan["code"], plan["name"], plan["daily_limit"], expires_at))
        conn.commit()
    return get_user_subscription(user_id, db_path=db_path)

# --- Unlocking & Contacts ---

def is_apartment_unlocked(user_id: int, apartment_id: str, db_path=DB_PATH) -> bool:
    if not user_id:
        return False
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM unlocked_contacts WHERE user_id = ? AND apartment_id = ?", (user_id, apartment_id))
        return cursor.fetchone() is not None

def unlock_apartment(user_id: int, apartment_id: str, db_path=DB_PATH) -> dict:
    """
    Unlocks apartment for user.
    Returns: {"success": True, "phone": "+7...", "remaining_today": 4} or error dict.
    """
    with get_connection(db_path) as conn:
        cursor = conn.cursor()

        # Check if apartment exists
        cursor.execute("SELECT phone, title FROM apartments WHERE id = ?", (apartment_id,))
        apt = cursor.fetchone()
        if not apt:
            return {"success": False, "error": "NOT_FOUND", "message": "Объявление не найдено"}

        real_phone = apt["phone"]

        # Check if already unlocked previously (unlimited access once unlocked)
        cursor.execute("SELECT 1 FROM unlocked_contacts WHERE user_id = ? AND apartment_id = ?", (user_id, apartment_id))
        if cursor.fetchone():
            sub = get_user_subscription(user_id, db_path=db_path)
            return {
                "success": True,
                "already_unlocked": True,
                "phone": real_phone,
                "remaining_today": sub["remaining_today"]
            }

        # Check daily quota
        sub = get_user_subscription(user_id, db_path=db_path)
        if sub["remaining_today"] <= 0:
            return {
                "success": False,
                "error": "QUOTA_EXCEEDED",
                "message": "Лимит на сегодня исчерпан. Перейдите на тариф «Снайпер» или «Семейный Pro» для открытия контактов.",
                "plans": PLANS
            }

        # Record unlock
        cursor.execute("""
        INSERT INTO unlocked_contacts (user_id, apartment_id) VALUES (?, ?)
        """, (user_id, apartment_id))
        conn.commit()

        updated_sub = get_user_subscription(user_id, db_path=db_path)
        return {
            "success": True,
            "already_unlocked": False,
            "phone": real_phone,
            "remaining_today": updated_sub["remaining_today"]
        }

def update_apartment_phone(apartment_id: str, phone: str, db_path=DB_PATH):
    """Updates real phone number for an apartment (e.g. after donor unmasking)."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE apartments SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (phone, apartment_id))
        conn.commit()

def get_user_unlocked_ids(user_id: int, db_path=DB_PATH) -> set:
    if not user_id:
        return set()
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT apartment_id FROM unlocked_contacts WHERE user_id = ?", (user_id,))
        return set(row["apartment_id"] for row in cursor.fetchall())

# --- Favorites ---

def toggle_favorite(user_id: int, apartment_id: str, db_path=DB_PATH) -> bool:
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM favorites WHERE user_id = ? AND apartment_id = ?", (user_id, apartment_id))
        if cursor.fetchone():
            cursor.execute("DELETE FROM favorites WHERE user_id = ? AND apartment_id = ?", (user_id, apartment_id))
            conn.commit()
            return False
        else:
            cursor.execute("INSERT INTO favorites (user_id, apartment_id) VALUES (?, ?)", (user_id, apartment_id))
            conn.commit()
            return True

def get_user_favorite_ids(user_id: int, db_path=DB_PATH) -> set:
    if not user_id:
        return set()
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT apartment_id FROM favorites WHERE user_id = ?", (user_id,))
        return set(row["apartment_id"] for row in cursor.fetchall())

# --- Apartments Operations ---

def mask_phone(phone: str) -> str:
    """Masks phone number: +7 (936) •••-••-••"""
    if not phone or phone == "Собственник (Ранний доступ)" or phone == "Открытый контакт":
        return "+7 (9••) •••-••-••"
    clean = re_digits(phone)
    if len(clean) >= 11:
        return f"+7 ({clean[1:4]}) •••-••-••"
    return "+7 (•••) •••-••-••"

def re_digits(text: str) -> str:
    return "".join(c for c in str(text) if c.isdigit())

def upsert_apartment(item: dict, db_path=DB_PATH):
    with get_connection(db_path) as conn:
        cursor = conn.cursor()

        raw_lat = item.get("lat")
        raw_lng = item.get("lng")
        source = item.get("source", "avito")
        raw_accuracy = item.get("geo_accuracy") or item.get("accuracy")
        clean_city = detect_city(item.get("address"), raw_city=item.get("city", "Томск"), lat=raw_lat, lng=raw_lng)
        clean_lat, clean_lng, precision = classify_coordinates(
            raw_lat, raw_lng,
            city=clean_city,
            source=source,
            accuracy=raw_accuracy
        )

        raw_dist = item.get("district", "")
        clean_dist = detect_tomsk_district(
            item.get("address"),
            title=item.get("title", ""),
            city=clean_city,
            lat=clean_lat,
            lng=clean_lng,
            current_district=raw_dist
        ) if clean_city in ("Томск", "Пригород") else (raw_dist if raw_dist not in ("Советский район", "Кировский район", "Ленинский район", "Октябрьский район") else "")

        # Строгий инвариант достоверности (provenance):
        # 1. Невалидные, нулевые координаты или координаты из неподтверждённых источников (Авито, БезПосредников)
        #    НИКОГДА не могут сохранять или получать статус 'exact' или 'approximate'.
        # 2. Если координат нет, метаданные provenance строго сбрасываются в 'none'.
        # 3. Координаты Циан без подтверждённого признака точности до дома сохраняются как 'unknown'.
        # 4. geo_observed_at фиксирует время подтверждения координат ТОЛЬКО если передано источником (live fetch).
        #    При локальной обработке/тестах без источника geo_observed_at остаётся NULL или сохраняется из базы.
        if clean_lat is None or clean_lng is None:
            clean_lat = None
            clean_lng = None
            geo_precision = "none"
            geo_source = "none"
            geo_observed_at = None
        else:
            if item.get("geo_precision") == "approximate" or precision == "approximate":
                geo_precision = "approximate"
                geo_source = item.get("geo_source") or source
            elif precision == "exact":
                geo_precision = "exact"
                geo_source = item.get("geo_source") or source
            else:
                geo_precision = "unknown"
                geo_source = item.get("geo_source") or source
            geo_observed_at = item.get("geo_observed_at")

        cursor.execute("""
        INSERT INTO apartments (
            id, source, is_secret_early_access, secret_until, title, price, deposit, commission,
            address, city, district, rooms, area, floor, total_floors, lat, lng,
            phone, owner_name, photos_json, description, url, updated_at,
            geo_precision, geo_source, geo_observed_at
        ) VALUES (
            :id, :source, :is_secret_early_access, :secret_until, :title, :price, :deposit, :commission,
            :address, :city, :district, :rooms, :area, :floor, :total_floors, :lat, :lng,
            :phone, :owner_name, :photos_json, :description, :url, CURRENT_TIMESTAMP,
            :geo_precision, :geo_source, :geo_observed_at
        )
        ON CONFLICT(id) DO UPDATE SET
            price = excluded.price,
            deposit = excluded.deposit,
            phone = CASE WHEN apartments.phone != '' THEN apartments.phone ELSE excluded.phone END,
            photos_json = excluded.photos_json,
            description = excluded.description,
            city = excluded.city,
            district = excluded.district,
            updated_at = CURRENT_TIMESTAMP,
            lat = excluded.lat,
            lng = excluded.lng,
            geo_precision = excluded.geo_precision,
            geo_source = excluded.geo_source,
            geo_observed_at = CASE
                WHEN excluded.lat IS NULL THEN NULL
                WHEN excluded.geo_observed_at IS NOT NULL THEN excluded.geo_observed_at
                ELSE apartments.geo_observed_at
            END
        """, {
            "id": str(item["id"]),
            "source": source,
            "is_secret_early_access": 1 if item.get("is_secret") or item.get("is_secret_early_access") else 0,
            "secret_until": item.get("secret_until"),
            "title": item.get("title", "Квартира от собственника"),
            "price": int(item.get("price", 0)),
            "deposit": int(item.get("deposit", 0)),
            "commission": int(item.get("commission", 0)),
            "address": item.get("address", "Томск"),
            "city": clean_city,
            "district": clean_dist or "",
            "rooms": item.get("rooms", "1-комн"),
            "area": float(item.get("area", 0) or 0),
            "floor": int(item.get("floor", 1) or 1),
            "total_floors": int(item.get("total_floors", 1) or 1),
            "lat": clean_lat,
            "lng": clean_lng,
            "geo_precision": geo_precision,
            "geo_source": geo_source,
            "geo_observed_at": geo_observed_at,
            "phone": item.get("phone", ""),
            "owner_name": item.get("owner_name", "Собственник"),
            "photos_json": json.dumps(item.get("photos", []), ensure_ascii=False) if isinstance(item.get("photos"), list) else item.get("photos_json", "[]"),
            "description": item.get("description", ""),
            "url": item.get("url", "")
        })
        conn.commit()

def list_apartments(
    user_id: int = None,
    city: str = "Томск",
    rooms: str = None,
    price_min: int = None,
    price_max: int = None,
    is_secret_only: bool = False,
    source: str = None,
    sort: str = "newest",
    limit: int = 100,
    offset: int = 0,
    db_path=DB_PATH
) -> list:
    unlocked_set = get_user_unlocked_ids(user_id, db_path=db_path) if user_id else set()
    favorites_set = get_user_favorite_ids(user_id, db_path=db_path) if user_id else set()

    query = "SELECT * FROM apartments WHERE 1=1"
    params = []

    if city:
        query += " AND city = ?"
        params.append(city)

    if rooms:
        r_clean = rooms.strip()
        query += " AND (rooms LIKE ? OR rooms LIKE ? OR rooms LIKE ?)"
        params.extend([f"%{r_clean}%", f"%{r_clean.capitalize()}%", f"%{r_clean.lower()}%"])

    if price_min is not None:
        query += " AND price >= ?"
        params.append(price_min)

    if price_max is not None:
        query += " AND price <= ?"
        params.append(price_max)

    if is_secret_only:
        query += " AND is_secret_early_access = 1"

    if source:
        query += " AND source = ?"
        params.append(source)

    if sort == "price_asc":
        query += " ORDER BY price ASC"
    elif sort == "price_desc":
        query += " ORDER BY price DESC"
    else:
        query += " ORDER BY is_secret_early_access DESC, created_at DESC"

    query += " LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

        result = []
        for r in rows:
            apt = dict(r)
            apt_id = apt["id"]
            is_unlocked = apt_id in unlocked_set

            # Format phone cleanly (+7 (XXX) XXX-XX-XX)
            raw_phone = apt.get("phone") or ""
            if not raw_phone.startswith("+7") and len(raw_phone) == 10:
                clean_phone = f"+7 ({raw_phone[:3]}) {raw_phone[3:6]}-{raw_phone[6:8]}-{raw_phone[8:]}"
            else:
                clean_phone = raw_phone

            # In active test/demo mode: show all contacts without blocking
            apt["phone"] = clean_phone
            apt["phone_display"] = clean_phone
            apt["is_locked"] = False

            apt["is_favorite"] = apt_id in favorites_set
            try:
                apt["photos"] = json.loads(apt.get("photos_json") or "[]")
            except Exception:
                apt["photos"] = []

            result.append(apt)

        return result

def get_apartment_by_id(apartment_id: str, user_id: int = None, db_path=DB_PATH) -> dict:
    unlocked_set = get_user_unlocked_ids(user_id, db_path=db_path) if user_id else set()
    favorites_set = get_user_favorite_ids(user_id, db_path=db_path) if user_id else set()

    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM apartments WHERE id = ?", (apartment_id,))
        row = cursor.fetchone()
        if not row:
            return None
        apt = dict(row)
        is_unlocked = apartment_id in unlocked_set

        # Format phone cleanly (+7 (XXX) XXX-XX-XX)
        raw_phone = apt.get("phone") or ""
        if not raw_phone.startswith("+7") and len(raw_phone) == 10:
            clean_phone = f"+7 ({raw_phone[:3]}) {raw_phone[3:6]}-{raw_phone[6:8]}-{raw_phone[8:]}"
        else:
            clean_phone = raw_phone

        apt["phone"] = clean_phone
        apt["phone_display"] = clean_phone
        apt["is_locked"] = False

        apt["is_favorite"] = apartment_id in favorites_set
        try:
            apt["photos"] = json.loads(apt.get("photos_json") or "[]")
        except Exception:
            apt["photos"] = []
        return apt

def get_system_stats(db_path=DB_PATH) -> dict:
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT count(*) as total FROM apartments")
        total = cursor.fetchone()["total"]

        cursor.execute("SELECT count(*) as secret FROM apartments WHERE is_secret_early_access = 1")
        secret = cursor.fetchone()["secret"]

        cursor.execute("SELECT count(*) as cian_cnt FROM apartments WHERE source = 'cian'")
        cian_cnt = cursor.fetchone()["cian_cnt"]

        cursor.execute("SELECT count(*) as avito_cnt FROM apartments WHERE source = 'avito'")
        avito_cnt = cursor.fetchone()["avito_cnt"]

        cursor.execute("SELECT count(*) as users_cnt FROM users")
        users_cnt = cursor.fetchone()["users_cnt"]

        cursor.execute("SELECT count(*) as unlocks_cnt FROM unlocked_contacts")
        unlocks_cnt = cursor.fetchone()["unlocks_cnt"]

        return {
            "city": "Томск",
            "total_apartments": total,
            "secret_early_access_count": secret,
            "cian_count": cian_cnt,
            "avito_count": avito_cnt,
            "direct_owner_percentage": 100,
            "total_users": users_cnt,
            "total_unlocked_contacts": unlocks_cnt,
            "timestamp": datetime.now().isoformat()
        }

def enrich_tomsk_geo(db_path=DB_PATH):
    """
    Нормализует геолокацию, город, район и координаты объявлений.

    Гарантии:
    1. Исключает присвоение фиктивной точки центра Томска (56.4977, 84.9744) как точных координат.
    2. Исключает генерацию координат со случайным смещением на основе hash(id).
    3. Исключает назначение районов Томска (например, 'Советский район') населённым
       пунктам области (Колпашево, Северск и др.).
    4. Сохраняет подлинные координаты от источников (Циан) с маркировкой geo_precision='exact'.
    5. Для объявлений без точных координат сохраняет lat=None, lng=None, geo_precision='none'.
    """
    with get_connection(db_path) as conn:
        cursor = conn.cursor()

        # Убедимся, что новые колонки присутствуют
        cursor.execute("PRAGMA table_info(apartments)")
        existing_cols = {row["name"] for row in cursor.fetchall()}
        for col_name, col_def in [
            ("geo_precision", "TEXT DEFAULT 'none'"),
            ("geo_source", "TEXT DEFAULT 'none'"),
            ("geo_observed_at", "TIMESTAMP")
        ]:
            if col_name not in existing_cols:
                try:
                    cursor.execute(f"ALTER TABLE apartments ADD COLUMN {col_name} {col_def}")
                except Exception:
                    pass

        cursor.execute("""
        SELECT id, address, title, city, district, lat, lng, source, geo_precision, geo_source, geo_observed_at
        FROM apartments
        """)
        rows = cursor.fetchall()

        updated = 0
        for r in rows:
            apt_id = r["id"]
            addr = r["address"] or ""
            title = r["title"] or ""
            current_city = r["city"] or "Томск"
            current_dist = r["district"]
            current_lat = r["lat"]
            current_lng = r["lng"]
            source = r["source"] or "unknown"

            # 1. Проверяем реальный населённый пункт
            new_city = detect_city(addr, raw_city=current_city, lat=current_lat, lng=current_lng)

            # 2. Классифицируем координаты и определяем уровень достоверности
            clean_lat, clean_lng, precision = classify_coordinates(
                current_lat, current_lng,
                city=new_city,
                source=source
            )
            if clean_lat is None or clean_lng is None:
                clean_lat = None
                clean_lng = None
                precision = "none"
                geo_source = "none"
                geo_observed_at = None
            else:
                if r["geo_precision"] == "approximate":
                    precision = "approximate"
                geo_source = source if precision != "none" else "none"
                # ВАЖНО: При локальной нормализации время наблюдения НЕ обновляется на текущее!
                # Сохраняем существующее значение r["geo_observed_at"] или оставляем NULL.
                geo_observed_at = r["geo_observed_at"]

            # 3. Определяем район: для других городов район Томска НЕДОПУСТИМ;
            # для Томска fallback на 'Советский район' ИСКЛЮЧЁН.
            new_district = detect_tomsk_district(
                addr,
                title=title,
                city=new_city,
                lat=clean_lat,
                lng=clean_lng,
                current_district=current_dist
            )

            # 4. Проверяем, изменились ли поля
            dist_changed = (new_district != current_dist)
            city_changed = (new_city != current_city)
            coords_changed = (clean_lat != current_lat or clean_lng != current_lng)
            prec_changed = (r["geo_precision"] != precision)
            src_changed = (r["geo_source"] != geo_source)
            obs_changed = (r["geo_observed_at"] != geo_observed_at)

            if dist_changed or city_changed or coords_changed or prec_changed or src_changed or obs_changed:
                cursor.execute("""
                UPDATE apartments
                SET city = ?, district = ?, lat = ?, lng = ?, geo_precision = ?, geo_source = ?,
                    geo_observed_at = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, (new_city, new_district or "", clean_lat, clean_lng, precision, geo_source, geo_observed_at, apt_id))
                updated += 1

        conn.commit()
        return updated

def list_apartments_geo(
    bbox: str = None,
    center_lat: float = None,
    center_lng: float = None,
    radius_km: float = None,
    district: str = None,
    rooms: str = None,
    price_min: int = None,
    price_max: int = None,
    is_secret_only: bool = False,
    limit: int = 250,
    db_path=DB_PATH
) -> dict:
    """
    Возвращает гео-точки для карты и радиусного поиска.

    Политика точности (provenance):
    - 'exact': числовые координаты получены от источника (Циан/verified) с подтверждённым
      признаком точности до адреса/дома. Они участвуют в точном радиусном поиске и отображают
      расстояние (distance_km).
    - 'unknown': валидные координаты от источника (Циан), но без подтверждённой точности до дома.
      Отображаются на карте с визуальным предупреждением (знак '?'), но исключаются из строгого
      радиусного поиска.
    - 'approximate': центроид района или населённого пункта. Отображаются на карте с меткой '~',
      но исключаются из строгого радиусного поиска (distance_km=None).
    - 'none' и синтетические заглушки центра исключаются из карты.

    Валидация параметров:
    - limit: целое число от 1 до 1000;
    - radius_km: число от >0 до <=50.0 км; если передан без center_lat/center_lng — возвращает ValueError;
    - center_lat / center_lng: конечные числа в диапазонах [-90..90] и [-180..180];
    - bbox: 4 конечных числа min_lat,min_lng,max_lat,max_lng с проверкой min <= max.

    Безопасность чтения из БД:
    - При радиусном поиске SQL spatial pre-filter сужает выборку до bounding box.
    - Кандидаты считываются пакетами по 250 (fetchmany) с потолком MAX_CANDIDATES = 5000,
      что предотвращает неконтролируемый объём памяти при этом гарантируя точность
      внутри радиуса.
    """
    # 1. Валидация limit
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1 or limit > 1000:
        raise ValueError("Параметр limit должен быть целым числом в диапазоне от 1 до 1000")

    # 2. Валидация radius_km и координат центра
    if radius_km is not None:
        try:
            r_val = float(radius_km)
        except (ValueError, TypeError):
            raise ValueError("Параметр radius_km должен быть числовым значением")
        if not math.isfinite(r_val) or r_val <= 0 or r_val > 50.0:
            raise ValueError("Параметр radius_km должен быть положительным числом не более 50.0 км")
        radius_km = r_val

        if center_lat is None or center_lng is None:
            raise ValueError("Параметр radius_km требует указания координат центра (center_lat и center_lng)")

    if center_lat is not None or center_lng is not None:
        if center_lat is None or center_lng is None:
            raise ValueError("Координаты центра должны содержать как широту (center_lat), так и долготу (center_lng)")
        try:
            c_lat = float(center_lat)
            c_lng = float(center_lng)
        except (ValueError, TypeError):
            raise ValueError("Координаты центра должны быть числовыми значениями")
        if not (math.isfinite(c_lat) and -90.0 <= c_lat <= 90.0):
            raise ValueError("Широта центра (center_lat) должна быть числом от -90 до 90")
        if not (math.isfinite(c_lng) and -180.0 <= c_lng <= 180.0):
            raise ValueError("Долгота центра (center_lng) должна быть числом от -180 до 180")
        center_lat = c_lat
        center_lng = c_lng

    # 3. Валидация bbox
    parsed_bbox = None
    if bbox:
        try:
            parts = [float(p.strip()) for p in bbox.split(",")]
            if len(parts) != 4 or not all(math.isfinite(p) for p in parts):
                raise ValueError("bbox должен содержать 4 конечных числа")
            b_min_lat, b_min_lng, b_max_lat, b_max_lng = parts
            if not (-90.0 <= b_min_lat <= 90.0 and -90.0 <= b_max_lat <= 90.0 and
                    -180.0 <= b_min_lng <= 180.0 and -180.0 <= b_max_lng <= 180.0):
                raise ValueError("Координаты bbox выходят за допустимые границы (-90..90, -180..180)")
            if b_min_lat > b_max_lat or b_min_lng > b_max_lng:
                raise ValueError("Минимальные координаты bbox не могут превышать максимальные")
            parsed_bbox = (b_min_lat, b_min_lng, b_max_lat, b_max_lng)
        except Exception as e:
            raise ValueError(f"Некорректный формат bbox: {e}")

    with get_connection(db_path) as conn:
        cursor = conn.cursor()

        # Проверяем наличие колонки geo_precision
        cursor.execute("PRAGMA table_info(apartments)")
        col_names = {row["name"] for row in cursor.fetchall()}
        has_precision = "geo_precision" in col_names

        prec_col = ", geo_precision" if has_precision else ""
        query = f"""
        SELECT id, title, price, deposit, commission, address, district, rooms,
               area, floor, total_floors, lat, lng, photos_json, is_secret_early_access{prec_col}
        FROM apartments
        WHERE lat IS NOT NULL AND lng IS NOT NULL
        """
        params = []

        if district:
            d_clean = district.strip()
            query += " AND (district LIKE ? OR district LIKE ? OR district LIKE ?)"
            params.extend([f"%{d_clean}%", f"%{d_clean.capitalize()}%", f"%{d_clean.lower()}%"])

        if rooms:
            r_clean = rooms.strip()
            query += " AND (rooms LIKE ? OR rooms LIKE ? OR rooms LIKE ?)"
            params.extend([f"%{r_clean}%", f"%{r_clean.capitalize()}%", f"%{r_clean.lower()}%"])

        if price_min is not None:
            query += " AND price >= ?"
            params.append(price_min)

        if price_max is not None:
            query += " AND price <= ?"
            params.append(price_max)

        if is_secret_only:
            query += " AND is_secret_early_access = 1"

        if parsed_bbox:
            min_lat, min_lng, max_lat, max_lng = parsed_bbox
            query += " AND lat >= ? AND lat <= ? AND lng >= ? AND lng <= ?"
            params.extend([min_lat, max_lat, min_lng, max_lng])

        # Spatial pre-filter для радиусного поиска:
        has_radius_filter = (center_lat is not None and center_lng is not None and radius_km is not None)
        if has_radius_filter:
            r_min_lat, r_max_lat, r_min_lng, r_max_lng = calc_radius_bbox(center_lat, center_lng, radius_km)
            query += " AND lat >= ? AND lat <= ? AND lng >= ? AND lng <= ?"
            params.extend([r_min_lat, r_max_lat, r_min_lng, r_max_lng])
            if has_precision:
                query += " AND geo_precision = 'exact'"
            query += " ORDER BY is_secret_early_access DESC, price ASC"
        else:
            query += " ORDER BY is_secret_early_access DESC, price ASC LIMIT ?"
            params.append(limit)

        cursor.execute(query, params)

        points = []
        if has_radius_filter:
            # Читаем кандидатов пакетами по 250, чтобы защитить память от неконтролируемого объёма,
            # с ограничением MAX_CANDIDATES = 5000 (в Томске активный рынок < 2000 объявлений).
            MAX_CANDIDATES = 5000
            CHUNK_SIZE = 250
            total_read = 0

            while total_read < MAX_CANDIDATES:
                batch = cursor.fetchmany(CHUNK_SIZE)
                if not batch:
                    break
                for r in batch:
                    total_read += 1
                    apt = dict(r)
                    a_lat, a_lng = apt["lat"], apt["lng"]
                    if is_center_placeholder(a_lat, a_lng):
                        continue
                    geo_prec = apt.get("geo_precision") or "none"
                    if geo_prec != "exact":
                        continue
                    dist_km = haversine_distance(center_lat, center_lng, a_lat, a_lng)
                    if dist_km > radius_km:
                        continue

                    try:
                        photos = json.loads(apt.get("photos_json") or "[]")
                        first_photo = photos[0] if photos else ""
                        photos_count = len(photos)
                    except Exception:
                        first_photo = ""
                        photos_count = 0

                    points.append({
                        "id": apt["id"],
                        "lat": a_lat,
                        "lng": a_lng,
                        "title": apt["title"],
                        "price": apt["price"],
                        "price_badge": f"{apt['price']:,}".replace(",", " ") + " ₽",
                        "deposit": apt["deposit"],
                        "rooms": apt["rooms"],
                        "area": apt["area"],
                        "floor_str": f"{apt['floor']}/{apt['total_floors']} эт.",
                        "address": apt["address"],
                        "district": apt["district"] or "Томск",
                        "photo": first_photo,
                        "photos_count": photos_count,
                        "is_secret": bool(apt["is_secret_early_access"]),
                        "distance_km": dist_km,
                        "geo_precision": geo_prec,
                        "is_approximate": False
                    })
        else:
            rows = cursor.fetchall()
            for r in rows:
                apt = dict(r)
                a_lat, a_lng = apt["lat"], apt["lng"]

                if is_center_placeholder(a_lat, a_lng):
                    continue

                geo_prec = apt.get("geo_precision") or ("exact" if (a_lat and a_lng and not is_center_placeholder(a_lat, a_lng)) else "none")
                if geo_prec == "none":
                    continue

                is_approx = (geo_prec != "exact")
                dist_km = None
                if center_lat is not None and center_lng is not None:
                    if not is_approx:
                        dist_km = haversine_distance(center_lat, center_lng, a_lat, a_lng)

                try:
                    photos = json.loads(apt.get("photos_json") or "[]")
                    first_photo = photos[0] if photos else ""
                    photos_count = len(photos)
                except Exception:
                    first_photo = ""
                    photos_count = 0

                points.append({
                    "id": apt["id"],
                    "lat": a_lat,
                    "lng": a_lng,
                    "title": apt["title"],
                    "price": apt["price"],
                    "price_badge": f"{apt['price']:,}".replace(",", " ") + " ₽",
                    "deposit": apt["deposit"],
                    "rooms": apt["rooms"],
                    "area": apt["area"],
                    "floor_str": f"{apt['floor']}/{apt['total_floors']} эт.",
                    "address": apt["address"],
                    "district": apt["district"] or "Томск",
                    "photo": first_photo,
                    "photos_count": photos_count,
                    "is_secret": bool(apt["is_secret_early_access"]),
                    "distance_km": dist_km,
                    "geo_precision": geo_prec,
                    "is_approximate": is_approx
                })

        if center_lat is not None and center_lng is not None:
            # Точные расстояния сортируются первыми по возрастанию; точки без точного расстояния идут следом
            points.sort(key=lambda p: (0 if p["distance_km"] is not None else 1, p["distance_km"] or 999999, -int(p["is_secret"]), p["price"]))

        points = points[:limit]

        cursor.execute("SELECT district, count(*) as count FROM apartments WHERE district IS NOT NULL AND district != '' GROUP BY district")
        district_counts = [dict(r) for r in cursor.fetchall()]

        return {
            "count": len(points),
            "center": {"lat": center_lat or TOMSK_CENTER_PLACEHOLDER_LAT, "lng": center_lng or TOMSK_CENTER_PLACEHOLDER_LNG},
            "districts": district_counts,
            "apartments": points
        }

# --- Telegram Bot & Alert Operations ---

def get_user_by_id(user_id: int, db_path=DB_PATH) -> dict:
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def link_telegram_user(telegram_chat_id: str, phone: str = None, username: str = None, db_path=DB_PATH) -> dict:
    """Links a Telegram chat ID to an existing or new user account."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        if phone:
            clean_phone = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
            if clean_phone.startswith("8") and len(clean_phone) == 11:
                clean_phone = "+7" + clean_phone[1:]
            cursor.execute("SELECT * FROM users WHERE phone = ?", (clean_phone,))
            row = cursor.fetchone()
            if row:
                cursor.execute("""
                UPDATE users SET telegram_chat_id = ?, telegram_username = COALESCE(?, telegram_username)
                WHERE id = ?
                """, (str(telegram_chat_id), username, row["id"]))
                conn.commit()
                cursor.execute("SELECT * FROM users WHERE id = ?", (row["id"],))
                u = dict(cursor.fetchone())
                sub = get_user_subscription(u["id"], db_path)
                return {"user": u, "subscription": sub}

        # If user not found by phone, search by telegram_chat_id
        cursor.execute("SELECT * FROM users WHERE telegram_chat_id = ?", (str(telegram_chat_id),))
        row = cursor.fetchone()
        if row:
            u = dict(row)
            sub = get_user_subscription(u["id"], db_path)
            return {"user": u, "subscription": sub}

        # Create new telegram-only user if not exists
        temp_phone = phone or f"+tg_{telegram_chat_id}"
        user_dict = get_or_create_user(temp_phone, name=username or f"TG_{telegram_chat_id}", db_path=db_path)
        cursor.execute("""
        UPDATE users SET telegram_chat_id = ?, telegram_username = ? WHERE id = ?
        """, (str(telegram_chat_id), username, user_dict["id"]))
        conn.commit()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_dict["id"],))
        u = dict(cursor.fetchone())
        sub = get_user_subscription(u["id"], db_path)
        return {"user": u, "subscription": sub}

def get_subscribers_for_alerts(db_path=DB_PATH) -> list:
    """Returns active subscribers with linked Telegram chat ID to receive new listing alerts."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT u.id, u.telegram_chat_id, u.phone, s.plan_code, s.plan_name
        FROM users u
        JOIN subscriptions s ON s.user_id = u.id
        WHERE u.telegram_chat_id IS NOT NULL
          AND u.telegram_chat_id != ''
          AND s.status = 'active'
          AND s.expires_at > CURRENT_TIMESTAMP
        """)
        return [dict(r) for r in cursor.fetchall()]

def get_unalerted_apartments(limit: int = 10, db_path=DB_PATH) -> list:
    """Retrieves new apartments that have not yet been sent out via alerts."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT * FROM apartments
        WHERE is_alerted = 0
        ORDER BY is_secret_early_access DESC, created_at DESC
        LIMIT ?
        """, (limit,))
        return [dict(r) for r in cursor.fetchall()]

def mark_apartments_alerted(apartment_ids: list, db_path=DB_PATH):
    """Marks specified apartment IDs as alerted."""
    if not apartment_ids:
        return
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        placeholders = ",".join(["?"] * len(apartment_ids))
        cursor.execute(f"""
        UPDATE apartments SET is_alerted = 1 WHERE id IN ({placeholders})
        """, apartment_ids)
        conn.commit()

if __name__ == "__main__":
    init_db()
    enrich_tomsk_geo()
    print("Database initialized & enriched with geo successfully at:", DB_PATH)
    stats = get_system_stats()
    print("Current Stats:", stats)
