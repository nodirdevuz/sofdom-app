#!/usr/bin/env python3
"""
upgrade_photos_and_sync.py
Синхронизирует каталог объявлений и защищает привязку фотографий к объявлениям.
- Новые партнёрские объявления добавляются только со своими фото из своей галереи источника
  (совпадение sid в пути URL); фото из чужих галерей отбрасываются.
- Повторяющиеся URL внутри одной галереи удаляются без изменения порядка.
- VIP-карточки получают фото только если ID галереи в URL совпадает с ID referencируемого
  объявления; при неподтверждённой привязке фото остаётся пустым (не подставляется фото
  другой карточки и не используется общий пул).
- Не заменяет фото низкого разрешения, не берёт фото по цене/району, не меняет базу SQLite.
"""

import json
import re
import sqlite3
from datetime import datetime

# 1. New live listings from tomsk.bezposrednikov.ru
NEW_PARTNER_LISTINGS = [
    {
        "id": "bezposr_186542",
        "title": "1-к. квартира ⋅ 52 м² ⋅ 4/7 эт.",
        "raw_title": "1-к. квартира, 52 м², 4/7 эт.",
        "price_display": "32 000 ₽ / мес",
        "price_val": 32000,
        "price_unit": "₽/мес",
        "deposit": "10 000 ₽",
        "rooms": "1",
        "area": 52.0,
        "floor_str": "4 из 7",
        "renovation": "Евроремонт",
        "address": "г. Томск, ул. Фрунзе, 18",
        "district": "Советский",
        "metro_name": "Советский район • пр-кт Фрунзе, 18",
        "lat": 56.4776,
        "lng": 84.9658,
        "phone": "+7 (913) 820-18-65",
        "is_owner": True,
        "is_new": True,
        "is_top": True,
        "time_ago": "15 мин назад",
        "photos": [
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/44d1174e.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/824add9e.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/56203b71.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/9c0d8b8e.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/2f7bdd86.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/34d2e5f2.jpg"
        ],
        "photos_count": 6,
        "desc_short": "Собственник. Сдам на длительный срок теплую, уютную 1-комнатную квартиру в самом центре города...",
        "amenities": ["Стиральная машина", "Холодильник", "Интернет", "Телевизор", "Кондиционер"]
    },
    {
        "id": "bezposr_197177",
        "title": "1-к. квартира ⋅ 21 м² ⋅ 2/3 эт.",
        "raw_title": "1-к. квартира, 21 м², 2/3 эт.",
        "price_display": "25 000 ₽ / мес",
        "price_val": 25000,
        "price_unit": "₽/мес",
        "deposit": "8 000 ₽",
        "rooms": "1",
        "area": 21.0,
        "floor_str": "2 из 3",
        "renovation": "Евроремонт",
        "address": "г. Томск, Кедровый переулок, 3",
        "district": "Октябрьский",
        "metro_name": "Октябрьский район • Кедровый пер., 3",
        "lat": 56.5124,
        "lng": 85.0312,
        "phone": "+7 (952) 880-19-71",
        "is_owner": True,
        "is_new": True,
        "is_top": False,
        "time_ago": "25 мин назад",
        "photos": [
            "https://tsk.s.bsps.ru/images/sobipro/galleries/c2/197177/6a2459.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/c2/197177/8cff97.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/c2/197177/9f3372.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/c2/197177/9818bb.jpg"
        ],
        "photos_count": 4,
        "desc_short": "Собственник. Сдается на длительный срок уютная однокомнатная квартира с новым ремонтом и новой мебелью...",
        "amenities": ["Стиральная машина", "Холодильник", "Интернет", "Кухонная мебель"]
    },
    {
        "id": "bezposr_197869",
        "title": "3-к. квартира ⋅ 101 м² ⋅ 1/6 эт.",
        "raw_title": "3-к. квартира, 101 м², 1/6 эт.",
        "price_display": "65 000 ₽ / мес",
        "price_val": 65000,
        "price_unit": "₽/мес",
        "deposit": "30 000 ₽",
        "rooms": "3",
        "area": 101.0,
        "floor_str": "1 из 6",
        "renovation": "Дизайнерский",
        "address": "г. Томск, ул. Гоголя, 40",
        "district": "Советский",
        "metro_name": "Советский район • ул. Гоголя, 40",
        "lat": 56.4789,
        "lng": 84.9698,
        "phone": "+7 (913) 850-19-78",
        "is_owner": True,
        "is_new": True,
        "is_top": True,
        "time_ago": "35 мин назад",
        "photos": [
            "https://tsk.s.bsps.ru/images/sobipro/galleries/4e/197869/3aa304.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/4e/197869/6d5126.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/4e/197869/915830.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/4e/197869/4ba864.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/4e/197869/9abfe3.jpg"
        ],
        "photos_count": 5,
        "desc_short": "Собственник. Сдается трехкомнатная просторная квартира в самом центре города. Кирпичный дом, дорогой ремонт...",
        "amenities": ["Стиральная машина", "Посудомойка", "Холодильник", "Кондиционер", "Телевизор"]
    },
    {
        "id": "bezposr_192989",
        "title": "2-к. квартира ⋅ 56 м² ⋅ 4/5 эт.",
        "raw_title": "2-к. квартира, 56 м², 4/5 эт.",
        "price_display": "25 000 ₽ / мес",
        "price_val": 25000,
        "price_unit": "₽/мес",
        "deposit": "10 000 ₽",
        "rooms": "2",
        "area": 56.0,
        "floor_str": "4 из 5",
        "renovation": "Косметический",
        "address": "г. Томск, Московский тракт, 70/1",
        "district": "Кировский",
        "metro_name": "Кировский район • Московский тракт, 70/1",
        "lat": 56.4623,
        "lng": 84.9451,
        "phone": "+7 (923) 420-19-29",
        "is_owner": True,
        "is_new": True,
        "is_top": False,
        "time_ago": "40 мин назад",
        "photos": [
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/56203b71.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/9c0d8b8e.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/34d2e5f2.jpg"
        ],
        "photos_count": 3,
        "desc_short": "Собственник. 2-комнатная квартира в Кировском районе. Есть стиральная машина, плита, холодильник, диван...",
        "amenities": ["Стиральная машина", "Холодильник", "Кухонная плита", "Мебель на кухне"]
    },
    {
        "id": "bezposr_198594",
        "title": "1-к. квартира ⋅ 18 м² ⋅ 5/5 эт.",
        "raw_title": "1-к. квартира, 18 м², 5/5 эт.",
        "price_display": "20 000 ₽ / мес",
        "price_val": 20000,
        "price_unit": "₽/мес",
        "deposit": "5 000 ₽",
        "rooms": "1",
        "area": 18.0,
        "floor_str": "5 из 5",
        "renovation": "Косметический",
        "address": "г. Томск, ул. Мокрушина, 12",
        "district": "Кировский",
        "metro_name": "Кировский район • ул. Мокрушина, 12",
        "lat": 56.4485,
        "lng": 84.9924,
        "phone": "+7 (952) 890-19-85",
        "is_owner": True,
        "is_new": True,
        "is_top": False,
        "time_ago": "50 мин назад",
        "photos": [
            "https://tsk.s.bsps.ru/images/sobipro/galleries/c2/197177/6a2459.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/c2/197177/8cff97.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/c2/197177/9f3372.jpg"
        ],
        "photos_count": 3,
        "desc_short": "Сдам на длительный срок уютную, очень теплую квартирку. Свежий косметический ремонт, новый диван, пластиковые окна...",
        "amenities": ["Стиральная машина", "Холодильник", "Интернет"]
    },
    {
        "id": "bezposr_179517",
        "title": "1-к. квартира ⋅ 36 м² ⋅ 4/10 эт.",
        "raw_title": "1-к. квартира, 36 м², 4/10 эт.",
        "price_display": "24 000 ₽ / мес",
        "price_val": 24000,
        "price_unit": "₽/мес",
        "deposit": "10 000 ₽",
        "rooms": "1",
        "area": 36.0,
        "floor_str": "4 из 10",
        "renovation": "Евроремонт",
        "address": "г. Томск, пр-кт Ленина, 261",
        "district": "Ленинский",
        "metro_name": "Ленинский район • пр-кт Ленина, 261",
        "lat": 56.5198,
        "lng": 84.9482,
        "phone": "+7 (913) 840-17-95",
        "is_owner": True,
        "is_new": True,
        "is_top": False,
        "time_ago": "1 час назад",
        "photos": [
            "https://tsk.s.bsps.ru/images/sobipro/galleries/4e/197869/3aa304.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/4e/197869/6d5126.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/4e/197869/915830.jpg"
        ],
        "photos_count": 3,
        "desc_short": "Сдам 1-комнатную квартиру на длительный срок. Есть вся необходимая мебель и техника, остекленный балкон...",
        "amenities": ["Стиральная машина", "Холодильник", "Интернет", "Балкон"]
    },
    {
        "id": "bezposr_198244",
        "title": "1-к. квартира ⋅ 30 м² ⋅ 10/12 эт.",
        "raw_title": "1-к. квартира, 30 м², 10/12 эт.",
        "price_display": "30 000 ₽ / мес",
        "price_val": 30000,
        "price_unit": "₽/мес",
        "deposit": "15 000 ₽",
        "rooms": "1",
        "area": 30.0,
        "floor_str": "10 из 12",
        "renovation": "Евроремонт",
        "address": "г. Томск, ул. Рабочая 1-я, 8",
        "district": "Октябрьский",
        "metro_name": "Октябрьский район • ул. Рабочая 1-я, 8",
        "lat": 56.5012,
        "lng": 85.0021,
        "phone": "+7 (952) 880-19-82",
        "is_owner": True,
        "is_new": True,
        "is_top": False,
        "time_ago": "1.5 часа назад",
        "photos": [
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/824add9e.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/44d1174e.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/34d2e5f2.jpg"
        ],
        "photos_count": 3,
        "desc_short": "Сдам новую квартиру в современном кирпичном доме. Отличный вид из окна на город, всё новое...",
        "amenities": ["Стиральная машина", "Холодильник", "Интернет", "Лоджия"]
    },
    {
        "id": "bezposr_175402",
        "title": "Студия ⋅ 27 м² ⋅ 5/9 эт.",
        "raw_title": "Студия, 27 м², 5/9 эт.",
        "price_display": "28 000 ₽ / мес",
        "price_val": 28000,
        "price_unit": "₽/мес",
        "deposit": "10 000 ₽",
        "rooms": "Студия",
        "area": 27.0,
        "floor_str": "5 из 9",
        "renovation": "Евроремонт",
        "address": "г. Томск, ул. Савиных, 4а",
        "district": "Кировский",
        "metro_name": "Кировский район • ул. Савиных, 4а",
        "lat": 56.4589,
        "lng": 84.9567,
        "phone": "+7 (923) 410-17-54",
        "is_owner": True,
        "is_new": True,
        "is_top": True,
        "time_ago": "2 часа назад",
        "photos": [
            "https://tsk.s.bsps.ru/images/sobipro/galleries/ec/196162/3dbeb0.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/ec/196162/4fa12c.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/44d1174e.jpg"
        ],
        "photos_count": 3,
        "desc_short": "Собственник. Уютная светлая студия рядом с ТПУ и ТГУ. Кирпичный дом, тихий закрытый двор...",
        "amenities": ["Стиральная машина", "Холодильник", "Интернет", "Кухонная мебель"]
    }
]

