#!/usr/bin/env python3
"""
Тесты целостности привязки фотографий к объявлениям.
Проверяется только достоверность привязки: фото чужой карточки,
общий пул и Unsplash-заглушки недопустимы.
"""
import json
import os
import re
import sys
import unittest
import tempfile
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

import db
from scraper import RealtyScraper
from upgrade_photos_and_sync import (
    unique_preserve_order,
    own_gallery_photos,
    listing_source_sid,
    UPGRADED_VIPS,
    vip_photo_for,
    prepare_vips,
    NEW_PARTNER_LISTINGS,
    sanitize_partner_listing,
    prepare_partner_listings,
    partner_db_params,
)

SCRAPER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scraper.py")

OFFERS_TS_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "frontend", "src", "data", "offers.ts"
)
def catalog_offer_ids() -> set:
    """Загружает множество локальных id объявлений из каталога frontend offers.ts."""
    with open(OFFERS_TS_PATH, encoding="utf-8") as f:
        content = f.read()
    m = re.search(r'(?s)^(.*export const OFFERS: Offer\[\] = )(\[.*\])(;)\s*$', content)
    if not m:
        raise Exception('Could not find OFFERS array in offers.ts')
    offers = json.loads(m.group(2))
    return {str(o["id"]) for o in offers}


def catalog_offer_source_refs() -> dict:
    """Возвращает отображение локального id -> external_ref (источник) из каталога."""
    with open(OFFERS_TS_PATH, encoding="utf-8") as f:
        content = f.read()
    m = re.search(r'(?s)^(.*export const OFFERS: Offer\[\] = )(\[.*\])(;)\s*$', content)
    if not m:
        raise Exception('Could not find OFFERS array in offers.ts')
    offers = json.loads(m.group(2))
    return {str(o["id"]): str(o.get("external_ref", "")) for o in offers}


class TestScraperDedupeGuard(unittest.TestCase):
    """Защитный тест: в сборщике БезПосредников больше не используется set(photos)."""

    def test_scraper_uses_order_preserving_dedupe_not_set(self):
        with open(SCRAPER_PATH, encoding="utf-8") as f:
            source = f.read()
        self.assertNotIn("set(photos)", source)
        self.assertIn("seen_photos", source)
        self.assertIn("ordered_photos", source)


class TestPhotoDedupeOrder(unittest.TestCase):
    """Удаление дублей внутри галереи не меняет порядок исходных фото."""

    def test_removes_duplicates_preserves_order(self):
        photos = [
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/a.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/b.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/a.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/c.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/b.jpg",
        ]
        self.assertEqual(
            unique_preserve_order(photos),
            [
                "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/a.jpg",
                "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/b.jpg",
                "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/c.jpg",
            ],
        )

    def test_empty_list_stays_empty(self):
        self.assertEqual(unique_preserve_order([]), [])


class TestPhotoOwnership(unittest.TestCase):
    """Фото допустимо для карточки только из галереи этой же записи источника."""

    def test_keeps_only_own_sid_photos_preserves_order(self):
        photos = [
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/a.jpg",  # своя
            "https://tsk.s.bsps.ru/images/sobipro/galleries/4e/197869/x.jpg",  # чужой sid
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/b.jpg",  # своя
            "https://images.cdn-cian.ru/images/other.jpg",                      # чужой источник
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/a.jpg",  # дубль своей
        ]
        result = own_gallery_photos(photos, "bezposr_186542")
        self.assertEqual(result, [
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/a.jpg",
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/b.jpg",
        ])

    def test_photos_of_one_listing_are_not_assigned_to_another(self):
        foreign = [
            "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/a.jpg",
        ]
        self.assertEqual(own_gallery_photos(foreign, "bezposr_197177"), [])

    def test_domain_cdn_is_not_proof_of_ownership(self):
        # Фото с того же CDN, но другого sid, не принадлежит объявлению.
        cian_photo = "https://images.cdn-cian.ru/images/some-listing-1.jpg"
        self.assertEqual(own_gallery_photos([cian_photo], "bezposr_186542"), [])

    def test_empty_gallery_stays_empty(self):
        self.assertEqual(own_gallery_photos([], "bezposr_186542"), [])

    def test_listing_without_own_photos_gets_no_gallery(self):
        lot_ids = ["bezposr_192989", "bezposr_198594", "bezposr_179517",
                   "bezposr_198244", "bezposr_175402"]
        for lot in NEW_PARTNER_LISTINGS:
            if lot["id"] in lot_ids:
                self.assertEqual(
                    own_gallery_photos(lot.get("photos", []), lot["id"]),
                    [],
                    f"{lot['id']} не должен получить чужое фото",
                )

    def test_listing_keeps_its_own_gallery(self):
        expected_own = {
            "bezposr_186542": 6,
            "bezposr_197177": 4,
            "bezposr_197869": 5,
        }
        for lot in NEW_PARTNER_LISTINGS:
            if lot["id"] in expected_own:
                result = own_gallery_photos(lot.get("photos", []), lot["id"])
                self.assertEqual(len(result), expected_own[lot["id"]], lot["id"])
                for p in result:
                    self.assertIn(f"/{lot['id'].replace('bezposr_', '')}/", p)


