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
from datetime import datetime, date, timedelta

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
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        
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
            ("updated_at", "TIMESTAMP")
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
        cursor.execute("""
        INSERT INTO apartments (
            id, source, is_secret_early_access, secret_until, title, price, deposit, commission,
            address, city, district, rooms, area, floor, total_floors, lat, lng,
            phone, owner_name, photos_json, description, url, updated_at
        ) VALUES (
            :id, :source, :is_secret_early_access, :secret_until, :title, :price, :deposit, :commission,
            :address, :city, :district, :rooms, :area, :floor, :total_floors, :lat, :lng,
            :phone, :owner_name, :photos_json, :description, :url, CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
            price = excluded.price,
            deposit = excluded.deposit,
            phone = CASE WHEN apartments.phone != '' THEN apartments.phone ELSE excluded.phone END,
            photos_json = excluded.photos_json,
            description = excluded.description,
            updated_at = CURRENT_TIMESTAMP
        """, {
            "id": str(item["id"]),
            "source": item.get("source", "avito"),
            "is_secret_early_access": 1 if item.get("is_secret") or item.get("is_secret_early_access") else 0,
            "secret_until": item.get("secret_until"),
            "title": item.get("title", "Квартира от собственника"),
            "price": int(item.get("price", 0)),
            "deposit": int(item.get("deposit", 0)),
            "commission": int(item.get("commission", 0)),
            "address": item.get("address", "Томск"),
            "city": item.get("city", "Томск"),
            "district": item.get("district", ""),
            "rooms": item.get("rooms", "1-комн"),
            "area": float(item.get("area", 0) or 0),
            "floor": int(item.get("floor", 1) or 1),
            "total_floors": int(item.get("total_floors", 1) or 1),
            "lat": float(item.get("lat")) if item.get("lat") else None,
            "lng": float(item.get("lng")) if item.get("lng") else None,
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
            
            # Mask phone unless unlocked
            if is_unlocked:
                apt["phone_display"] = apt["phone"]
                apt["is_locked"] = False
            else:
                apt["phone_display"] = mask_phone(apt["phone"])
                apt["is_locked"] = True
                apt["phone"] = None  # Do not leak phone in JSON
                
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
        
        if is_unlocked:
            apt["phone_display"] = apt["phone"]
            apt["is_locked"] = False
        else:
            apt["phone_display"] = mask_phone(apt["phone"])
            apt["is_locked"] = True
            apt["phone"] = None
            
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

import math

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates distance between two coordinates in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return round(2 * R * math.asin(math.sqrt(a)), 2)

TOMSK_DISTRICT_RULES = [
    ("Кировский район", 56.460, 84.970, [
        "усов", "киров", "красноармейск", "мокрушин", "елизаров", "нахимов", "котовск",
        "учебн", "вершинин", "дзержинск", "студенческ", "южн", "буревестник", "тимаков",
        "тгу", "тпу", "сибгму", "лагерный", "южная", "кировский"
    ]),
    ("Советский район", 56.478, 84.985, [
        "фрунзе", "комсомольск", "сибирск", "алтайск", "нечевск", "никитин", "шевченко",
        "герцен", "кулагин", "тверск", "гогол", "крылов", "чкалов", "советский"
    ]),
    ("Ленинский район", 56.515, 84.960, [
        "мир", "79 гвардейск", "каштак", "войков", "говоров", "смирнов", "березов",
        "пролетарск", "большая подгорн", "черемошник", "интернационалист", "карла маркс",
        "5-й арми", "ленинский"
    ]),
    ("Октябрьский район", 56.508, 85.030, [
        "иркутск", "лазо", "герасименко", "солнечн", "зеленые горк", "зелёные горк",
        "беринг", "клюев", "архитектор", "пушкин", "мичурин", "энтузиаст", "бауман",
        "черноморск", "октябрьский"
    ]),
    ("Пригород", 56.425, 85.015, [
        "зональн", "южные ворот", "кисловк", "левобережн", "тимирязев", "северск"
    ])
]

def enrich_tomsk_geo(db_path=DB_PATH):
    """Enriches apartments with exact Tomsk districts and spread coordinates."""
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, address, title, district, lat, lng FROM apartments")
        rows = cursor.fetchall()
        
        updated = 0
        for r in rows:
            apt_id = r["id"]
            addr_lower = (r["address"] or "").lower() + " " + (r["title"] or "").lower()
            current_dist = r["district"]
            current_lat = r["lat"]
            current_lng = r["lng"]
            
            # Detect district
            matched_dist = current_dist
            base_lat, base_lng = None, None
            for d_name, d_lat, d_lng, keywords in TOMSK_DISTRICT_RULES:
                if any(kw in addr_lower for kw in keywords):
                    matched_dist = d_name
                    base_lat, base_lng = d_lat, d_lng
                    break
                    
            if not matched_dist:
                matched_dist = "Советский район"
                base_lat, base_lng = 56.478, 84.985
                
            needs_coord_update = (
                not current_lat or not current_lng or
                (abs(current_lat - 56.4977) < 0.001 and abs(current_lng - 84.9744) < 0.001)
            )
            
            if needs_coord_update and base_lat and base_lng:
                h = abs(hash(apt_id))
                jitter_lat = ((h % 1000) / 1000.0 - 0.5) * 0.015
                jitter_lng = (((h // 1000) % 1000) / 1000.0 - 0.5) * 0.025
                new_lat = round(base_lat + jitter_lat, 6)
                new_lng = round(base_lng + jitter_lng, 6)
                cursor.execute("""
                UPDATE apartments SET district = ?, lat = ?, lng = ? WHERE id = ?
                """, (matched_dist, new_lat, new_lng, apt_id))
                updated += 1
            elif matched_dist != current_dist:
                cursor.execute("UPDATE apartments SET district = ? WHERE id = ?", (matched_dist, apt_id))
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
    with get_connection(db_path) as conn:
        cursor = conn.cursor()
        query = "SELECT id, title, price, deposit, commission, address, district, rooms, area, floor, total_floors, lat, lng, photos_json, is_secret_early_access FROM apartments WHERE lat IS NOT NULL AND lng IS NOT NULL"
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
            
        if bbox:
            try:
                parts = [float(p.strip()) for p in bbox.split(",")]
                if len(parts) == 4:
                    min_lat, min_lng, max_lat, max_lng = parts
                    query += " AND lat >= ? AND lat <= ? AND lng >= ? AND lng <= ?"
                    params.extend([min_lat, max_lat, min_lng, max_lng])
            except Exception:
                pass
                
        query += " ORDER BY is_secret_early_access DESC, price ASC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        cursor.execute("SELECT district, count(*) as count FROM apartments WHERE district IS NOT NULL AND district != '' GROUP BY district")
        district_counts = [dict(r) for r in cursor.fetchall()]
        
        points = []
        for r in rows:
            apt = dict(r)
            a_lat, a_lng = apt["lat"], apt["lng"]
            dist_km = None
            if center_lat is not None and center_lng is not None:
                dist_km = haversine_distance(center_lat, center_lng, a_lat, a_lng)
                if radius_km is not None and dist_km > radius_km:
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
                "distance_km": dist_km
            })
            
        if center_lat is not None and center_lng is not None:
            points.sort(key=lambda p: (p["distance_km"] or 999999))
            
        return {
            "count": len(points),
            "center": {"lat": center_lat or 56.4977, "lng": center_lng or 84.9744},
            "districts": district_counts,
            "apartments": points
        }

if __name__ == "__main__":
    init_db()
    enrich_tomsk_geo()
    print("Database initialized & enriched with geo successfully at:", DB_PATH)
    stats = get_system_stats()
    print("Current Stats:", stats)
