#!/usr/bin/env python3
"""
Migrates all real estate listings across SofDom from external raw IDs (cian_*, avito_*, bezposr_*)
to strictly authoritative SofDom proprietary IDs: SD-1001, SD-1002, ..., SD-1170.

Updates:
1. backend/realty.db (apartments, unlocked_contacts, favorites)
2. frontend/src/data/offers.ts (VIPS & OFFERS)
3. admin/src/data/offers.ts (VIPS & OFFERS)
4. frontend/src/data/tomskApartments.ts (TOMSK_MAP_FALLBACK)
"""

import json
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_OFFERS_PATH = os.path.join(BASE_DIR, 'frontend', 'src', 'data', 'offers.ts')
ADMIN_OFFERS_PATH = os.path.join(BASE_DIR, 'admin', 'src', 'data', 'offers.ts')
TOMSK_MAP_PATH = os.path.join(BASE_DIR, 'frontend', 'src', 'data', 'tomskApartments.ts')
DB_PATH = os.path.join(BASE_DIR, 'backend', 'realty.db')

def migrate():
    print("1. Loading frontend offers...")
    with open(FRONTEND_OFFERS_PATH, 'r', encoding='utf-8') as f:
        text = f.read()

    vips_start = text.find('export const VIPS: VipOffer[] = [')
    vips_end = text.find('];', vips_start) + 1
    vips = json.loads(text[vips_start + len('export const VIPS: VipOffer[] = '):vips_end])

    offers_start = text.find('export const OFFERS: Offer[] = [')
    offers_end = text.rfind('];') + 1
    offers = json.loads(text[offers_start + len('export const OFFERS: Offer[] = '):offers_end])

    print(f"Loaded {len(offers)} offers and {len(vips)} VIPs.")

    # Generate permanent 1-to-1 mapping
    mapping = {}
    base_num = 1001
    for idx, o in enumerate(offers):
        old_id = o['id']
        new_id = f"SD-{base_num + idx}"
        mapping[old_id] = new_id

    # Update offers
    for idx, o in enumerate(offers):
        old_id = o['id']
        new_id = mapping[old_id]
        o['external_ref'] = old_id
        o['id'] = new_id

    # Update VIPs
    for idx, v in enumerate(vips):
        v['id'] = f"vip_{idx + 1}"
        old_ref = v.get('offer_ref')
        if old_ref in mapping:
            v['offer_ref'] = mapping[old_ref]
        elif v.get('id') in mapping:
            v['offer_ref'] = mapping[v['id']]

    # Write back frontend/src/data/offers.ts
    offers_ts_content = f"import {{ Offer, VipOffer }} from '../types';\n\nexport const VIPS: VipOffer[] = {json.dumps(vips, ensure_ascii=False, indent=2)};\n\nexport const OFFERS: Offer[] = {json.dumps(offers, ensure_ascii=False, indent=2)};\n"
    with open(FRONTEND_OFFERS_PATH, 'w', encoding='utf-8') as f:
        f.write(offers_ts_content)
    print(f"Updated {FRONTEND_OFFERS_PATH}")

    # Write back admin/src/data/offers.ts
    admin_offers_content = f"import {{ Offer, VipOffer }} from './types';\n\nexport const VIPS: VipOffer[] = {json.dumps(vips, ensure_ascii=False, indent=2)};\n\nexport const OFFERS: Offer[] = {json.dumps(offers, ensure_ascii=False, indent=2)};\n"
    with open(ADMIN_OFFERS_PATH, 'w', encoding='utf-8') as f:
        f.write(admin_offers_content)
    print(f"Updated {ADMIN_OFFERS_PATH}")

    # Update frontend/src/data/tomskApartments.ts
    with open(TOMSK_MAP_PATH, 'r', encoding='utf-8') as f:
        map_text = f.read()

    start = map_text.find('export const TOMSK_MAP_FALLBACK')
    start_brace = map_text.find('{', map_text.find('=', start))
    end_brace = map_text.rfind('};') + 1
    map_obj = json.loads(map_text[start_brace:end_brace])

    for apt in map_obj['apartments']:
        old_id = apt['id']
        if old_id in mapping:
            apt['id'] = mapping[old_id]

    map_ts_content = f"""import {{ MapApartment }} from '../services/mapService';

export const TOMSK_MAP_FALLBACK: {{
  count: number;
  center: {{ lat: number; lng: number }};
  districts: {{ district: string; count: number }}[];
  apartments: MapApartment[];
}} = {json.dumps(map_obj, ensure_ascii=False, indent=2)};
"""
    with open(TOMSK_MAP_PATH, 'w', encoding='utf-8') as f:
        f.write(map_ts_content)
    print(f"Updated {TOMSK_MAP_PATH}")

    # Update SQLite database
    print("Updating SQLite DB:", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Check if external_ref column exists in apartments
    c.execute("PRAGMA table_info(apartments)")
    cols = [col[1] for col in c.fetchall()]
    if 'external_ref' not in cols:
        c.execute("ALTER TABLE apartments ADD COLUMN external_ref TEXT")
        print("Added external_ref column to apartments table")

    # Update apartments records
    for old_id, new_id in mapping.items():
        c.execute("UPDATE apartments SET external_ref = ?, id = ? WHERE id = ?", (old_id, new_id, old_id))

    # Update unlocked_contacts
    for old_id, new_id in mapping.items():
        c.execute("UPDATE unlocked_contacts SET apartment_id = ? WHERE apartment_id = ?", (new_id, old_id))

    # Update favorites
    for old_id, new_id in mapping.items():
        c.execute("UPDATE favorites SET apartment_id = ? WHERE apartment_id = ?", (new_id, old_id))

    conn.commit()
    conn.close()
    print("SQLite DB migration complete! All 170 listings have proprietary SD-1001..SD-1170 IDs.")

if __name__ == '__main__':
    migrate()
