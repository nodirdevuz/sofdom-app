#!/usr/bin/env python3
"""
cross_matcher.py
Cross-Platform Listing Matcher for Realty Sniper.
Matches listings between Avito, Cian, and Bezposrednikov to deduplicate
and borrow phone numbers across platforms with 0 external API cost.
"""

import re
import sqlite3

def normalize_street_and_house(address_str: str) -> str:
    """Extracts core street name and house number from Russian address."""
    if not address_str:
        return ""
    addr = address_str.lower()
    # Remove common prefixes
    for prefix in [
        "россия", "томская область", "томская обл.", "г. томск", "томск", 
        "улица", "ул.", "проспект", "пр-т", "пер.", "переулок", "тракт", "мкр-н", "микрорайон",
        "д.", "дом", "р-н", "район", "пос.", "поселок", "село"
    ]:
        addr = addr.replace(prefix, " ")
    
    # Clean whitespace and punctuation except digits, letters, and slashes
    addr = re.sub(r'[^\w\s/]', ' ', addr)
    parts = addr.split()
    return " ".join(parts).strip()

def find_duplicate_match(target_apt: dict, db_path=None) -> dict:
    """
    Finds matching listing in another platform (e.g. matches Bezposrednikov to Avito/Cian).
    Returns matched apartment row dict or None.
    """
    import os
    if db_path is None:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "realty.db")

    norm_target = normalize_street_and_house(target_apt.get("address", ""))
    target_price = int(target_apt.get("price", 0))
    target_rooms = str(target_apt.get("rooms", ""))
    target_id = str(target_apt.get("id", ""))

    if not norm_target or target_price <= 0:
        return None

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Query listings with similar price (+- 1500) and different source
    price_min = target_price - 1500
    price_max = target_price + 1500

    cursor.execute("""
    SELECT * FROM apartments 
    WHERE id != ? 
      AND price BETWEEN ? AND ?
      AND phone != '' 
      AND phone NOT LIKE '%БезПосредников%'
    """, (target_id, price_min, price_max))

    candidates = [dict(r) for r in cursor.fetchall()]
    conn.close()

    for cand in candidates:
        norm_cand = normalize_street_and_house(cand.get("address", ""))
        
        # Check if key tokens overlap (street name + house number)
        target_tokens = set(norm_target.split())
        cand_tokens = set(norm_cand.split())
        
        # House number matching (any token containing digits)
        target_numbers = {t for t in target_tokens if any(c.isdigit() for c in t)}
        cand_numbers = {t for t in cand_tokens if any(c.isdigit() for c in t)}

        if target_numbers and cand_numbers and (target_numbers & cand_numbers):
            # Check street word overlap
            target_words = {t for t in target_tokens if not any(c.isdigit() for c in t) and len(t) > 3}
            cand_words = {t for t in cand_tokens if not any(c.isdigit() for c in t) and len(t) > 3}
            if target_words & cand_words:
                return cand

    return None

if __name__ == '__main__':
    sample = {
        "id": "bezposr_test",
        "address": "Томск, Ленинский р-н, ул. Войкова, 57",
        "price": 20000,
        "rooms": "3-комн"
    }
    match = find_duplicate_match(sample)
    print("Match result:", match["title"] if match else "No match found")