class TestVipGallery(unittest.TestCase):
    """VIP-карточки: фото должно принадлежать тому ID источника, на который ссылается VIP."""

    def test_vip_photo_belongs_to_referenced_listing(self):
        for vip in prepare_vips():
            photo = vip.get("photo", "")
            if photo:
                sid = listing_source_sid(vip["source_ref"])
                self.assertIn(
                    f"/{sid}/",
                    photo,
                    f"VIP {vip['id']} (offer_ref={vip['offer_ref']}, "
                    f"source_ref={vip['source_ref']}) ссылается на чужую галерею: {photo}",
                )

    def test_unconfirmed_vip_photo_is_empty_not_foreign(self):
        # bezposr_175402 ссылался на фото из галереи 196162 — недопустимо.
        # При неподтверждённой привязке фото остаётся пустым (заглушка показывается на фронтенде).
        vips_by_id = {v["id"]: v for v in prepare_vips()}
        self.assertIn("bezposr_175402", vips_by_id)
        self.assertEqual(
            vips_by_id["bezposr_175402"]["photo"],
            "",
            "bezposr_175402 не должен получать фото из чужой галереи 196162",
        )

    def test_raw_upgraded_vips_contains_documented_mismatch(self):
        # Фиксирует существовавшее несоответствие: 175402 ссылался на фото 196162.
        mismatched = [v for v in UPGRADED_VIPS if v["id"] == "bezposr_175402"]
        self.assertEqual(len(mismatched), 1)
        self.assertIn("/196162/", mismatched[0]["photo"])

    def test_confirmed_vip_photos_kept(self):
        expected = {
            "bezposr_186542": "/186542/",
            "bezposr_197869": "/197869/",
            "bezposr_196225": "/196225/",
            "bezposr_198241": "/198241/",
        }
        vips_by_id = {v["id"]: v for v in prepare_vips()}
        for vid, token in expected.items():
            photo = vips_by_id[vid]["photo"]
            self.assertIn(token, photo, f"VIP {vid} должен сохранить собственное фото")


class TestVipCatalogReferences(unittest.TestCase):
    """VIP-ссылки: offer_ref указывает на существующий локальный id каталога,
    а фото принадлежит source_ref этой же записи."""

    def test_vip_offer_ref_exists_in_catalog(self):
        catalog_ids = catalog_offer_ids()
        for vip in prepare_vips():
            self.assertIn(
                vip["offer_ref"],
                catalog_ids,
                f"VIP offer_ref={vip['offer_ref']} не найден среди локальных id каталога",
            )

    def test_vip_offer_ref_matches_catalog_external_ref(self):
        """offer_ref (локальный id) ссылается на запись, чей external_ref равен source_ref."""
        catalog_refs = catalog_offer_source_refs()
        for vip in prepare_vips():
            local_id = vip["offer_ref"]
            source_ref = vip["source_ref"]
            self.assertIn(
                local_id,
                catalog_refs,
                f"VIP offer_ref={local_id} отсутствует в каталоге",
            )
            self.assertEqual(
                catalog_refs[local_id],
                source_ref,
                f"Каталог {local_id} ссылается на источник {catalog_refs[local_id]}, "
                f"а VIP требует {source_ref}",
            )

    def test_vip_photo_belongs_to_source_ref(self):
        """Фото каждого VIP проходит проверку привязки к своей галерее по source_ref."""
        catalog_refs = catalog_offer_source_refs()
        for vip in prepare_vips():
            photo = vip.get("photo", "")
            source_ref = vip["source_ref"]
            if photo:
                sid = listing_source_sid(source_ref)
                self.assertIn(
                    f"/{sid}/",
                    photo,
                    f"VIP {vip['id']} (offer_ref={vip['offer_ref']}, "
                    f"source_ref={source_ref}) ссылается на чужую галерею: {photo}",
                )
            # При неподтверждённой привязке фото должно быть пустым, а не чужое.
            local_id = vip["offer_ref"]
            expected_source = catalog_refs.get(local_id, "")
            if expected_source and expected_source != source_ref:
                self.assertEqual(
                    photo,
                    "",
                    f"VIP {vip['id']}: source_ref не совпадает с каталогом, фото должно быть пустым",
                )

    def test_unconfirmed_vip_photo_is_empty_not_foreign(self):
        # bezposr_175402 (SD-1001) ссылался на фото из галереи 196162 — недопустимо.
        vips_by_id = {v["id"]: v for v in prepare_vips()}
        self.assertIn("bezposr_175402", vips_by_id)
        vip = vips_by_id["bezposr_175402"]
        self.assertEqual(vip["offer_ref"], "SD-1001")
        self.assertEqual(vip["source_ref"], "bezposr_175402")
        self.assertEqual(
            vip["photo"],
            "",
            "bezposr_175402 не должен получать фото из чужой галереи 196162",
        )