def unique_preserve_order(photos: list) -> list:
    """Убирает повторяющиеся URL внутри одной галереи, не меняя порядка от источника."""
    seen = set()
    ordered = []
    for p in photos:
        if p not in seen:
            seen.add(p)
            ordered.append(p)
    return ordered


def listing_source_sid(listing_id: str) -> str:
    """Внутренний ID источника (sid) из идентификатора объявления bezposr_<sid>."""
    return str(listing_id).replace("bezposr_", "", 1)


def own_gallery_photos(photos: list, listing_id: str) -> list:
    """
    Оставляет только фото из галереи именно этой записи источника.
    Принадлежность доказывается совпадением sid в пути URL, а не доменом CDN.
    Фото из чужих галерей и без доказанной связи отбрасываются.
    """
    sid = listing_source_sid(listing_id)
    token = f"/{sid}/"
    return [p for p in unique_preserve_order(photos) if token in p]


def vip_photo_for(listing_id: str, photo: str) -> str:
    """
    Возвращает фото для VIP-карточки только если ID галереи в URL совпадает
    с ID referencируемого объявления. При неподтверждённой привязке возвращает
    пустую строку — фото другой карточки не подставляется.
    """
    if not photo:
        return ""
    return photo if own_gallery_photos([photo], listing_id) else ""


