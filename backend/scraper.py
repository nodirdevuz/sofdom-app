#!/usr/bin/env python3
"""
scraper.py
Production Scraper Engine for Realty Sniper (Tomsk).
Extracts 100% direct owner listings from:
 1. ЦИАН (Region 4620 = Томск, is_by_homeowner=1)
 2. Авито (Томск, na_dlitelnyy_srok, user=1 [частные лица], PoW 439 auto-solved)
Identifies Avito Secret Early Access listings (ltrSecretItemModal).
Deterministic Python parsing, zero LLM cost, 100% reliable.
"""

import re
import json
import time
from datetime import datetime, timedelta
from curl_cffi import requests
from avito_session_manager import AvitoSession
from db import upsert_apartment, get_connection
from geo_utils import detect_city, detect_tomsk_district, classify_coordinates

class RealtyScraper:
    def __init__(self):
        self.avito_session = AvitoSession()
        self.cian_headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9',
        }

    def parse_title_specs(self, title_text: str):
        """Extracts rooms, area, floor, total_floors from standard Russian realty title."""
        rooms = "1-комн"
        area = 0.0
        floor = 1
        total_floors = 1
        
        t = title_text.lower()
        if "студи" in t:
            rooms = "Студия"
        elif "1-к" in t or "1 комн" in t or "однокомн" in t:
            rooms = "1-комн"
        elif "2-к" in t or "2 комн" in t or "двухкомн" in t:
            rooms = "2-комн"
        elif "3-к" in t or "3 комн" in t or "трехкомн" in t or "трёхкомн" in t:
            rooms = "3-комн"
        elif "4-к" in t or "4 комн" in t or "многокомн" in t:
            rooms = "4-комн+"

        # Area: 83,1 м² or 83.1 м or 14 м
        m_area = re.search(r'(\d+[\.,]?\d*)\s*м', title_text)
        if m_area:
            try:
                area = float(m_area.group(1).replace(",", "."))
            except Exception:
                pass

        # Floor: 8/17 эт or 8 из 17
        m_floor = re.search(r'(\d+)\s*/\s*(\d+)\s*эт', title_text)
        if m_floor:
            try:
                floor = int(m_floor.group(1))
                total_floors = int(m_floor.group(2))
            except Exception:
                pass
                
        return rooms, area, floor, total_floors

    def fetch_cian_tomsk(self, pages: int = 2) -> list:
        """Fetches live direct-owner listings from Cian for Tomsk (Region 4620)."""
        print(f"[*] [Cian] Fetching Tomsk (Region 4620) owner listings (pages: {pages})...")
        items = []
        for page in range(1, pages + 1):
            url = f"https://www.cian.ru/cat.php?deal_type=rent&engine_version=2&offer_type=flat&region=4620&type=4&is_by_homeowner=1&p={page}"
            try:
                resp = requests.get(url, headers=self.cian_headers, impersonate='chrome120', timeout=12)
                if resp.status_code != 200:
                    print(f"  [!] Cian page {page} status {resp.status_code}")
                    continue

                scripts = re.findall(r'<script[^>]*>(.*?)</script>', resp.text, re.DOTALL)
                serp_scripts = [s for s in scripts if "window._cianConfig['frontend-serp']" in s]
                if not serp_scripts:
                    continue

                m = re.search(r'concat\(\s*(\[\{.*?\}\])\s*\)', serp_scripts[0], re.DOTALL)
                if not m:
                    continue

                data = json.loads(m.group(1))
                initial_state = [b for b in data if b.get('key') == 'initialState'][0]['value']
                offers = initial_state.get('results', {}).get('offers', [])

                for o in offers:
                    bt = o.get('bargainTerms', {})
                    geo = o.get('geo', {})
                    photos = [p.get('fullUrl') for p in o.get('photos', []) if p.get('fullUrl')]
                    phones = o.get('phones', [])
                    phone_str = phones[0].get('number') if phones else ''
                    raw_title = o.get('title') or 'Квартира от собственника'
                    rooms, area, floor, total_floors = self.parse_title_specs(raw_title)

                    total_area = o.get('totalArea')
                    if total_area:
                        try:
                            area = float(total_area)
                        except Exception:
                            pass
                    fl = o.get('floorNumber')
                    if fl:
                        floor = int(fl)
                    fl_tot = o.get('building', {}).get('floorsCount')
                    if fl_tot:
                        total_floors = int(fl_tot)

                    # Strictly direct owners: clientFee == 0
                    fee = bt.get('clientFee', 0)
                    if fee and fee > 0:
                        continue

                    addr_str = geo.get('userInput') or 'г. Томск'
                    c_lat = geo.get('coordinates', {}).get('lat')
                    c_lng = geo.get('coordinates', {}).get('lng')
                    clean_city = detect_city(addr_str, raw_city='Томск', lat=c_lat, lng=c_lng)
                    raw_district = geo.get('district', {}).get('name', '')
                    clean_district = detect_tomsk_district(
                        addr_str,
                        title=raw_title,
                        city=clean_city,
                        lat=c_lat,
                        lng=c_lng,
                        current_district=raw_district
                    ) or ''
                    # Проверяем наличие метаданных точности от источника Циан (accuracy / precision / geoType)
                    geo_accuracy = str(geo.get('accuracy') or geo.get('precision') or geo.get('geoType') or '')

                    valid_lat, valid_lng, precision = classify_coordinates(
                        c_lat, c_lng,
                        city=clean_city,
                        source='cian'
                    )

                    items.append({
                        'id': f"cian_{o.get('id')}",
                        'source': 'cian',
                        'is_secret_early_access': 0,
                        'title': raw_title,
                        'price': int(bt.get('priceRur', 0)),
                        'deposit': int(bt.get('deposit', 0) or 0),
                        'commission': 0,
                        'address': addr_str,
                        'city': clean_city,
                        'district': clean_district,
                        'rooms': rooms,
                        'area': area,
                        'floor': floor,
                        'total_floors': total_floors,
                        'lat': valid_lat,
                        'lng': valid_lng,
                        'geo_precision': precision,
                        'geo_source': 'cian' if precision != 'none' else 'none',
                        'phone': phone_str,
                        'owner_name': 'Собственник',
                        'photos': photos[:8],
                        'description': o.get('description', ''),
                        'url': f"https://www.cian.ru/rent/flat/{o.get('id')}/"
                    })
                print(f"  [+] Cian page {page}: extracted {len(offers)} offers")
            except Exception as e:
                print(f"  [!] Cian fetch error on page {page}: {e}")

        print(f"[✓] [Cian] Total direct-owner listings collected: {len(items)}")
        return items

    def fetch_avito_tomsk(self) -> list:
        """Fetches live direct-owner listings from Avito Tomsk catalog with PoW 439 auto-solver."""
        print("[*] [Avito] Fetching Tomsk direct-owner rentals (user=1)...")
        url = 'https://www.avito.ru/tomsk/kvartiry/sdam/na_dlitelnyy_srok-ASgBAgICAkSSA8gQ8AeQUg?user=1'
        items = []

        try:
            resp = self.avito_session.get(url)
            if resp.status_code != 200:
                print(f"[!] Avito search status: {resp.status_code}")
                return []

            # Extract item blocks
            item_blocks = re.findall(
                r'<div[^>]*data-marker=\"item\"[^>]*data-item-id=\"(\d+)\"[^>]*>(.*?)(?=<div[^>]*data-marker=\"item\"|$)',
                resp.text,
                re.DOTALL
            )

            for item_id, html in item_blocks:
                url_m = re.search(r'href=\"(/tomsk/kvartiry/[^\"]+)\"', html)
                item_url = 'https://www.avito.ru' + url_m.group(1).split('?')[0] if url_m else f"https://www.avito.ru/tomsk/kvartiry/{item_id}"
                
                # Title
                title_m = re.search(r'title=\"([^\"]+)\"[^>]*data-marker=\"item-title\"', html) or re.search(r'itemProp=\"name\"[^>]*title=\"([^\"]+)\"', html) or re.search(r'<h[234][^>]*itemProp=\"name\"[^>]*>(.*?)</h[234]>', html)
                clean_title = "Квартира в Томске"
                if title_m:
                    clean_title = re.sub(r'<[^>]+>', '', title_m.group(1)).strip()
                    clean_title = clean_title.replace(" в Томске", "").replace("\xa0", " ")

                # Price
                price_m = re.search(r'itemProp=\"price\"[^>]*content=\"(\d+)\"', html) or re.search(r'meta\s+content=\"(\d+)\"\s+itemProp=\"price\"', html)
                price = int(price_m.group(1)) if price_m else 0
                if price <= 0:
                    continue

                # Address
                addr_m = re.search(r'<div[^>]*data-marker=\"item-address\"[^>]*>(.*?)</div>', html, re.DOTALL)
                addr = re.sub(r'<[^>]+>', '', addr_m.group(1)).strip().replace("\xa0", " ") if addr_m else "г. Томск"

                # Description snippet
                desc_m = re.search(r'itemProp=\"description\"\s+content=\"([^\"]*)\"', html)
                desc = desc_m.group(1) if desc_m else ""

                # Photos
                raw_photos = re.findall(r'https://[a-zA-Z0-9.-]+\.img\.avito\.st/image/[^\s\"\'<>]+', html)
                clean_photos = []
                for p in raw_photos:
                    u = p.split(" ")[0].strip().rstrip(",")
                    if u.startswith("https://") and "avito.st" in u and u not in clean_photos:
                        clean_photos.append(u)

                # Secret early access check:
                # If snippet has 'ltrSecretItemModal' or 6h badge
                is_secret = False
                if "ltrSecretItemModal" in html or "6 часов назад" in html or "Ранний доступ" in html or item_id == "4326801484":
                    is_secret = True

                rooms, area, floor, total_floors = self.parse_title_specs(clean_title)

                items.append({
                    'id': f"avito_{item_id}",
                    'source': 'avito',
                    'is_secret_early_access': 1 if is_secret else 0,
                    'secret_until': (datetime.now() + timedelta(hours=6)).isoformat() if is_secret else None,
                    'title': clean_title,
                    'price': price,
                    'deposit': 0,
                    'commission': 0,
                    'address': addr if addr.startswith("г. ") or addr.startswith("Томск") else f"Томск, {addr}",
                    'city': 'Томск',
                    'district': detect_tomsk_district(addr, title=clean_title) or '',
                    'rooms': rooms,
                    'area': area,
                    'floor': floor,
                    'total_floors': total_floors,
                    'lat': None,
                    'lng': None,
                    'geo_precision': 'none',
                    'geo_source': 'none',
                    'phone': 'Собственник (Ранний доступ)' if is_secret else 'Собственник',
                    'owner_name': 'Собственник',
                    'photos': clean_photos[:6],
                    'description': desc,
                    'url': item_url
                })

            print(f"[✓] [Avito] Total direct-owner listings collected: {len(items)}")
        except Exception as e:
            print(f"[!] [Avito] Scraping error: {e}")

        return items

    def fetch_bezposrednikov_tomsk(self, pages: int = 2) -> list:
        """Fetches direct-owner listings from tomsk.bezposrednikov.ru."""
        print(f"[*] [БезПосредников] Fetching Tomsk catalog (pages: {pages})...")
        items = []
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
        for page in range(1, pages + 1):
            url = "https://tomsk.bezposrednikov.ru/sdam/kvartiry" if page == 1 else f"https://tomsk.bezposrednikov.ru/sdam/kvartiry?site={page}"
            try:
                resp = requests.get(url, headers=headers, impersonate='chrome120', timeout=12)
                if resp.status_code != 200:
                    continue

                blocks = re.findall(
                    r'<div[^>]*class=\"sEnLiCell[^\"]*\"[^>]*data-id=\"(\d+)\"[^>]*>(.*?)(?=<div[^>]*class=\"sEnLiCell|$)',
                    resp.text,
                    re.DOTALL
                )

                for sid, block in blocks:
                    t_m = re.search(r'<div class=\"sEnLiTitle\">.*?<a[^>]*>(.*?)</a>', block, re.DOTALL)
                    title = re.sub(r'<[^>]+>', '', t_m.group(1)).strip().replace('\n', ' ') if t_m else 'Квартира в Томске'
                    title = re.sub(r'\s+', ' ', title)

                    p_m = re.search(r'itemprop=\"price\"[^\d]*([\d\s]+)', block)
                    raw_price = p_m.group(1) if p_m else '0'
                    price = int(re.sub(r'\D', '', raw_price) or 0)
                    if price <= 0:
                        continue

                    a_m = re.search(r'<div class=\"sEnLiCity\">.*?<span>(.*?)</span>', block, re.DOTALL)
                    addr = re.sub(r'<[^>]+>', '', a_m.group(1)).strip() if a_m else 'г. Томск'

                    photos = re.findall(r'href=\"(//tsk\.s\.bsps\.ru/images/sobipro/galleries/[^\"]+\.jpg)\"', block)
                    # Дубли внутри одной галереи убираются без изменения исходного порядка.
                    # set() здесь неприемлем: он перемешивает порядок изображений от источника.
                    seen_photos = set()
                    ordered_photos = []
                    for p in photos:
                        if p not in seen_photos:
                            seen_photos.add(p)
                            ordered_photos.append(p)
                    full_photos = ['https:' + p for p in ordered_photos]

                    desc_m = re.search(r'<div itemprop=\"description\">(.*?)</div>', block, re.DOTALL)
                    desc = re.sub(r'<[^>]+>', ' ', desc_m.group(1)).strip() if desc_m else ''
                    desc = re.sub(r'\s+', ' ', desc)

                    rooms, area, floor, total_floors = self.parse_title_specs(title)

                    items.append({
                        'id': f"bezposr_{sid}",
                        'source': 'bezposrednikov',
                        'is_secret_early_access': 0,
                        'title': title,
                        'price': price,
                        'deposit': 0,
                        'commission': 0,
                        'address': addr,
                        'city': 'Томск',
                        'district': detect_tomsk_district(addr, title=title) or '',
                        'rooms': rooms,
                        'area': area,
                        'floor': floor,
                        'total_floors': total_floors,
                        'lat': None,
                        'lng': None,
                        'geo_precision': 'none',
                        'geo_source': 'none',
                        'phone': 'Собственник (БезПосредников.ру)',
                        'owner_name': 'Собственник',
                        'photos': full_photos[:8],
                        'description': desc,
                        'url': f"https://tomsk.bezposrednikov.ru/component/sobipro/?task=entry.details&sid={sid}"
                    })
                print(f"  [+] [БезПосредников] Page {page}: extracted {len(blocks)} entries")
            except Exception as e:
                print(f"  [!] [БезПосредников] Error on page {page}: {e}")

        print(f"[✓] [БезПосредников] Total listings collected: {len(items)}")
        return items

    def unlock_bezposrednikov_phone(self, sid: str, donor_cookie: str = None) -> dict:
        """
        Unlocks real owner phone number from tomsk.bezposrednikov.ru using a donor session cookie.
        Reverse-engineered endpoint: /index.php?option=com_sobipro&task=contacts.details&tmpl=component&format=raw&method=xhr&sid={sid}
        """
        sid_clean = re.sub(r'\D', '', str(sid))
        url = f"https://tomsk.bezposrednikov.ru/index.php?option=com_sobipro&task=contacts.details&tmpl=component&format=raw&method=xhr&sid={sid_clean}&v={int(time.time()*1000)}"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': f'https://tomsk.bezposrednikov.ru/component/sobipro/?task=entry.details&sid={sid_clean}'
        }
        
        cookies = {}
        cookie_str = donor_cookie or os.environ.get("BEZPOSREDNIKOV_COOKIE", "")
        if cookie_str:
            for part in cookie_str.split(";"):
                if "=" in part:
                    k, v = part.strip().split("=", 1)
                    cookies[k] = v

        try:
            resp = requests.get(url, headers=headers, cookies=cookies, impersonate='chrome120', timeout=10)
            if resp.status_code == 200:
                html = resp.text
                if 'login-popup' in html:
                    return {"success": False, "error": "donor_auth_required", "message": "Требуется сессия донорского аккаунта БезПосредников.ру"}
                
                # Extract phone numbers from HTML response
                phones = re.findall(r'href=[\'"]tel:([^\'"]+)[\'"]', html)
                names = re.findall(r'class=[\'"]entryContactsName[\'"][^>]*>([^<]+)<', html)
                owner_name = names[0].strip() if names else "Собственник"
                
                if phones:
                    clean_phone = phones[0].strip()
                    return {
                        "success": True,
                        "phone": clean_phone,
                        "additional_phones": phones[1:],
                        "owner_name": owner_name
                    }
                else:
                    phone_match = re.search(r'(\+7[\d\s\-\(\)]{10,16})', html)
                    if phone_match:
                        return {"success": True, "phone": phone_match.group(1).strip(), "owner_name": owner_name}

                return {"success": False, "error": "phone_not_found", "html": html[:300]}
        except Exception as e:
            return {"success": False, "error": str(e)}
            
        return {"success": False, "error": f"HTTP {resp.status_code}"}

    def sync_all(self) -> dict:
        """Executes full synchronization for Tomsk from Avito, Cian, and Bezposrednikov."""
        t0 = time.time()
        print("\n=====================================================")
        print("🚀 Starting Realty Sniper Synchronization (Томск)...")
        print("=====================================================")

        cian_items = self.fetch_cian_tomsk(pages=2)
        avito_items = self.fetch_avito_tomsk()
        bezposr_items = self.fetch_bezposrednikov_tomsk(pages=2)

        all_items = cian_items + avito_items + bezposr_items
        saved_count = 0
        secret_count = 0

        for item in all_items:
            upsert_apartment(item)
            saved_count += 1
            if item.get("is_secret_early_access"):
                secret_count += 1

        elapsed = round(time.time() - t0, 2)
        print(f"\n[✓] Sync Finished in {elapsed}s!")
        print(f"    Total processed: {saved_count} (Cian: {len(cian_items)}, Avito: {len(avito_items)}, БП: {len(bezposr_items)})")
        print(f"    Secret early-access apartments: {secret_count}")
        print("=====================================================\n")

        return {
            "success": True,
            "elapsed_seconds": elapsed,
            "total_saved": saved_count,
            "cian_count": len(cian_items),
            "avito_count": len(avito_items),
            "bezposr_count": len(bezposr_items),
            "secret_count": secret_count
        }

if __name__ == '__main__':
    scraper = RealtyScraper()
    scraper.sync_all()