class TestPartnerListingsSync(unittest.TestCase):
    """Синхронизация партнёрских объявлений между каталогом offers и SQLite apartments.

    Гарантирует, что и каталог, и база получают один и тот же очищенный набор
    данных, где сохранены только проверенные фото из собственной галереи,
    а сырые нефильтрованные данные из NEW_PARTNER_LISTINGS не попадают в БД.
    """

    CONFIRMED_UNVERIFIED_IDS = [
        "bezposr_192989",
        "bezposr_198594",
        "bezposr_179517",
        "bezposr_198244",
        "bezposr_175402",
    ]

    def test_prepare_partner_listings_keeps_only_own_photos(self):
        """prepare_partner_listings оставляет в каждом объявлении только фото своей галереи."""
        prepared = prepare_partner_listings()
        self.assertGreater(len(prepared), 0)
        for lot in prepared:
            sid = listing_source_sid(lot["id"])
            for photo in lot["photos"]:
                self.assertIn(
                    f"/{sid}/",
                    photo,
                    f"Объявление {lot['id']} содержит чужое фото: {photo}",
                )
            self.assertEqual(
                lot["photos_count"],
                len(lot["photos"]),
                f"photos_count для {lot['id']} не синхронизирован с длиной галереи",
            )

    def test_unverified_partner_listings_have_empty_photos(self):
        """Для подтверждённых 5 объявлений с чужими URL галерея и photos_count пусты."""
        raw_by_id = {lot["id"]: lot for lot in NEW_PARTNER_LISTINGS}
        prepared_by_id = {lot["id"]: lot for lot in prepare_partner_listings()}

        for lot_id in self.CONFIRMED_UNVERIFIED_IDS:
            self.assertIn(lot_id, prepared_by_id, f"{lot_id} отсутствует в подготовленных")
            # Проверяем, что в сырых данных было непустое поле photos (исходный дефект)
            self.assertGreater(
                len(raw_by_id[lot_id].get("photos", [])),
                0,
                f"В исходном {lot_id} ожидалось наличие сырых фото для теста фильтрации",
            )
            # В подготовленном списке фото полностью очищены
            self.assertEqual(
                prepared_by_id[lot_id]["photos"],
                [],
                f"{lot_id} должен иметь пустой список фото",
            )
            self.assertEqual(
                prepared_by_id[lot_id]["photos_count"],
                0,
                f"{lot_id} должен иметь photos_count == 0",
            )

    def test_confirmed_valid_galleries_retain_photos_with_matching_sid(self):
        """Для подтверждённых галерей фото не пустое и содержит sid своей записи."""
        expected_own = {
            "bezposr_186542": 6,
            "bezposr_197177": 4,
            "bezposr_197869": 5,
        }
        prepared_by_id = {lot["id"]: lot for lot in prepare_partner_listings()}
        for lot_id, expected_count in expected_own.items():
            self.assertIn(lot_id, prepared_by_id)
            lot = prepared_by_id[lot_id]
            photos = lot["photos"]
            self.assertEqual(
                len(photos),
                expected_count,
                f"Объявление {lot_id} должно иметь ровно {expected_count} собственных фото",
            )
            self.assertEqual(lot["photos_count"], expected_count)
            sid = listing_source_sid(lot_id)
            for photo in photos:
                self.assertIn(
                    f"/{sid}/",
                    photo,
                    f"Фото {photo} не принадлежит галерее {sid} объявления {lot_id}",
                )

    def test_db_payload_helper_does_not_use_raw_partner_listings(self):
        """helper partner_db_params сериализует очищенный объект, а не сырой NEW_PARTNER_LISTINGS."""
        raw_by_id = {lot["id"]: lot for lot in NEW_PARTNER_LISTINGS}
        prepared = prepare_partner_listings()
        prepared_by_id = {lot["id"]: lot for lot in prepared}

        # 1. Для объявлений без подтверждённых фото photos_json в DB payload должен быть "[]",
        # а НЕ сырой список чужих фото из NEW_PARTNER_LISTINGS.
        for lot_id in self.CONFIRMED_UNVERIFIED_IDS:
            prepared_lot = prepared_by_id[lot_id]
            params = partner_db_params(prepared_lot)
            # Индекс 18 в SQL INSERT — photos_json
            photos_json = params[18]
            self.assertEqual(
                json.loads(photos_json),
                [],
                f"В DB payload для {lot_id} попали фото, хотя должны быть пустые",
            )
            # Убеждаемся, что DB payload отличается от сырых данных NEW_PARTNER_LISTINGS
            raw_photos_json = json.dumps(raw_by_id[lot_id]["photos"], ensure_ascii=False)
            self.assertNotEqual(
                photos_json,
                raw_photos_json,
                f"DB payload для {lot_id} совпадает с сырыми нефильтрованными данными",
            )

        # 2. Для валидных объявлений в DB payload попадают именно проверенные фото
        for lot_id in ["bezposr_186542", "bezposr_197177", "bezposr_197869"]:
            params = partner_db_params(prepared_by_id[lot_id])
            photos = json.loads(params[18])
            self.assertEqual(params[22], lot_id)
            self.assertGreater(len(photos), 0)
            sid = listing_source_sid(lot_id)
            for photo in photos:
                self.assertIn(f"/{sid}/", photo)

        # 3. Исходный массив NEW_PARTNER_LISTINGS не мутирует
        for raw_lot in NEW_PARTNER_LISTINGS:
            lot_id = raw_lot["id"]
            if lot_id in self.CONFIRMED_UNVERIFIED_IDS:
                # В исходной константе сырые данные не должны затираться мутацией
                self.assertGreater(len(raw_lot["photos"]), 0)

    def test_sanitize_partner_listing_creates_safe_copy(self):
        """sanitize_partner_listing не мутирует переданный словарь и обновляет photos_count."""
        dummy = {
            "id": "bezposr_999999",
            "title": "Тестовая",
            "photos": [
                "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/foreign.jpg",
                "https://tsk.s.bsps.ru/images/sobipro/galleries/99/999999/own.jpg",
            ],
            "photos_count": 2,
        }
        original_photos = list(dummy["photos"])
        cleaned = sanitize_partner_listing(dummy)

        self.assertIsNot(cleaned, dummy)
        self.assertEqual(
            cleaned["photos"],
            ["https://tsk.s.bsps.ru/images/sobipro/galleries/99/999999/own.jpg"],
        )
        self.assertEqual(cleaned["photos_count"], 1)
        self.assertEqual(dummy["photos"], original_photos)
        self.assertEqual(dummy["photos_count"], 2)


