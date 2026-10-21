#!/usr/bin/env python3
"""
main.py
FastAPI Production Backend for Realty Sniper (Tomsk).
Zero-cost local backend running on MacBook Air M5.
High-speed REST API with deterministic scraping, user auth,
tiered subscriptions, daily contact unlocking, and secret apartment alerts.
"""

import os
import json
from typing import Optional, List
from fastapi import FastAPI, Header, HTTPException, Query, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

import db
from scraper import RealtyScraper

DIRECTORY = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(
    title="Realty Sniper Tomsk API",
    description="Backend for direct owner rental apartments in Tomsk (Avito & Cian)",
    version="2.0.0"
)

# Enable CORS for any frontend (web UI, mobile app, local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database schema on startup
@app.on_event("startup")
def startup_event():
    db.init_db()

# --- Request / Response Models ---

class LoginRequest(BaseModel):
    phone: str
    name: Optional[str] = None

class UpgradeRequest(BaseModel):
    plan_code: str

# --- Helper: User Extraction from Header or Query ---

def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
) -> Optional[dict]:
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.replace("Bearer ", "").strip()
    elif token:
        auth_token = token.strip()
        
    if not auth_token:
        return None
    return db.get_user_by_token(auth_token)

def get_current_user_required(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
) -> dict:
    user = get_current_user_optional(authorization, token)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Требуется авторизация. Войдите по номеру телефона."
        )
    return user

# --- Auth Endpoints ---

@app.post("/api/auth/login")
def login(req: LoginRequest):
    """
    Log in or register with phone number only.
    No SMS or call verification required (zero paperwork, zero external costs).
    Automatically issues session token and 1 free contact trial.
    """
    if not req.phone or len(req.phone.strip()) < 6:
        raise HTTPException(status_code=400, detail="Укажите корректный номер телефона")
    
    user = db.get_or_create_user(req.phone, req.name)
    sub = db.get_user_subscription(user["id"])
    unlocked_ids = list(db.get_user_unlocked_ids(user["id"]))
    
    return {
        "success": True,
        "token": user["token"],
        "user": {
            "id": user["id"],
            "phone": user["phone"],
            "name": user["name"],
            "role": user["role"],
            "created_at": user["created_at"]
        },
        "subscription": sub,
        "unlocked_apartments": unlocked_ids
    }

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user_required)):
    """Returns current authenticated user profile, active plan, and daily limits."""
    sub = db.get_user_subscription(user["id"])
    unlocked_ids = list(db.get_user_unlocked_ids(user["id"]))
    favorites = list(db.get_user_favorite_ids(user["id"]))
    
    return {
        "user": {
            "id": user["id"],
            "phone": user["phone"],
            "name": user["name"],
            "role": user["role"]
        },
        "subscription": sub,
        "unlocked_apartments": unlocked_ids,
        "favorite_apartments": favorites
    }

# --- Apartments Endpoints ---

@app.get("/api/apartments/map")
def get_apartments_map(
    bbox: Optional[str] = Query(None, description="min_lat,min_lng,max_lat,max_lng"),
    lat: Optional[float] = Query(None, description="Широта пользователя (Где я стою)"),
    lng: Optional[float] = Query(None, description="Долгота пользователя (Где я стою)"),
    radius_km: Optional[float] = Query(None, description="Радиус поиска в км от точки"),
    district: Optional[str] = Query(None, description="Район Томска (Кировский, Советский, Ленинский, Октябрьский)"),
    rooms: Optional[str] = Query(None),
    price_min: Optional[int] = Query(None),
    price_max: Optional[int] = Query(None),
    is_secret_only: bool = False,
    limit: int = 250
):
    """
    Высокоскоростной Geo-эндпоинт для интерактивной карты.
    Возвращает метки цен (желтые бейджи), координаты, районы Томска и точное расстояние от пользователя.
    """
    return db.list_apartments_geo(
        bbox=bbox,
        center_lat=lat,
        center_lng=lng,
        radius_km=radius_km,
        district=district,
        rooms=rooms,
        price_min=price_min,
        price_max=price_max,
        is_secret_only=is_secret_only,
        limit=limit
    )

