#!/usr/bin/env python3
"""
test_geo_provenance.py
Unit-тесты для точности и происхождения геолокации объявлений (Приоритет 2).

Проверяет:
a) Координаты центра Томска больше не назначаются сборщиком Авито и БезПосредников.
b) Подлинные координаты из источника сохраняются с geo_precision='exact'.
c) Отсутствующие/нулевые/невалидные координаты не превращаются в фальшивую точную точку.
d) Объявления вне Томска (включая случай SD-1075 в Колпашево) не получают район Томска.
e) Устранена нестабильность hash(id) — нормализация 100% детерминирована.
f) Поведение API и карты при точных, приблизительных и отсутствующих координатах.
Все проверки базы выполняются на временной тестовой SQLite БД без изменения рабочей базы.
"""

import os
import sys
import sqlite3
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

from geo_utils import (
    haversine_distance,
    TOMSK_AGGLOMERATION_ENVELOPE,
    TOMSK_CENTER_PLACEHOLDER_LAT,
    TOMSK_CENTER_PLACEHOLDER_LNG,
    detect_city,
    detect_tomsk_district,
    classify_coordinates,
    is_center_placeholder,
    is_in_tomsk_envelope,
)
import db

SCRAPER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scraper.py")
DB_MODULE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "db.py")


class TestScraperGeoDefaults(unittest.TestCase):
    """(a) Координаты центра Томска больше не назначаются по умолчанию в scraper.py."""

    def test_scraper_source_does_not_hardcode_center_for_avito_or_bezposrednikov(self):
        """В сборщиках Авито и БезПосредников нет присвоения 56.4977 / 84.9744."""
        with open(SCRAPER_PATH, encoding="utf-8") as f:
            source = f.read()

        # Проверяем, что в методах fetch_avito_direct_owners и fetch_bezposrednikov_tomsk
        # больше нет hardcoded центра
        self.assertNotIn("'lat': 56.4977", source)
        self.assertNotIn("'lng': 84.9744", source)

    def test_scraper_avito_and_bezposrednikov_defaults_are_none(self):
        """Парсинг Авито и БезПосредников без координат возвращает None и precision='none'."""
        with open(SCRAPER_PATH, encoding="utf-8") as f:
            source = f.read()

        self.assertIn("'geo_precision': 'none'", source)
        self.assertIn("'geo_source': 'none'", source)


class TestSourceCoordinatesPreserved(unittest.TestCase):
    """(b) Валидные координаты из источника (Циан) сохраняются без искажений."""

    def test_valid_cian_coordinates_preserved_as_exact(self):
        lat_in = 56.4789
        lng_in = 84.9698
        clean_lat, clean_lng, precision = classify_coordinates(lat_in, lng_in, city="Томск", source="cian")
        self.assertEqual(clean_lat, 56.4789)
        self.assertEqual(clean_lng, 84.9698)
        self.assertEqual(precision, "exact")

    def test_upsert_preserves_valid_exact_coordinates(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
            temp_db = tf.name

        try:
            db.init_db(db_path=temp_db)
            item = {
                "id": "cian_test_1",
                "source": "cian",
                "title": "2-к. квартира",
                "price": 30000,
                "address": "г. Томск, ул. Фрунзе, 102",
                "city": "Томск",
                "district": "Советский район",
                "lat": 56.478912,
                "lng": 84.969845,
                "geo_precision": "exact",
                "geo_source": "cian"
            }
            db.upsert_apartment(item, db_path=temp_db)
            apt = db.get_apartment_by_id("cian_test_1", db_path=temp_db)
            self.assertIsNotNone(apt)
            self.assertEqual(apt["lat"], 56.478912)
            self.assertEqual(apt["lng"], 84.969845)
            self.assertEqual(apt["geo_precision"], "exact")
            self.assertEqual(apt["geo_source"], "cian")
        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)