class TestCianPhotoExtraction(unittest.TestCase):
    """Тестирование извлечения, дедупликации и изоляции фото из объявлений ЦИАН."""

    def setUp(self):
        self.scraper = RealtyScraper(avito_session=MagicMock())

    def test_cian_extracts_photos_from_offer(self):
        offer = {
            "id": 101,
            "title": "1-к. квартира",
            "photos": [
                {"fullUrl": "https://images.cdn-cian.ru/images/flat-101-1.jpg"},
                {"fullUrl": "https://images.cdn-cian.ru/images/flat-101-2.jpg"},
            ],
            "bargainTerms": {"priceRur": 25000, "clientFee": 0},
        }
        item = self.scraper.parse_cian_offer(offer)
        self.assertIsNotNone(item)
        self.assertEqual(
            item["photos"],
            [
                "https://images.cdn-cian.ru/images/flat-101-1.jpg",
                "https://images.cdn-cian.ru/images/flat-101-2.jpg",
            ],
        )

    def test_cian_deduplicates_photos_preserving_order(self):
        offer = {
            "id": 102,
            "photos": [
                {"fullUrl": "https://images.cdn-cian.ru/images/photo-A.jpg"},
                {"fullUrl": "https://images.cdn-cian.ru/images/photo-B.jpg"},
                {"fullUrl": "https://images.cdn-cian.ru/images/photo-A.jpg"},
                {"fullUrl": "https://images.cdn-cian.ru/images/photo-C.jpg"},
                {"fullUrl": "https://images.cdn-cian.ru/images/photo-B.jpg"},
            ],
            "bargainTerms": {"priceRur": 30000, "clientFee": 0},
        }
        item = self.scraper.parse_cian_offer(offer)
        self.assertEqual(
            item["photos"],
            [
                "https://images.cdn-cian.ru/images/photo-A.jpg",
                "https://images.cdn-cian.ru/images/photo-B.jpg",
                "https://images.cdn-cian.ru/images/photo-C.jpg",
            ],
        )

    def test_cian_filters_invalid_urls(self):
        offer = {
            "id": 103,
            "photos": [
                {"fullUrl": "https://images.cdn-cian.ru/images/valid.jpg"},
                {"fullUrl": ""},
                {"fullUrl": "   "},
                {"fullUrl": "ftp://malformed.ru/img.jpg"},
                {"fullUrl": None},
                None,
                {"fullUrl": "http://images.cdn-cian.ru/images/valid-http.jpg"},
            ],
            "bargainTerms": {"priceRur": 20000, "clientFee": 0},
        }
        item = self.scraper.parse_cian_offer(offer)
        self.assertEqual(
            item["photos"],
            [
                "https://images.cdn-cian.ru/images/valid.jpg",
                "http://images.cdn-cian.ru/images/valid-http.jpg",
            ],
        )

    def test_cian_empty_photos_stays_empty(self):
        offer = {
            "id": 104,
            "photos": [],
            "bargainTerms": {"priceRur": 22000, "clientFee": 0},
        }
        item = self.scraper.parse_cian_offer(offer)
        self.assertEqual(item["photos"], [])

    def test_cian_each_offer_receives_only_its_own_photos(self):
        offer1 = {
            "id": 201,
            "photos": [{"fullUrl": "https://images.cdn-cian.ru/images/offer-201.jpg"}],
            "bargainTerms": {"priceRur": 25000, "clientFee": 0},
        }
        offer2 = {
            "id": 202,
            "photos": [{"fullUrl": "https://images.cdn-cian.ru/images/offer-202.jpg"}],
            "bargainTerms": {"priceRur": 35000, "clientFee": 0},
        }
        item1 = self.scraper.parse_cian_offer(offer1)
        item2 = self.scraper.parse_cian_offer(offer2)
        self.assertNotIn(item2["photos"][0], item1["photos"])
        self.assertNotIn(item1["photos"][0], item2["photos"])