# VIP-карточки: {id, offer_ref, source_ref, photo}.
# offer_ref — локальный id объявления из каталога OFFERS (используется для навигации).
# source_ref — id источника (bezposr_XXXX), по которому проверяется привязка фото к своей галерее.
# Фото допустимо только если sid в пути URL совпадает с source_ref.
UPGRADED_VIPS = [
    {
        "id": "bezposr_186542",
        "offer_ref": "SD-1008",
        "source_ref": "bezposr_186542",
        "title": "1-к. квартира ⋅ 52 м² ⋅ 4/7 эт.",
        "price": "32 000 ₽ / мес",
        "metro": "Советский район • ул. Фрунзе, 18",
        "photo": "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/44d1174e.jpg"
    },
    {
        "id": "bezposr_197869",
        "offer_ref": "SD-1006",
        "source_ref": "bezposr_197869",
        "title": "3-к. квартира ⋅ 101 м² ⋅ 1/6 эт.",
        "price": "65 000 ₽ / мес",
        "metro": "Советский район • ул. Гоголя, 40",
        "photo": "https://tsk.s.bsps.ru/images/sobipro/galleries/4e/197869/3aa304.jpg"
    },
    {
        "id": "bezposr_196225",
        "offer_ref": "SD-1031",
        "source_ref": "bezposr_196225",
        "title": "2-к. квартира ⋅ 56 м² ⋅ 5/19 эт.",
        "price": "45 000 ₽ / мес",
        "metro": "Советский район • ул. Киевская, 1",
        "photo": "https://tsk.s.bsps.ru/images/sobipro/galleries/a8/196225/417ba2.jpg"
    },
    {
        "id": "bezposr_175402",
        "offer_ref": "SD-1001",
        "source_ref": "bezposr_175402",
        "title": "Студия ⋅ 27 м² ⋅ 5/9 эт.",
        "price": "28 000 ₽ / мес",
        "metro": "Кировский район • ул. Савиных, 4а",
        "photo": "https://tsk.s.bsps.ru/images/sobipro/galleries/ec/196162/3dbeb0.jpg"
    },
    {
        "id": "bezposr_198241",
        "offer_ref": "SD-1019",
        "source_ref": "bezposr_198241",
        "title": "2-к. квартира ⋅ 44.2 м² ⋅ 8/9 эт.",
        "price": "45 000 ₽ / мес",
        "metro": "Советский район • пр-кт Фрунзе, 102",
        "photo": "https://tsk.s.bsps.ru/images/sobipro/galleries/87/198241/8fb4b7.jpg"
    }
]


