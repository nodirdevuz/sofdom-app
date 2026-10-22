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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

from upgrade_photos_and_sync import (
    unique_preserve_order,
    own_gallery_photos,
    listing_source_sid,
    UPGRADED_VIPS,
    vip_photo_for,
    prepare_vips,
    NEW_PARTNER_LISTINGS,
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


if __name__ == "__main__":
    unittest.main()