class TestMissingZeroAndInvalidCoordinates(unittest.TestCase):
    """(c) Отсутствующие, нулевые и невалидные координаты не превращаются в фальшивую точную точку."""

    def test_none_coordinates_stay_none(self):
        lat, lng, prec = classify_coordinates(None, None, city="Томск")
        self.assertIsNone(lat)
        self.assertIsNone(lng)
        self.assertEqual(prec, "none")

    def test_zero_coordinates_become_none(self):
        lat, lng, prec = classify_coordinates(0.0, 0.0, city="Томск")
        self.assertIsNone(lat)
        self.assertIsNone(lng)
        self.assertEqual(prec, "none")

    def test_out_of_range_coordinates_become_none(self):
        lat, lng, prec = classify_coordinates(95.0, 200.0, city="Томск")
        self.assertIsNone(lat)
        self.assertIsNone(lng)
        self.assertEqual(prec, "none")

    def test_center_placeholder_becomes_none(self):
        """Точка 56.4977, 84.9744 распознаётся как заглушка и отбрасывается."""
        lat, lng, prec = classify_coordinates(
            TOMSK_CENTER_PLACEHOLDER_LAT,
            TOMSK_CENTER_PLACEHOLDER_LNG,
            city="Томск"
        )
        self.assertIsNone(lat)
        self.assertIsNone(lng)
        self.assertEqual(prec, "none")

    def test_no_fake_point_generated_in_db(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
            temp_db = tf.name

        try:
            db.init_db(db_path=temp_db)
            item = {
                "id": "avito_no_geo",
                "source": "avito",
                "title": "1-к. квартира",
                "price": 20000,
                "address": "г. Томск, ул. Красноармейская, 50",
                "city": "Томск",
                "lat": None,
                "lng": None
            }
            db.upsert_apartment(item, db_path=temp_db)
            db.enrich_tomsk_geo(db_path=temp_db)

            apt = db.get_apartment_by_id("avito_no_geo", db_path=temp_db)
            self.assertIsNone(apt["lat"])
            self.assertIsNone(apt["lng"])
            self.assertEqual(apt["geo_precision"], "none")
            self.assertEqual(apt["district"], "Кировский район")
        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)


class TestRegionalTownsNotTomskDistricts(unittest.TestCase):
    """(d) Объявления вне Томска (Колпашево, Северск и др.) не получают район Томска без оснований."""

    def test_detect_city_kolpashevo(self):
        addr = "Россия, Томская область, Колпашево, улица Нефтеразведчиков, 11"
        city = detect_city(addr, raw_city="Томск", lat=58.312254, lng=82.877418)
        self.assertEqual(city, "Колпашево")

    def test_detect_tomsk_district_rejects_kolpashevo(self):
        addr = "Россия, Томская область, Колпашево, улица Нефтеразведчиков, 11"
        dist = detect_tomsk_district(addr, city="Колпашево", lat=58.312254, lng=82.877418)
        self.assertIsNone(dist, "Колпашево не должно получать район Томска")

    def test_sd_1075_case_reproduced_and_fixed_in_temp_db(self):
        """Воспроизведение кейса SD-1075 на тестовой базе: ошибочный Советский район снимается."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
            temp_db = tf.name

        try:
            db.init_db(db_path=temp_db)
            # Вставляем объект так, как он ошибочно хранился в legacy базе
            with db.get_connection(temp_db) as conn:
                conn.execute("""
                INSERT INTO apartments (
                    id, source, title, price, address, city, district, lat, lng
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    "SD-1075", "cian", "1-комн. квартира, 30 м²", 13000,
                    "Россия, Томская область, Колпашево, улица Нефтеразведчиков, 11",
                    "Томск", "Советский район", 58.312254, 82.877418
                ))
                conn.commit()

            # Запускаем нормализацию
            db.enrich_tomsk_geo(db_path=temp_db)

            apt = db.get_apartment_by_id("SD-1075", db_path=temp_db)
            self.assertEqual(apt["city"], "Колпашево", "Город должен быть исправлен на Колпашево")
            self.assertNotEqual(apt["district"], "Советский район", "Советский район Томска недопустим для Колпашево")
            self.assertEqual(apt["district"], "")
            self.assertEqual(apt["lat"], 58.312254)
            self.assertEqual(apt["lng"], 82.877418)
            self.assertEqual(apt["geo_precision"], "exact")
        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)

    def test_unknown_tomsk_street_does_not_fallback_to_sovetsky(self):
        """Неизвестная улица в Томске не получает фиктивный 'Советский район'."""
        dist = detect_tomsk_district("г. Томск, неизвестная улица, 1", city="Томск")
        self.assertIsNone(dist, "Без совпадений ключевых слов fallback на Советский район запрещён")