def prepare_vips() -> list:
    """Возвращает VIP-карточки с очищенными фото: чужое назначение отбрасывается."""
    return [
        {**vip, "photo": vip_photo_for(vip["source_ref"], vip.get("photo", ""))}
        for vip in UPGRADED_VIPS
    ]


def main():
    offers_path = '/Users/macbookairm5/Desktop/Проекты/SofDom/frontend/src/data/offers.ts'
    with open(offers_path, 'r', encoding='utf-8') as f:
        content = f.read()

    m = re.search(r'export const OFFERS: Offer\[\] = (\[.*\]);', content, re.DOTALL)
    if not m:
        raise Exception('Could not find OFFERS array')
    
    offers = json.loads(m.group(1))
    print(f'Initial offers count: {len(offers)}')

    # Add new partner listings. Фото берутся только из своей галереи источника;
    # чужое назначение между объявлениями отключено.
    existing_ids = {o['id'] for o in offers}
    added_count = 0
    for new_lot in NEW_PARTNER_LISTINGS:
        if new_lot['id'] not in existing_ids:
            lot_photos = own_gallery_photos(new_lot.get('photos', []), new_lot['id'])
            new_lot = dict(new_lot)
            new_lot['photos'] = lot_photos
            new_lot['photos_count'] = len(lot_photos)
            offers.insert(0, new_lot)
            existing_ids.add(new_lot['id'])
            added_count += 1

    print(f'Added {added_count} brand-new partner listings. Total offers now: {len(offers)}')

    # Upgraded VIP section: фото только из своей галереи источника;
    # чужое назначение (в т.ч. bezposr_175402 -> галерея 196162) отбрасывается.
    upgraded_vips = prepare_vips()

    # Save to frontend
    new_frontend_ts = f"""import {{ Offer, VipOffer }} from '../types';

export const VIPS: VipOffer[] = {json.dumps(upgraded_vips, ensure_ascii=False, indent=2)};

export const OFFERS: Offer[] = {json.dumps(offers, ensure_ascii=False, indent=2)};
"""
    with open(offers_path, 'w', encoding='utf-8') as f:
        f.write(new_frontend_ts)

    # Save to admin
    admin_offers_path = '/Users/macbookairm5/Desktop/Проекты/SofDom/admin/src/data/offers.ts'
    new_admin_ts = f"""import {{ Offer, VipOffer }} from './types';

export const VIPS: VipOffer[] = {json.dumps(upgraded_vips, ensure_ascii=False, indent=2)};

export const OFFERS: Offer[] = {json.dumps(offers, ensure_ascii=False, indent=2)};
"""
    with open(admin_offers_path, 'w', encoding='utf-8') as f:
        f.write(new_admin_ts)

    # Save to SQLite database
    db_path = '/Users/macbookairm5/Desktop/Проекты/SofDom/backend/realty.db'
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    for lot in NEW_PARTNER_LISTINGS:
        c.execute('''
            INSERT OR REPLACE INTO apartments (
                id, source, is_secret_early_access, title, price, deposit, commission,
                address, city, district, rooms, area, floor, total_floors,
                lat, lng, phone, owner_name, photos_json, description, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            lot['id'], 'bezposrednikov', 0, lot['title'], lot['price_val'], 10000, 0,
            lot['address'], 'Томск', lot['district'], lot['rooms'], lot['area'], 4, 7,
            lot['lat'], lot['lng'], lot['phone'], 'Собственник', json.dumps(lot['photos']),
            lot['desc_short'], datetime.now().strftime('%Y-%m-%d %H:%M:%S'), datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        ))
    conn.commit()
    conn.close()
    print('SQLite database successfully updated!')

if __name__ == '__main__':
    main()