class TestAvitoPhotoExtraction(unittest.TestCase):
    """Тестирование извлечения, дедупликации и изоляции фото из карточек Авито."""

    def test_avito_extracts_and_deduplicates_photos(self):
        html = """
        <html><body>
        <div data-marker="catalog-serp">
            <div data-marker="item" data-item-id="888001">
                <div data-marker="item-title">1-к. квартира, 38 м², 3/10 эт.</div>
                <meta content="27000" itemProp="price" />
                <img src="https://10.img.avito.st/image/1/photo_1.jpg" />
                <img src="https://10.img.avito.st/image/1/photo_2.jpg" />
                <img src="https://10.img.avito.st/image/1/photo_1.jpg" />
            </div>
        </div>
        </body></html>
        """
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = html
        mock_session.get.return_value = mock_resp
        scraper = RealtyScraper(avito_session=mock_session)
        items = scraper.fetch_avito_tomsk()
        self.assertEqual(len(items), 1)
        self.assertEqual(
            items[0]["photos"],
            [
                "https://10.img.avito.st/image/1/photo_1.jpg",
                "https://10.img.avito.st/image/1/photo_2.jpg",
            ],
        )

    def test_avito_empty_photos_when_card_has_no_images(self):
        html = """
        <html><body>
        <div data-marker="catalog-serp">
            <div data-marker="item" data-item-id="888002">
                <div data-marker="item-title">Студия, 25 м²</div>
                <meta content="18000" itemProp="price" />
            </div>
        </div>
        </body></html>
        """
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = html
        mock_session.get.return_value = mock_resp
        scraper = RealtyScraper(avito_session=mock_session)
        items = scraper.fetch_avito_tomsk()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["photos"], [])

    def test_avito_photos_isolated_between_cards(self):
        html = """
        <html><body>
        <div data-marker="catalog-serp">
            <div data-marker="item" data-item-id="888003">
                <div data-marker="item-title">Квартира 1</div>
                <meta content="20000" itemProp="price" />
                <img src="https://10.img.avito.st/image/1/photo_card_1.jpg" />
            </div>
            <div data-marker="item" data-item-id="888004">
                <div data-marker="item-title">Квартира 2</div>
                <meta content="30000" itemProp="price" />
                <img src="https://20.img.avito.st/image/1/photo_card_2.jpg" />
            </div>
        </div>
        </body></html>
        """
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = html
        mock_session.get.return_value = mock_resp
        scraper = RealtyScraper(avito_session=mock_session)
        items = scraper.fetch_avito_tomsk()
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["photos"], ["https://10.img.avito.st/image/1/photo_card_1.jpg"])
        self.assertEqual(items[1]["photos"], ["https://20.img.avito.st/image/1/photo_card_2.jpg"])