@app.get("/api/apartments")
def list_apartments(
    city: str = "Томск",
    rooms: Optional[str] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
    is_secret_only: bool = False,
    source: Optional[str] = None,
    sort: str = "newest",
    limit: int = 50,
    offset: int = 0,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Returns list of direct-owner apartments in Tomsk.
    Phone numbers are masked (+7 936 •••-••-••) unless unlocked by the current user.
    """
    user_id = user["id"] if user else None
    items = db.list_apartments(
        user_id=user_id,
        city=city,
        rooms=rooms,
        price_min=price_min,
        price_max=price_max,
        is_secret_only=is_secret_only,
        source=source,
        sort=sort,
        limit=limit,
        offset=offset
    )
    return {
        "city": city,
        "count": len(items),
        "apartments": items
    }

@app.get("/api/apartments/{apartment_id}")
def get_apartment_detail(
    apartment_id: str,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """Returns detailed apartment profile with gallery, description, and contact status."""
    user_id = user["id"] if user else None
    apt = db.get_apartment_by_id(apartment_id, user_id=user_id)
    if not apt:
        raise HTTPException(status_code=404, detail="Объявление не найдено")
    return apt

@app.post("/api/apartments/{apartment_id}/unlock")
def unlock_contact(
    apartment_id: str,
    user: dict = Depends(get_current_user_required)
):
    """
    Unlocks real owner contact for the authenticated user.
    Consumes 1 daily quota (or uses existing unlock with 0 cost).
    """
    res = db.unlock_apartment(user["id"], apartment_id)
    if not res.get("success"):
        raise HTTPException(
            status_code=403,
            detail=res
        )
    return res

@app.post("/api/apartments/{apartment_id}/favorite")
def toggle_fav(
    apartment_id: str,
    user: dict = Depends(get_current_user_required)
):
    """Toggles bookmark for this apartment."""
    is_fav = db.toggle_favorite(user["id"], apartment_id)
    return {"apartment_id": apartment_id, "is_favorite": is_fav}

@app.get("/api/favorites")
def get_favorites(user: dict = Depends(get_current_user_required)):
    """Returns list of bookmarked apartments for authenticated user."""
    fav_ids = db.get_user_favorite_ids(user["id"])
    apartments = []
    for apt_id in fav_ids:
        apt = db.get_apartment_by_id(apt_id, user_id=user["id"])
        if apt:
            apartments.append(apt)
    return {"favorites": apartments}

# --- Subscription Plans & Upgrades ---

@app.get("/api/subscriptions/plans")
def get_plans():
    """Returns active monetization tiers (Тест-Драйв, Снайпер, Семейный Pro)."""
    return {
        "plans": list(db.PLANS.values())
    }

@app.post("/api/subscriptions/upgrade")
def upgrade_subscription(
    req: UpgradeRequest,
    user: dict = Depends(get_current_user_required)
):
    """Instant plan upgrade / switcher (for testing, demo, or post-payment callback)."""
    try:
        sub = db.upgrade_user_subscription(user["id"], req.plan_code)
        return {
            "success": True,
            "message": f"Тариф успешно изменён на «{sub['plan_name']}»",
            "subscription": sub
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Scraper Sync & Metrics ---

@app.post("/api/sync")
def trigger_sync(background_tasks: BackgroundTasks):
    """Triggers live scraper synchronization for Tomsk in background."""
    def run_sync():
        scraper = RealtyScraper()
        scraper.sync_all()

    background_tasks.add_task(run_sync)
    return {
        "success": True,
        "message": "Синхронизация запущена в фоне. Томск (Авито + ЦИАН)."
    }

@app.post("/api/sync-now")
def trigger_sync_now():
    """Runs immediate synchronous scraper cycle for Tomsk."""
    scraper = RealtyScraper()
    result = scraper.sync_all()
    return result

@app.get("/api/stats")
def get_stats():
    """Returns live aggregator metrics."""
    return db.get_system_stats()

# --- Static Frontend Delivery ---

@app.api_route("/", methods=["GET", "HEAD"])
def serve_index():
    path = os.path.join(DIRECTORY, "index.html")
    if os.path.exists(path):
        return FileResponse(path)
    return {"status": "Realty Sniper API is running"}

@app.api_route("/demo", methods=["GET", "HEAD"])
def serve_demo():
    path = os.path.join(DIRECTORY, "realty_aggregator_demo.html")
    if os.path.exists(path):
        return FileResponse(path)
    return {"status": "Demo page not found"}

@app.api_route("/secret", methods=["GET", "HEAD"])
def serve_secret_report():
    path = os.path.join(DIRECTORY, "avito_secret_apartment_4326801484.html")
    if os.path.exists(path):
        return FileResponse(path)
    return {"status": "Secret report not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=False)
