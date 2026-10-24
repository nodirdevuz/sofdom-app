#!/usr/bin/env python3
"""
migrate_geo.py — make every listing's geolocation real and honestly labelled.

For each apartment, using ITS OWN address:
  - Cian with real source coords -> kept, re-labelled 'unknown' ('?'), geo_source='cian'
  - otherwise -> geocoded from its own address via Yandex -> geo_source='geocoded'
  - geocoding fails / out of region -> coordinates cleared (no fake point)

The Yandex key is read from backend/.env (YANDEX_GEOCODER_KEY). Live calls are
rate-limited and cached per address. Idempotent.

Usage:
    python3 migrate_geo.py [path/to/realty.db] [--dry-run]
"""
import os
import sys
import time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import db as dbmod
import geocode as geomod


def load_env(env_path):
    """Tiny .env loader (KEY=VALUE lines) into os.environ; no dependency."""
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def main() -> int:
    args = sys.argv[1:]
    dry = "--dry-run" in args
    paths = [a for a in args if not a.startswith("--")]
    db_path = paths[0] if paths else dbmod.DB_PATH

    load_env(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
    if not geomod.get_api_key():
        print("[geo-migration] ERROR: YANDEX_GEOCODER_KEY not set in backend/.env")
        return 1

    print(f"[geo-migration] target DB: {db_path}{'  (DRY RUN)' if dry else ''}")

    cache = {}
    stats = {"calls": 0}

    def geocoder(address):
        key = (address or "").strip().lower()
        if key in cache:
            return cache[key]
        time.sleep(1.0)  # be polite to the Yandex geocoder
        stats["calls"] += 1
        result = geomod.geocode_address(address)
        cache[key] = result
        return result

    if dry:
        # Only report what sources/coords exist, no writes, no network.
        import sqlite3
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT source, COUNT(*) n, SUM(CASE WHEN lat IS NOT NULL THEN 1 ELSE 0 END) wc FROM apartments GROUP BY source").fetchall()
        for r in rows:
            print(f"  {r['source']}: {r['n']} listings, {r['wc']} with coords")
        conn.close()
        return 0

    summary = dbmod.rebuild_geo(db_path, geocoder=geocoder)
    print(f"[geo-migration] {summary}")
    print(f"[geo-migration] live Yandex calls: {stats['calls']}")

    report = dbmod.check_photo_integrity(db_path)  # photos untouched; sanity only
    print(f"[geo-migration] photos still ok: {report['ok']}")
    print("[geo-migration] done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