class TestBezposrednikovPhotoExtraction(unittest.TestCase):
    """Тестирование извлечения фото БезПосредников: строгая привязка к sid своей галереи."""

    def setUp(self):
        self.scraper = RealtyScraper(avito_session=MagicMock())

    def test_bezposrednikov_extracts_only_own_sid_gallery_photos(self):
        html = """
        <html><body>
        <div id="spEntries" class="sEnLiEntries">
            <div class="sEnLiCell" data-sid="186542">
                <div class="sEnLiTitle"><a href="/realty/186542">1-к. квартира, 52 м²</a></div>
                <span itemprop="price">32 000</span>
                <a href="//tsk.s.bsps.ru/images/sobipro/galleries/98/186542/pic1.jpg">1</a>
                <a href="//tsk.s.bsps.ru/images/sobipro/galleries/98/186542/pic2.jpg">2</a>
                <!-- Чужое фото из другой галереи внутри блока -->
                <a href="//tsk.s.bsps.ru/images/sobipro/galleries/4e/197869/foreign.jpg">чужое</a>
            </div><!-- cell -->
        </div>
        </body></html>
        """
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = html
        mock_client.get.return_value = mock_resp
        with patch("scraper.requests", mock_client):
            items = self.scraper.fetch_bezposrednikov_tomsk(pages=1)
        self.assertEqual(len(items), 1)
        self.assertEqual(
            items[0]["photos"],
            [
                "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/pic1.jpg",
                "https://tsk.s.bsps.ru/images/sobipro/galleries/98/186542/pic2.jpg",
            ],
        )
        for photo in items[0]["photos"]:
            self.assertIn("/186542/", photo)
            self.assertNotIn("/197869/", photo)

    def test_bezposrednikov_deduplicates_photos_preserving_order(self):
        html = """
        <html><body>
        <div id="spEntries" class="sEnLiEntries">
            <div class="sEnLiCell" data-sid="197177">
                <div class="sEnLiTitle"><a href="/realty/197177">1-к. квартира, 21 м²</a></div>
                <span itemprop="price">25 000</span>
                <a href="//tsk.s.bsps.ru/images/sobipro/galleries/c2/197177/a.jpg">a</a>
                <a href="//tsk.s.bsps.ru/images/sobipro/galleries/c2/197177/b.jpg">b</a>
                <a href="//tsk.s.bsps.ru/images/sobipro/galleries/c2/197177/a.jpg">a_dup</a>
            </div><!-- cell -->
        </div>
        </body></html>
        """
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = html
        mock_client.get.return_value = mock_resp
        with patch("scraper.requests", mock_client):
            items = self.scraper.fetch_bezposrednikov_tomsk(pages=1)
        self.assertEqual(len(items), 1)
        self.assertEqual(
            items[0]["photos"],
            [
                "https://tsk.s.bsps.ru/images/sobipro/galleries/c2/197177/a.jpg",
                "https://tsk.s.bsps.ru/images/sobipro/galleries/c2/197177/b.jpg",
            ],
        )

    def test_bezposrednikov_empty_photos_when_no_own_gallery(self):
        html = """
        <html><body>
        <div id="spEntries" class="sEnLiEntries">
            <div class="sEnLiCell" data-sid="192989">
                <div class="sEnLiTitle"><a href="/realty/192989">Квартира без фото</a></div>
                <span itemprop="price">20 000</span>
            </div><!-- cell -->
        </div>
        </body></html>
        """
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = html
        mock_client.get.return_value = mock_resp
        with patch("scraper.requests", mock_client):
            items = self.scraper.fetch_bezposrednikov_tomsk(pages=1)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["photos"], [])


