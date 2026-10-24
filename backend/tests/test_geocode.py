"""Offline tests for Yandex geocoding + per-listing geo rebuild.

No network: the Yandex HTTP layer is replaced by an injected fetcher, and
rebuild_geo gets an injected geocoder. Runs on isolated temp DBs.
"""
import os
import sys
import tempfile
import unittest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db as dbmod
import geocode as geomod


def yandex_payload(lng, lat, precision="exact"):
    return {
        "response": {"GeoObjectCollection": {"featureMember": [
            {"GeoObject": {
                "Point": {"pos": f"{lng} {lat}"},
                "metaDataProperty": {"GeocoderMetaData": {"precision": precision}},
            }}
        ]}}
    }


class GeocodeTest(unittest.TestCase):
    def test_parses_tomsk_point(self):
        # Tomsk, inside envelope -> accepted, labelled 'unknown' (geocoded).
        res = geomod.geocode_address(
            "Томск, улица Ленина, 1",
            fetcher=lambda q: yandex_payload(84.9744, 56.4844),
        )
        self.assertIsNotNone(res)
        self.assertEqual(res["source"], "geocoded")
        self.assertEqual(res["precision"], "unknown")
        self.assertAlmostEqual(res["lat"], 56.4844, places=3)
        self.assertAlmostEqual(res["lng"], 84.9744, places=3)

    def test_rejects_out_of_region(self):
        # Moscow coords -> outside Tomsk envelope -> None (no fake point).
        res = geomod.geocode_address(
            "Москва, Красная площадь",
            fetcher=lambda q: yandex_payload(37.6173, 55.7558),
        )
        self.assertIsNone(res)

    def test_empty_results_returns_none(self):
        res = geomod.geocode_address("asdfasdf", fetcher=lambda q: {"response": {"GeoObjectCollection": {"featureMember": []}}})
        self.assertIsNone(res)

    def test_network_error_returns_none(self):
        def boom(q):
            raise RuntimeError("timeout")
        self.assertIsNone(geomod.geocode_address("Томск, ул. Мира 5", fetcher=boom))

    def test_blank_address(self):
        self.assertIsNone(geomod.geocode_address("", fetcher=lambda q: yandex_payload(84.9, 56.4)))


class RebuildGeoTest(unittest.TestCase):
    def setUp(self):
        fd, self.db = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        dbmod.init_db(self.db)

    def tearDown(self):
        for s in ("", "-wal", "-shm"):
            try:
                os.remove(self.db + s)
            except OSError:
                pass

    def _ins(self, aid, source, address, lat=None, lng=None):
        dbmod.upsert_apartment({
            "id": aid, "source": source, "title": "t", "price": 1,
            "address": address, "lat": lat, "lng": lng, "photos": [],
            "geo_source": source if lat else "none",
        }, db_path=self.db)

    def test_avito_fake_coords_replaced_by_geocode(self):
        # Avito never has real coords; rebuild should geocode its own address.
        self._ins("SD-A", "avito", "Томск, проспект Фрунзе, 20")
        def geocoder(addr):
            return {"lat": 56.47, "lng": 84.97, "precision": "unknown", "source": "geocoded"}
        dbmod.rebuild_geo(self.db, geocoder=geocoder)
        apt = dbmod.get_apartment_by_id("SD-A", db_path=self.db)
        self.assertAlmostEqual(apt["lat"], 56.47, places=2)
        self.assertEqual(apt["geo_source"], "geocoded")
        self.assertEqual(apt["geo_precision"], "unknown")

    def test_geocode_failure_clears_coords(self):
        self._ins("SD-B", "bezposrednikov", "Нет такого адреса")
        dbmod.rebuild_geo(self.db, geocoder=lambda a: None)
        apt = dbmod.get_apartment_by_id("SD-B", db_path=self.db)
        self.assertIsNone(apt["lat"])
        self.assertEqual(apt["geo_source"], "none")
        self.assertEqual(apt["geo_precision"], "none")

    def test_cian_real_coords_kept_and_relabelled(self):
        self._ins("SD-C", "cian", "Томск, улица Киевская, 10", lat=56.472, lng=84.96)
        called = {"n": 0}
        def geocoder(a):
            called["n"] += 1
            return None
        dbmod.rebuild_geo(self.db, geocoder=geocoder)
        apt = dbmod.get_apartment_by_id("SD-C", db_path=self.db)
        self.assertAlmostEqual(apt["lat"], 56.472, places=3)
        self.assertEqual(apt["geo_source"], "cian")
        self.assertEqual(apt["geo_precision"], "unknown")
        self.assertEqual(called["n"], 0)  # cian coords kept, no geocode needed

    def test_each_listing_keeps_its_own_point(self):
        self._ins("SD-1", "avito", "Томск, ул. А, 1")
        self._ins("SD-2", "avito", "Томск, ул. Б, 2")
        def geocoder(addr):
            if "А" in addr:
                return {"lat": 56.41, "lng": 84.91, "precision": "unknown", "source": "geocoded"}
            return {"lat": 56.52, "lng": 85.02, "precision": "unknown", "source": "geocoded"}
        dbmod.rebuild_geo(self.db, geocoder=geocoder)
        a1 = dbmod.get_apartment_by_id("SD-1", db_path=self.db)
        a2 = dbmod.get_apartment_by_id("SD-2", db_path=self.db)
        self.assertAlmostEqual(a1["lat"], 56.41, places=2)
        self.assertAlmostEqual(a2["lat"], 56.52, places=2)
        self.assertNotEqual((a1["lat"], a1["lng"]), (a2["lat"], a2["lng"]))


if __name__ == "__main__":
    unittest.main()