class TestDeterministicNoHashJitter(unittest.TestCase):
    """(e) Нестабильность hash(id) устранена: результат нормализации строго детерминирован."""

    def test_no_hash_in_db_enrichment_code(self):
        with open(DB_MODULE_PATH, encoding="utf-8") as f:
            source = f.read()
        self.assertNotIn("hash(apt_id)", source)
        self.assertNotIn("jitter_lat", source)
        self.assertNotIn("jitter_lng", source)

    def test_enrich_tomsk_geo_is_idempotent_and_deterministic(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
            temp_db = tf.name

        try:
            db.init_db(db_path=temp_db)
            items = [
                {"id": f"apt_{i}", "source": "avito", "title": f"Квартира {i}", "price": 20000 + i,
                 "address": "г. Томск, ул. Фрунзе, 18", "city": "Томск"}
                for i in range(10)
            ]
            for it in items:
                db.upsert_apartment(it, db_path=temp_db)

            # Первый прогон
            db.enrich_tomsk_geo(db_path=temp_db)
            with db.get_connection(temp_db) as conn:
                state_1 = [(r["id"], r["district"], r["lat"], r["lng"], r["geo_precision"])
                           for r in conn.execute("SELECT id, district, lat, lng, geo_precision FROM apartments ORDER BY id")]

            # Второй прогон
            db.enrich_tomsk_geo(db_path=temp_db)
            with db.get_connection(temp_db) as conn:
                state_2 = [(r["id"], r["district"], r["lat"], r["lng"], r["geo_precision"])
                           for r in conn.execute("SELECT id, district, lat, lng, geo_precision FROM apartments ORDER BY id")]

            self.assertEqual(state_1, state_2, "Повторный запуск должен давать абсолютно идентичный результат")
        finally:
            if os.path.exists(temp_db):
                os.remove(temp_db)


class TestApiAndMapBehavior(unittest.TestCase):
    """(f) Поведение API и карты при точных, приблизительных координатах и координатах неизвестной точности."""

    def setUp(self):
        self.tf = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db = self.tf.name
        db.init_db(db_path=self.temp_db)

        # 1. Точная точка (в центре Кировского района)
        db.upsert_apartment({
            "id": "apt_exact",
            "source": "cian",
            "title": "Точная квартира",
            "price": 25000,
            "address": "г. Томск, ул. Усова, 15",
            "city": "Томск",
            "district": "Кировский район",
            "lat": 56.4600,
            "lng": 84.9700,
            "geo_precision": "exact",
            "geo_source": "cian"
        }, db_path=self.temp_db)

        # 2. Приблизительная точка (центроид района)
        with db.get_connection(self.temp_db) as conn:
            conn.execute("""
            INSERT INTO apartments (
                id, source, title, price, address, city, district, lat, lng, geo_precision, geo_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "apt_approx", "avito", "Приблизительная квартира", 22000,
                "г. Томск, район Кировский", "Томск", "Кировский район",
                56.4600, 84.9700, "approximate", "district_centroid"
            ))
            conn.commit()

        # 3. Объявление без координат
        db.upsert_apartment({
            "id": "apt_none",
            "source": "bezposrednikov",
            "title": "Квартира без координат",
            "price": 18000,
            "address": "г. Томск, ул. Ленина, 100",
            "city": "Томск",
            "lat": None,
            "lng": None,
            "geo_precision": "none",
            "geo_source": "none"
        }, db_path=self.temp_db)

        # 4. Объявление с устаревшей заглушкой центра Томска (56.4977, 84.9744)
        with db.get_connection(self.temp_db) as conn:
            conn.execute("""
            INSERT INTO apartments (
                id, source, title, price, address, city, district, lat, lng, geo_precision, geo_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "apt_center_placeholder", "legacy", "Старая заглушка", 20000,
                "г. Томск", "Томск", "Советский район",
                56.4977, 84.9744, "none", "legacy_placeholder"
            ))
            conn.commit()

    def tearDown(self):
        if os.path.exists(self.temp_db):
            os.remove(self.temp_db)

    def test_map_endpoint_filters_unqualified_points(self):
        """Объявления без координат и заглушки центра не возвращаются на карте."""
        res = db.list_apartments_geo(db_path=self.temp_db)
        point_ids = {p["id"] for p in res["apartments"]}

        self.assertIn("apt_exact", point_ids)
        self.assertIn("apt_approx", point_ids)
        self.assertNotIn("apt_none", point_ids, "Объект без координат не должен отображаться на карте")
        self.assertNotIn("apt_center_placeholder", point_ids, "Заглушка центра не должна отображаться на карте")

    def test_map_endpoint_distinguishes_exact_and_approximate(self):
        """Точные координаты получают distance_km; приблизительные имеют distance_km=None."""
        res = db.list_apartments_geo(center_lat=56.4600, center_lng=84.9700, db_path=self.temp_db)
        by_id = {p["id"]: p for p in res["apartments"]}

        exact = by_id["apt_exact"]
        self.assertEqual(exact["geo_precision"], "exact")
        self.assertFalse(exact["is_approximate"])
        self.assertIsNotNone(exact["distance_km"])
        self.assertAlmostEqual(exact["distance_km"], 0.0, places=1)

        approx = by_id["apt_approx"]
        self.assertEqual(approx["geo_precision"], "approximate")
        self.assertTrue(approx["is_approximate"])
        self.assertIsNone(approx["distance_km"], "Приблизительная точка не должна выдавать точное расстояние")

    def test_radius_search_excludes_approximate_points(self):
        """Приблизительные точки не попадают в точный поиск рядом по радиусу (например, в радиусе 1 км)."""
        res = db.list_apartments_geo(
            center_lat=56.4600,
            center_lng=84.9700,
            radius_km=1.0,
            db_path=self.temp_db
        )
        point_ids = {p["id"] for p in res["apartments"]}

        self.assertIn("apt_exact", point_ids, "Точная точка должна попасть в радиусный поиск")
        self.assertNotIn("apt_approx", point_ids, "Приблизительная точка не должна попадать в точный поиск рядом")

    def test_schema_migration_on_legacy_sqlite(self):
        """Безопасная миграция схемы: добавление колонок к старой базе без geo_precision."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
            old_db = tf.name

        try:
            # Создаём старую схему без колонок geo_precision и geo_source
            conn = sqlite3.connect(old_db)
            conn.execute("""
            CREATE TABLE apartments (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                title TEXT NOT NULL,
                price INTEGER NOT NULL,
                address TEXT NOT NULL,
                city TEXT DEFAULT 'Томск',
                district TEXT,
                lat REAL,
                lng REAL
            );
            """)
            conn.execute("""
            INSERT INTO apartments VALUES
            ('old_1', 'avito', 'Квартира', 20000, 'г. Томск, ул. Фрунзе, 5', 'Томск', 'Советский район', 56.4977, 84.9744)
            """)
            conn.commit()
            conn.close()

            # Вызываем init_db и enrich_tomsk_geo, которые должны выполнить мягкую миграцию
            db.init_db(db_path=old_db)
            db.enrich_tomsk_geo(db_path=old_db)

            # Проверяем, что колонки успешно добавлены и данные очищены
            conn = sqlite3.connect(old_db)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM apartments WHERE id = 'old_1'")
            row = dict(cursor.fetchone())
            conn.close()

            self.assertIn("geo_precision", row)
            self.assertIn("geo_source", row)
            self.assertIsNone(row["lat"], "Заглушка центра должна быть очищена")
            self.assertIsNone(row["lng"], "Заглушка центра должна быть очищена")
            self.assertEqual(row["geo_precision"], "none")
        finally:
            if os.path.exists(old_db):
                os.remove(old_db)


if __name__ == "__main__":
    unittest.main()