class TestPhotoDatabasePersistenceAndLifecycle(unittest.TestCase):
    """Тестирование сохранения в БД, жизненного цикла обновления и очистки устаревших фото."""

    def setUp(self):
        self.temp_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db_file.name
        self.temp_db_file.close()
        db.init_db(self.temp_db_path)

    def tearDown(self):
        if os.path.exists(self.temp_db_path):
            try:
                os.remove(self.temp_db_path)
            except OSError:
                pass

    def test_upsert_apartment_saves_and_retrieves_photos(self):
        item = {
            "id": "cian_3001",
            "source": "cian",
            "title": "1-к квартира",
            "price": 25000,
            "address": "Томск, ул. Ленина, 1",
            "photos": [
                "https://images.cdn-cian.ru/images/3001_1.jpg",
                "https://images.cdn-cian.ru/images/3001_2.jpg",
            ],
        }
        db.upsert_apartment(item, db_path=self.temp_db_path)
        fetched = db.get_apartment_by_id("cian_3001", db_path=self.temp_db_path)
        self.assertIsNotNone(fetched)
        self.assertEqual(
            fetched["photos"],
            [
                "https://images.cdn-cian.ru/images/3001_1.jpg",
                "https://images.cdn-cian.ru/images/3001_2.jpg",
            ],
        )

    def test_upsert_apartment_overwrites_with_new_photos_on_rescrape(self):
        item_v1 = {
            "id": "avito_4001",
            "source": "avito",
            "title": "2-к квартира",
            "price": 30000,
            "address": "Томск, ул. Кирова, 10",
            "photos": ["https://10.img.avito.st/image/1/old.jpg"],
        }
        db.upsert_apartment(item_v1, db_path=self.temp_db_path)

        item_v2 = {
            "id": "avito_4001",
            "source": "avito",
            "title": "2-к квартира",
            "price": 31000,
            "address": "Томск, ул. Кирова, 10",
            "photos": [
                "https://10.img.avito.st/image/1/new_1.jpg",
                "https://10.img.avito.st/image/1/new_2.jpg",
            ],
        }
        db.upsert_apartment(item_v2, db_path=self.temp_db_path)
        fetched = db.get_apartment_by_id("avito_4001", db_path=self.temp_db_path)
        self.assertEqual(
            fetched["photos"],
            [
                "https://10.img.avito.st/image/1/new_1.jpg",
                "https://10.img.avito.st/image/1/new_2.jpg",
            ],
        )

    def test_upsert_apartment_clears_photos_when_rescrape_has_empty_photos(self):
        # Риск оставить старые фото при новом ответе без фото:
        # гарантирует, что если при повторном сборе пришёл пустой список фото,
        # старые фото не остаются в БД.
        item_with_photos = {
            "id": "bezposr_5001",
            "source": "bezposrednikov",
            "title": "Студия",
            "price": 20000,
            "address": "Томск, ул. Учебная, 5",
            "photos": ["https://tsk.s.bsps.ru/images/sobipro/galleries/01/5001/a.jpg"],
        }
        db.upsert_apartment(item_with_photos, db_path=self.temp_db_path)
        fetched_before = db.get_apartment_by_id("bezposr_5001", db_path=self.temp_db_path)
        self.assertEqual(len(fetched_before["photos"]), 1)

        item_without_photos = {
            "id": "bezposr_5001",
            "source": "bezposrednikov",
            "title": "Студия",
            "price": 20000,
            "address": "Томск, ул. Учебная, 5",
            "photos": [],
        }
        db.upsert_apartment(item_without_photos, db_path=self.temp_db_path)
        fetched_after = db.get_apartment_by_id("bezposr_5001", db_path=self.temp_db_path)
        self.assertEqual(fetched_after["photos"], [])

    def test_upsert_apartment_handles_malformed_json_gracefully(self):
        # Если photos_json в БД повреждён, чтение возвращает [] без исключения
        item = {
            "id": "cian_6001",
            "source": "cian",
            "title": "Квартира",
            "price": 25000,
            "address": "Томск",
            "photos_json": "corrupted_non_json_string",
        }
        db.upsert_apartment(item, db_path=self.temp_db_path)
        fetched = db.get_apartment_by_id("cian_6001", db_path=self.temp_db_path)
        self.assertEqual(fetched["photos"], [])
        listed = db.list_apartments(db_path=self.temp_db_path)
        target = next((x for x in listed if x["id"] == "cian_6001"), None)
        self.assertIsNotNone(target)
        self.assertEqual(target["photos"], [])


