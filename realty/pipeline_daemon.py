#!/usr/bin/env python3
"""
pipeline_daemon.py
Autonomous Multi-Source Realty Sniper Pipeline.
Collects both OPEN and SECRET owner apartments from Avito & Cian,
cleans them through Anti-Broker filters, and publishes to database and live feed.
"""

import os, sys, json, time, re, sqlite3
from curl_cffi import requests
from avito_session_manager import AvitoSession

class RealtyPipeline:
    def __init__(self, db_path="/Users/macbookairm5/Desktop/Проекты/Снайпер/realty/realty.db"):
        self.db_path = db_path
        self.avito_session = AvitoSession()
        self.cian_headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9',
        }
        self.init_db()

    def init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS apartments (
                id TEXT PRIMARY KEY,
                source TEXT,
                is_secret_early_access INTEGER,
                title TEXT,
                price INTEGER,
                deposit INTEGER,
                commission INTEGER,
                address TEXT,
                city TEXT,
                lat REAL,
                lng REAL,
                phone TEXT,
                photos_json TEXT,
                description TEXT,
                url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            conn.commit()

    def save_apartment(self, item):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
            INSERT OR REPLACE INTO apartments (
                id, source, is_secret_early_access, title, price, deposit, commission,
                address, city, lat, lng, phone, photos_json, description, url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(item['id']),
                item.get('source', 'avito'),
                1 if item.get('is_secret', False) else 0,
                item.get('title'),
                item.get('price'),
                item.get('deposit'),
                item.get('commission', 0),
                item.get('address'),
                item.get('city', 'Томск'),
                item.get('lat'),
                item.get('lng'),
                item.get('phone', ''),
                json.dumps(item.get('photos', []), ensure_ascii=False),
                item.get('description', ''),
                item.get('url', '')
            ))
            conn.commit()

    def parse_avito_item(self, url):
        """Fetches full Avito item with automatic 439 PoW recovery."""
        resp = self.avito_session.get(url)
        if resp.status_code != 200:
            print(f"[!] Avito item fetch failed: HTTP {resp.status_code}")
            return None

        m = re.search(r'window\.__staticRouterHydrationData\s*=\s*JSON\.parse\((.*?)\);', resp.text, re.DOTALL)
        if not m:
            return None

        inner_str = json.loads(m.group(1).strip())
        data = json.loads(inner_str)
        buyer_item = data.get('loaderData', {}).get('catalog-or-main-or-item', {}).get('buyerItem', {})
        item = buyer_item.get('item', {})

        is_secret = buyer_item.get('ltrSecretItemModal') is not None
        
        photos = []
        for img in item.get('imageUrls', []):
            if isinstance(img, dict):
                photos.append(img.get('1280x960') or list(img.values())[0])

        deposit = 0
        commission = 0
        for t in buyer_item.get('rentTermsParams', {}).get('data', {}).get('items', []):
            if 'залог' in t.get('title', '').lower():
                try: deposit = int(re.sub(r'\D', '', t.get('description', '0')))
                except: pass
            if 'комиссия' in t.get('title', '').lower():
                try: commission = int(re.sub(r'\D', '', t.get('description', '0')))
                except: pass

        return {
            'id': f"avito_{item.get('id')}",
            'source': 'avito',
            'is_secret': is_secret,
            'title': item.get('title'),
            'price': item.get('price'),
            'deposit': deposit,
            'commission': commission,
            'address': item.get('address'),
            'city': 'Томск',
            'lat': item.get('coords', {}).get('lat') if item.get('coords') else None,
            'lng': item.get('coords', {}).get('lng') if item.get('coords') else None,
            'phone': 'Собственник (Ранний доступ)' if is_secret else 'Открытый контакт',
            'photos': photos,
            'description': item.get('description', ''),
            'url': url
        }

    def fetch_cian_owners(self, region_id=1):
        """Fetches live owner listings directly from Cian without broker fee."""
        url = f"https://www.cian.ru/cat.php?deal_type=rent&engine_version=2&offer_type=flat&region={region_id}&type=4&is_by_homeowner=1"
        resp = requests.get(url, headers=self.cian_headers, impersonate='chrome120', timeout=10)
        if resp.status_code != 200:
            print(f"[!] Cian fetch failed: HTTP {resp.status_code}")
            return []

        scripts = re.findall(r'<script[^>]*>(.*?)</script>', resp.text, re.DOTALL)
        serp_scripts = [s for s in scripts if "window._cianConfig['frontend-serp']" in s]
        if not serp_scripts:
            return []

        m = re.search(r'concat\(\s*(\[\{.*?\}\])\s*\)', serp_scripts[0], re.DOTALL)
        if not m:
            return []

        data = json.loads(m.group(1))
        initial_state = [b for b in data if b.get('key') == 'initialState'][0]['value']
        offers = initial_state.get('results', {}).get('offers', [])

        parsed = []
        for o in offers:
            bt = o.get('bargainTerms', {})
            geo = o.get('geo', {})
            photos = [p.get('fullUrl') for p in o.get('photos', []) if p.get('fullUrl')]
            phones = o.get('phones', [])
            phone_str = phones[0].get('number') if phones else ''

            parsed.append({
                'id': f"cian_{o.get('id')}",
                'source': 'cian',
                'is_secret': False,
                'title': o.get('title') or 'Квартира от собственника',
                'price': bt.get('priceRur'),
                'deposit': bt.get('deposit', 0),
                'commission': bt.get('clientFee', 0),
                'address': geo.get('userInput', ''),
                'city': 'Москва' if region_id == 1 else 'Регион',
                'lat': geo.get('coordinates', {}).get('lat'),
                'lng': geo.get('coordinates', {}).get('lng'),
                'phone': phone_str,
                'photos': photos[:6],
                'description': o.get('description', ''),
                'url': f"https://www.cian.ru/rent/flat/{o.get('id')}/"
            })
        return parsed

    def run_sync(self):
        print("[*] Running Realty Sniper Synchronization...")
        
        # 1. Sync sample Avito Secret listing
        avito_sample_url = 'https://www.avito.ru/tomsk/kvartiry/kvartira-studiya_14_m_19_et._4326801484'
        av_item = self.parse_avito_item(avito_sample_url)
        if av_item:
            self.save_apartment(av_item)
            print(f"[+] Saved Avito apartment: {av_item['title']} (Secret: {av_item['is_secret']})")

        # 2. Sync Cian owner listings
        cian_items = self.fetch_cian_owners(region_id=1)
        for item in cian_items:
            self.save_apartment(item)
        print(f"[+] Saved {len(cian_items)} owner apartments from Cian")

        # 3. Export live JSON feed for frontend / Telegram
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM apartments ORDER BY created_at DESC LIMIT 50")
            feed = [dict(row) for row in cursor.fetchall()]

        feed_path = "/Users/macbookairm5/Desktop/Проекты/Снайпер/realty/feed_live.json"
        with open(feed_path, 'w', encoding='utf-8') as f:
            json.dump(feed, f, ensure_ascii=False, indent=2)

        print(f"[✓] Pipeline complete! Total live feed items: {len(feed)}")
        return feed

if __name__ == '__main__':
    pipeline = RealtyPipeline()
    pipeline.run_sync()
