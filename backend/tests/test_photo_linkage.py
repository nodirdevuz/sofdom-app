"""Offline tests for the normalised photos<->apartment linkage.

Every test runs on an isolated temp SQLite DB; the working realty.db is never
touched. No network, no scraping.
"""
import os
import sys
import json
import tempfile
import unittest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as dbmod


def _apartment(aid, photos, source="cian"):
    return {
        "id": aid,
        "source": source,
        "title": "Квартира от собственника",
        "price": 20000,
        "address": "Томск, ул. Ленина 1",
        "phone": "9001234567",
        "photos": photos,
        "url": f"https://example.test/{aid}",
    }


class PhotoLinkageTest(unittest.TestCase):
    def setUp(self):
        fd, self.db = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        dbmod.init_db(self.db)

    def tearDown(self):
        for suffix in ("", "-wal", "-shm"):
            try:
                os.remove(self.db + suffix)
            except OSError:
                pass

    def test_photos_linked_with_ids(self):
        urls = ["https://img.test/a.jpg", "https://img.test/b.jpg"]
        dbmod.upsert_apartment(_apartment("SD-1", urls), db_path=self.db)
        photos = dbmod.get_apartment_photos("SD-1", db_path=self.db)
        self.assertEqual(len(photos), 2)
        # Each photo has its own id, ordered, and the id embeds its apartment.
        self.assertEqual([p["position"] for p in photos], [0, 1])
        for p in photos:
            self.assertTrue(p["photo_id"].startswith("SD-1-ph-"))
            self.assertIn(p["url"], urls)

    def test_photo_belongs_to_exactly_one_listing(self):
        # Same URL used by two different listings -> two distinct photo rows,
        # each scoped to its own apartment. No cross-contamination.
        shared = "https://img.test/shared.jpg"
        dbmod.upsert_apartment(_apartment("SD-1", [shared]), db_path=self.db)
        dbmod.upsert_apartment(_apartment("SD-2", [shared]), db_path=self.db)
        p1 = dbmod.get_apartment_photos("SD-1", db_path=self.db)
        p2 = dbmod.get_apartment_photos("SD-2", db_path=self.db)
        self.assertEqual(len(p1), 1)
        self.assertEqual(len(p2), 1)
        self.assertNotEqual(p1[0]["photo_id"], p2[0]["photo_id"])
        self.assertTrue(p1[0]["photo_id"].startswith("SD-1-ph-"))
        self.assertTrue(p2[0]["photo_id"].startswith("SD-2-ph-"))

    def test_resync_is_idempotent_and_stable(self):
        urls = ["https://img.test/a.jpg", "https://img.test/b.jpg"]
        dbmod.upsert_apartment(_apartment("SD-1", urls), db_path=self.db)
        ids_before = {p["url"]: p["photo_id"] for p in dbmod.get_apartment_photos("SD-1", db_path=self.db)}
        dbmod.upsert_apartment(_apartment("SD-1", urls), db_path=self.db)
        after = dbmod.get_apartment_photos("SD-1", db_path=self.db)
        self.assertEqual(len(after), 2)
        for p in after:
            self.assertEqual(p["photo_id"], ids_before[p["url"]])

    def test_removed_photo_is_unlinked(self):
        dbmod.upsert_apartment(_apartment("SD-1", ["u1", "u2", "u3"]), db_path=self.db)
        self.assertEqual(len(dbmod.get_apartment_photos("SD-1", db_path=self.db)), 3)
        dbmod.upsert_apartment(_apartment("SD-1", ["u1"]), db_path=self.db)
        remaining = dbmod.get_apartment_photos("SD-1", db_path=self.db)
        self.assertEqual([p["url"] for p in remaining], ["u1"])

    def test_duplicates_within_listing_collapsed(self):
        dbmod.upsert_apartment(_apartment("SD-1", ["u1", "u1", " ", "u2"]), db_path=self.db)
        urls = [p["url"] for p in dbmod.get_apartment_photos("SD-1", db_path=self.db)]
        self.assertEqual(urls, ["u1", "u2"])

    def test_integrity_report_ok(self):
        dbmod.upsert_apartment(_apartment("SD-1", ["u1", "u2"]), db_path=self.db)
        dbmod.upsert_apartment(_apartment("SD-2", ["u3"]), db_path=self.db)
        report = dbmod.check_photo_integrity(self.db)
        self.assertTrue(report["ok"])
        self.assertEqual(report["orphans"], 0)
        self.assertEqual(report["mismatched_ids"], 0)
        self.assertEqual(report["total_photos"], 3)

    def test_backfill_from_photos_json(self):
        # Simulate legacy rows that only have photos_json, no photos-table rows.
        import sqlite3
        conn = sqlite3.connect(self.db)
        conn.execute(
            "INSERT INTO apartments (id, source, title, price, address, photos_json) VALUES (?,?,?,?,?,?)",
            ("SD-OLD", "cian", "t", 1, "a", json.dumps(["https://img.test/x.jpg", "https://img.test/y.jpg"])),
        )
        conn.commit()
        conn.close()
        self.assertEqual(len(dbmod.get_apartment_photos("SD-OLD", db_path=self.db)), 0)
        summary = dbmod.backfill_photos(self.db)
        self.assertGreaterEqual(summary["photos_linked"], 2)
        self.assertEqual(len(dbmod.get_apartment_photos("SD-OLD", db_path=self.db)), 2)
        self.assertTrue(dbmod.check_photo_integrity(self.db)["ok"])

    def test_no_cap_keeps_all_photos(self):
        urls = [f"https://img.test/{i}.jpg" for i in range(20)]
        dbmod.upsert_apartment(_apartment("SD-1", urls), db_path=self.db)
        self.assertEqual(len(dbmod.get_apartment_photos("SD-1", db_path=self.db)), 20)

    def test_mixed_gallery_is_flagged(self):
        # Two Cian photos from DIFFERENT galleries under one listing -> flagged.
        urls = [
            "https://images.cdn-cian.ru/images/kvartira-tomsk-lenina-111-1.jpg",
            "https://images.cdn-cian.ru/images/kvartira-tomsk-mira-222-1.jpg",
        ]
        dbmod.upsert_apartment(_apartment("SD-9", urls, source="cian"), db_path=self.db)
        report = dbmod.check_photo_integrity(self.db)
        self.assertIn("SD-9", report["mixed_gallery_listings"])
        self.assertFalse(report["ok"])

    def test_same_gallery_passes(self):
        urls = [
            "https://images.cdn-cian.ru/images/kvartira-tomsk-lenina-111-1.jpg",
            "https://images.cdn-cian.ru/images/kvartira-tomsk-lenina-111-2.jpg",
        ]
        dbmod.upsert_apartment(_apartment("SD-8", urls, source="cian"), db_path=self.db)
        report = dbmod.check_photo_integrity(self.db)
        self.assertEqual(report["mixed_gallery_listings"], [])
        self.assertTrue(report["ok"])

    def test_cascade_delete_removes_photos(self):
        dbmod.upsert_apartment(_apartment("SD-1", ["u1", "u2"]), db_path=self.db)
        import sqlite3
        conn = sqlite3.connect(self.db)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("DELETE FROM apartments WHERE id = ?", ("SD-1",))
        conn.commit()
        cur = conn.execute("SELECT COUNT(*) FROM photos WHERE apartment_id = ?", ("SD-1",))
        self.assertEqual(cur.fetchone()[0], 0)
        conn.close()


if __name__ == "__main__":
    unittest.main()