class TestExternalRefDatabaseApiPath(unittest.TestCase):
    """Temporary in-project DB verifies schema migration, UPSERT and API serialization."""

    def setUp(self):
        self.test_db_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), ".external_ref_api_test.db"
        )
        self._remove_test_db()

    def tearDown(self):
        self._remove_test_db()

    def _remove_test_db(self):
        for suffix in ("", "-wal", "-shm"):
            path = self.test_db_path + suffix
            if os.path.exists(path):
                os.remove(path)

    def test_new_source_listing_flows_through_db_list_api_model(self):
        db.init_db(self.test_db_path)
        db.upsert_apartment({
            "id": "bezposr_175402",
            "source": "bezposrednikov",
            "title": "Студия",
            "price": 28000,
            "address": "Томск, ул. Савиных, 4а",
            "url": "https://tomsk.bezposrednikov.ru/component/sobipro/?task=entry.details&sid=175402",
            "photos": ["https://tsk.s.bsps.ru/images/sobipro/galleries/4c/175402/one.jpg"],
        }, db_path=self.test_db_path)

        # /api/apartments returns db.list_apartments() records unchanged under "apartments".
        api_model = {"apartments": db.list_apartments(db_path=self.test_db_path)}
        listing = next(item for item in api_model["apartments"] if item["id"] == "bezposr_175402")
        self.assertEqual(listing["external_ref"], "bezposr_175402")
        self.assertEqual(
            listing["photos"],
            ["https://tsk.s.bsps.ru/images/sobipro/galleries/4c/175402/one.jpg"],
        )

    def test_existing_schema_migrates_and_infers_reference_from_source_url(self):
        db.init_db(self.test_db_path)
        db.upsert_apartment({
            "id": "SD-1001",
            "source": "bezposrednikov",
            "title": "Студия",
            "price": 28000,
            "address": "Томск",
            "url": "https://tomsk.bezposrednikov.ru/component/sobipro/?sid=175402",
            "external_ref": "bezposr_175402",
            "photos": [],
        }, db_path=self.test_db_path)

        with db.get_connection(self.test_db_path) as conn:
            conn.execute("ALTER TABLE apartments DROP COLUMN external_ref")
            conn.commit()

        db.init_db(self.test_db_path)
        migrated = db.get_apartment_by_id("SD-1001", db_path=self.test_db_path)
        self.assertEqual(migrated["external_ref"], "bezposr_175402")

        # A later scrape without an explicit external_ref must not erase the persisted value.
        db.upsert_apartment({
            "id": "SD-1001",
            "source": "bezposrednikov",
            "title": "Студия",
            "price": 28000,
            "address": "Томск",
            "photos": [],
        }, db_path=self.test_db_path)
        refreshed = db.get_apartment_by_id("SD-1001", db_path=self.test_db_path)
        self.assertEqual(refreshed["external_ref"], "bezposr_175402")

    def test_source_urls_infer_only_their_matching_listing_reference(self):
        cases = [
            ("cian", "SD-1002", "https://www.cian.ru/rent/flat/334986722/", "cian_334986722"),
            ("avito", "SD-1003", "https://www.avito.ru/tomsk/kvartiry/listing_8167774294", "avito_8167774294"),
            (
                "bezposrednikov",
                "SD-1004",
                "https://tomsk.bezposrednikov.ru/component/sobipro/?sid=198244",
                "bezposr_198244",
            ),
        ]
        for source, listing_id, url, expected in cases:
            with self.subTest(source=source):
                self.assertEqual(db._infer_external_ref(source, listing_id, url), expected)
        self.assertIsNone(
            db._infer_external_ref("cian", "SD-1002", "https://example.org/flat/334986722/")
        )

    def test_sd_record_lifecycle_and_api_detail_model(self):
        """Проверяет сквозной путь SD-* записей: сохранение external_ref, защиту от затирания и API-выдачу."""
        db.init_db(self.test_db_path)
        # Вставка SD-* записи с URL Циан
        db.upsert_apartment({
            "id": "SD-1002",
            "source": "cian",
            "title": "1-комн",
            "price": 24000,
            "address": "Томск, ул. Ленина, 20",
            "url": "https://www.cian.ru/rent/flat/334986722/",
            "photos": ["https://images.cian.site/flat.jpg"],
        }, db_path=self.test_db_path)

        # Проверка через list_apartments (аналог GET /api/apartments)
        apts = db.list_apartments(db_path=self.test_db_path)
        item = next(a for a in apts if a["id"] == "SD-1002")
        self.assertEqual(item["external_ref"], "cian_334986722")
        self.assertEqual(item["photos"], ["https://images.cian.site/flat.jpg"])

        # Проверка через get_apartment_by_id (аналог GET /api/apartments/{id})
        detail = db.get_apartment_by_id("SD-1002", db_path=self.test_db_path)
        self.assertIsNotNone(detail)
        self.assertEqual(detail["external_ref"], "cian_334986722")

        # Re-scrape без URL и без external_ref не должен затереть external_ref
        db.upsert_apartment({
            "id": "SD-1002",
            "source": "cian",
            "title": "1-комн (новая цена)",
            "price": 25000,
            "address": "Томск, ул. Ленина, 20",
        }, db_path=self.test_db_path)

        refreshed = db.get_apartment_by_id("SD-1002", db_path=self.test_db_path)
        self.assertEqual(refreshed["price"], 25000)
        self.assertEqual(refreshed["external_ref"], "cian_334986722")


if __name__ == "__main__":
    unittest.main()
