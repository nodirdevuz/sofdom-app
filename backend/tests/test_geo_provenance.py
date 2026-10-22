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
import subprocess
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

from geo_utils import (
    haversine_distance,
    calc_radius_bbox,
    TOMSK_AGGLOMERATION_ENVELOPE,
    TOMSK_CENTER_PLACEHOLDER_LAT,
    TOMSK_CENTER_PLACEHOLDER_LNG,
    detect_city,
    detect_district,
    detect_tomsk_district,
    classify_coordinates,
    is_center_placeholder,
    is_in_tomsk_envelope,
    is_in_city_envelope,
    CityProfile,
    DistrictRule,
    TOMSK_PROFILE,
    get_city_profile,
    list_registered_cities,
    register_city_profile,
    CITY_REGISTRY,
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
    """(b) Валидные координаты из источника сохраняются с правильным уровнем точности."""

    def test_cian_coordinates_without_accuracy_classified_as_unknown(self):
        """Без явного признака точности до дома координаты Циан помечаются unknown."""
        lat_in = 56.4789
        lng_in = 84.9698
        clean_lat, clean_lng, precision = classify_coordinates(lat_in, lng_in, city="Томск", source="cian")
        self.assertEqual(clean_lat, 56.4789)
        self.assertEqual(clean_lng, 84.9698)
        self.assertEqual(precision, "unknown")

    def test_cian_coordinates_safely_marked_unknown_without_house_guarantee(self):
        """
        Даже если в сырых данных переданы accuracy='exact'/'house'/'дом',
        координаты Циан без подтверждённого источника провайдера не заявляют точность до дома
        и безопасно классифицируются как precision='unknown'.
        """
        for acc in ("exact", "house", "exact_house", "building", "address", "точно", "дом"):
            clean_lat, clean_lng, precision = classify_coordinates(
                56.4789, 84.9698, city="Томск", source="cian", accuracy=acc
            )
            self.assertEqual(clean_lat, 56.4789)
            self.assertEqual(clean_lng, 84.9698)
            self.assertEqual(precision, "unknown", f"Координаты Циан должны быть unknown, а не exact")

    def test_verified_source_coordinates_classified_as_exact(self):
        """Проверенные модератором/тестами координаты всегда получают статус exact."""
        for src in ("verified", "test_verified"):
            clean_lat, clean_lng, precision = classify_coordinates(56.4789, 84.9698, city="Томск", source=src)
            self.assertEqual(precision, "exact")
            self.assertEqual(clean_lat, 56.4789)
            self.assertEqual(clean_lng, 84.9698)

    def test_upsert_preserves_valid_exact_coordinates(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
            temp_db = tf.name

        try:
            db.init_db(db_path=temp_db)
            item = {
                "id": "verified_test_1",
                "source": "test_verified",
                "title": "2-к. квартира",
                "price": 30000,
                "address": "г. Томск, ул. Фрунзе, 102",
                "city": "Томск",
                "district": "Советский район",
                "lat": 56.478912,
                "lng": 84.969845,
                "geo_precision": "exact",
                "geo_source": "test_verified"
            }
            db.upsert_apartment(item, db_path=temp_db)
            apt = db.get_apartment_by_id("verified_test_1", db_path=temp_db)
            self.assertIsNotNone(apt)
            self.assertEqual(apt["lat"], 56.478912)
            self.assertEqual(apt["lng"], 84.969845)
            self.assertEqual(apt["geo_precision"], "exact")
            self.assertEqual(apt["geo_source"], "test_verified")
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
            self.assertEqual(apt["geo_precision"], "unknown")
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
            "source": "test_verified",
            "title": "Точная квартира",
            "price": 25000,
            "address": "г. Томск, ул. Усова, 15",
            "city": "Томск",
            "district": "Кировский район",
            "lat": 56.4600,
            "lng": 84.9700,
            "geo_precision": "exact",
            "geo_source": "test_verified"
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

        # 5. Точка с неизвестной точностью (Циан без accuracy)
        db.upsert_apartment({
            "id": "apt_unknown",
            "source": "cian",
            "title": "Квартира с неизвестной точностью",
            "price": 27000,
            "address": "г. Томск, ул. Кирова, 20",
            "city": "Томск",
            "district": "Кировский район",
            "lat": 56.4650,
            "lng": 84.9750,
            "geo_precision": "unknown",
            "geo_source": "cian"
        }, db_path=self.temp_db)

    def tearDown(self):
        if os.path.exists(self.temp_db):
            os.remove(self.temp_db)

    def test_map_endpoint_filters_unqualified_points(self):
        """Объявления без координат и заглушки центра не возвращаются на карте."""
        res = db.list_apartments_geo(db_path=self.temp_db)
        point_ids = {p["id"] for p in res["apartments"]}

        self.assertIn("apt_exact", point_ids)
        self.assertIn("apt_approx", point_ids)
        self.assertIn("apt_unknown", point_ids)
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

        unknown = by_id["apt_unknown"]
        self.assertEqual(unknown["geo_precision"], "unknown")
        self.assertTrue(unknown["is_approximate"])
        self.assertIsNone(unknown["distance_km"])

    def test_radius_search_excludes_approximate_and_unknown_points(self):
        """Приблизительные и неизвестные точки не попадают в точный поиск рядом по радиусу."""
        res = db.list_apartments_geo(
            center_lat=56.4600,
            center_lng=84.9700,
            radius_km=1.0,
            db_path=self.temp_db
        )
        point_ids = {p["id"] for p in res["apartments"]}

        self.assertIn("apt_exact", point_ids, "Точная точка должна попасть в радиусный поиск")
        self.assertNotIn("apt_approx", point_ids, "Приблизительная точка не должна попадать в точный поиск рядом")
        self.assertNotIn("apt_unknown", point_ids, "Точка неизвестной точности не должна попадать в точный поиск рядом")

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


class TestOrchestratorProvenanceRegressions(unittest.TestCase):
    """
    Регрессионные тесты для инвариантов достоверности геолокации (provenance),
    выявленных при проверке оркестратора.
    """

    def setUp(self):
        self.tf = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db = self.tf.name
        db.init_db(db_path=self.temp_db)

    def tearDown(self):
        if os.path.exists(self.temp_db):
            os.remove(self.temp_db)

    def test_upsert_resets_exact_coordinates_when_overwritten_with_none(self):
        """
        Дефект оркестратора (a):
        Если сначала вставлены точные координаты (56.48, 84.97, exact), а затем
        тот же ID обновлён с lat=None, lng=None — старые координаты и exact
        НЕ должны оставаться в БД.
        """
        apt_id = "test_provenance_a"
        # 1. Вставка точной точки
        item_exact = {
            "id": apt_id,
            "source": "test_verified",
            "title": "Квартира с точной точкой",
            "price": 30000,
            "address": "г. Томск, ул. Кирова, 10",
            "city": "Томск",
            "lat": 56.4800,
            "lng": 84.9700,
            "geo_precision": "exact",
            "geo_source": "test_verified",
            "geo_observed_at": "2026-10-22 19:00:00"
        }
        db.upsert_apartment(item_exact, db_path=self.temp_db)
        apt1 = db.get_apartment_by_id(apt_id, db_path=self.temp_db)
        self.assertEqual(apt1["lat"], 56.4800)
        self.assertEqual(apt1["lng"], 84.9700)
        self.assertEqual(apt1["geo_precision"], "exact")
        self.assertEqual(apt1["geo_source"], "test_verified")
        self.assertEqual(apt1.get("geo_observed_at"), "2026-10-22 19:00:00")

        # 2. Обновление того же ID с lat=None, lng=None
        item_none = {
            "id": apt_id,
            "source": "cian",
            "title": "Квартира с точной точкой (обновление без гео)",
            "price": 31000,
            "address": "г. Томск, ул. Кирова, 10",
            "city": "Томск",
            "lat": None,
            "lng": None,
            "geo_precision": "none",
            "geo_source": "none"
        }
        db.upsert_apartment(item_none, db_path=self.temp_db)
        apt2 = db.get_apartment_by_id(apt_id, db_path=self.temp_db)
        self.assertIsNone(apt2["lat"], "Старая широта не должна оставаться при обновлении на None")
        self.assertIsNone(apt2["lng"], "Старая долгота не должна оставаться при обновлении на None")
        self.assertEqual(apt2["geo_precision"], "none", "Старый статус exact не должен сохраняться при отсутствии координат")
        self.assertEqual(apt2["geo_source"], "none")
        self.assertIsNone(apt2.get("geo_observed_at"), "geo_observed_at должен быть сброшен в None")

    def test_invalid_coordinates_cannot_force_exact_or_caller_source(self):
        """
        Дефект оркестратора (b):
        Входные данные с lat=95, lng=200, geo_precision='exact', geo_source='caller'
        не должны приводить к lat=NULL с метаданными exact/caller.
        """
        apt_id = "test_provenance_b"
        item_bad = {
            "id": apt_id,
            "source": "cian",
            "title": "Невалидные координаты",
            "price": 25000,
            "address": "г. Томск, пр. Ленина, 50",
            "city": "Томск",
            "lat": 95.0,
            "lng": 200.0,
            "geo_precision": "exact",
            "geo_source": "caller"
        }
        db.upsert_apartment(item_bad, db_path=self.temp_db)
        apt = db.get_apartment_by_id(apt_id, db_path=self.temp_db)
        self.assertIsNone(apt["lat"])
        self.assertIsNone(apt["lng"])
        self.assertEqual(apt["geo_precision"], "none", "Невалидные координаты обязаны иметь geo_precision='none'")
        self.assertEqual(apt["geo_source"], "none", "При невалидных координатах geo_source не может быть 'caller'")
        self.assertIsNone(apt.get("geo_observed_at"))

    def test_legacy_avito_jitter_does_not_become_exact(self):
        """
        Координаты Авито и БезПосредников (включая синтетический legacy jitter)
        не могут стать exact, даже если числовые значения попадают в диапазон Томска.
        """
        # 1. Попытка вставки через upsert с попыткой проставить 'exact'
        item_avito = {
            "id": "avito_jitter_1",
            "source": "avito",
            "title": "Авито со случайным джиттером",
            "price": 20000,
            "address": "г. Томск, ул. Фрунзе, 20",
            "city": "Томск",
            "lat": 56.485123,
            "lng": 84.965432,
            "geo_precision": "exact"
        }
        db.upsert_apartment(item_avito, db_path=self.temp_db)
        apt = db.get_apartment_by_id("avito_jitter_1", db_path=self.temp_db)
        self.assertIsNone(apt["lat"], "Синтетические координаты Авито должны быть отброшены")
        self.assertIsNone(apt["lng"])
        self.assertEqual(apt["geo_precision"], "none")

        # 2. Нормализация старой записи через enrich_tomsk_geo
        with db.get_connection(self.temp_db) as conn:
            conn.execute("""
            INSERT INTO apartments (id, source, title, price, address, city, district, lat, lng, geo_precision, geo_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, ("legacy_avito_row", "avito", "Старая запись", 21000, "г. Томск, ул. Усова", "Томск", "Кировский район",
                  56.461234, 84.971234, "exact", "legacy_jitter"))
            conn.commit()

        db.enrich_tomsk_geo(db_path=self.temp_db)
        apt_legacy = db.get_apartment_by_id("legacy_avito_row", db_path=self.temp_db)
        self.assertIsNone(apt_legacy["lat"])
        self.assertIsNone(apt_legacy["lng"])
        self.assertEqual(apt_legacy["geo_precision"], "none")
        self.assertEqual(apt_legacy["geo_source"], "none")


class TestSpatialPreFilterAndRadiusSearch(unittest.TestCase):
    """
    Тесты пространственной предварительной фильтрации (spatial pre-filter bbox)
    и радиусного поиска в db.list_apartments_geo.
    """

    def setUp(self):
        self.tf = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db = self.tf.name
        db.init_db(db_path=self.temp_db)

    def tearDown(self):
        if os.path.exists(self.temp_db):
            os.remove(self.temp_db)

    def test_radius_search_not_starved_by_distant_cheaper_apartments_with_limit(self):
        """
        Связка SQL LIMIT и радиуса:
        Если в базе есть много дешёвых объектов за пределами радиуса,
        spatial pre-filter в SQL не позволяет им вытеснить близкие подходящие квартиры.
        """
        center_lat = 56.4600
        center_lng = 84.9700

        # Вставляем 10 дешёвых квартир далеко от центра (~15 км, цена 10 000 руб)
        for i in range(10):
            db.upsert_apartment({
                "id": f"distant_cheap_{i}",
                "source": "test_verified",
                "title": f"Далёкая дешёвая квартира {i}",
                "price": 10000 + i * 100,
                "address": "г. Томск, окраина",
                "city": "Томск",
                "lat": 56.5700,
                "lng": 84.9700,
                "geo_precision": "exact",
                "geo_source": "test_verified"
            }, db_path=self.temp_db)

        # Вставляем 2 более дорогие квартиры прямо в центре (~100 м, цена 40 000 руб)
        for i in range(2):
            db.upsert_apartment({
                "id": f"nearby_expensive_{i}",
                "source": "test_verified",
                "title": f"Близкая квартира {i}",
                "price": 40000 + i * 500,
                "address": "г. Томск, центр",
                "city": "Томск",
                "lat": 56.4605 + i * 0.0002,
                "lng": 84.9705,
                "geo_precision": "exact",
                "geo_source": "test_verified"
            }, db_path=self.temp_db)

        # Запрашиваем радиус 1.0 км с limit=5
        # Без spatial bbox pre-filter 5 слотов LIMIT заняли бы дешёвые далёкие квартиры (price ~10000),
        # а затем в Python они были бы отброшены из-за dist > 1.0 км, дав пустой результат!
        res = db.list_apartments_geo(
            center_lat=center_lat,
            center_lng=center_lng,
            radius_km=1.0,
            limit=5,
            db_path=self.temp_db
        )
        returned_ids = {a["id"] for a in res["apartments"]}
        self.assertIn("nearby_expensive_0", returned_ids, "Близкая квартира 0 должна попасть в результат")
        self.assertIn("nearby_expensive_1", returned_ids, "Близкая квартира 1 должна попасть в результат")
        self.assertEqual(len(res["apartments"]), 2)

    def test_radius_search_without_center_coordinates_raises_validation_error(self):
        """
        Вызов с radius_km без center_lat/center_lng возвращает ошибку валидации (ValueError),
        а не игнорирует радиус молча.
        """
        db.upsert_apartment({
            "id": "apt_no_center_test",
            "source": "cian",
            "title": "Квартира",
            "price": 25000,
            "address": "г. Томск, ул. Ленина, 1",
            "city": "Томск",
            "lat": 56.4600,
            "lng": 84.9700,
            "geo_accuracy": "house",
            "geo_precision": "exact",
            "geo_source": "cian"
        }, db_path=self.temp_db)

        with self.assertRaises(ValueError):
            db.list_apartments_geo(
                radius_km=3.0,
                center_lat=None,
                center_lng=None,
                db_path=self.temp_db
            )

    def test_frontend_fallback_marked_unknown_not_exact(self):
        """
        Проверка исходного кода frontend:
        getFallbackMapData не подставляет 'exact' по умолчанию для fallback-объектов,
        а помечает их 'unknown', сбрасывает distance_km и исключает из точного поиска по радиусу.
        """
        frontend_map_service_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "..", "..", "frontend", "src", "services", "mapService.ts"
        )
        with open(frontend_map_service_path, encoding="utf-8") as f:
            code = f.read()

        self.assertNotIn("geo_precision: o.geo_precision || 'exact'", code,
                         "Frontend fallback не должен подставлять 'exact' по умолчанию")
        self.assertIn("geo_precision: o.geo_precision || 'unknown'", code)
        self.assertIn("geo_precision || 'unknown'", code)

    def test_radius_search_with_over_250_corner_points_outside_circle_with_limit_1(self):
        """
        Регрессионный тест замечания оркестратора 1:
        >250 дешёвых точек в углах bbox, но за пределами круга радиуса,
        НЕ должны вытеснять подходящую точку внутри радиуса при limit=1.
        """
        center_lat = 56.4600
        center_lng = 84.9700
        radius_km = 1.0

        min_lat, max_lat, min_lng, max_lng = calc_radius_bbox(center_lat, center_lng, radius_km)
        corner_lat = max_lat - 0.0001
        corner_lng = max_lng - 0.0001

        # Убедимся, что угловая точка действительно попадает в bbox, но находится за пределами радиуса 1.0 км
        self.assertTrue(min_lat <= corner_lat <= max_lat)
        self.assertTrue(min_lng <= corner_lng <= max_lng)
        corner_dist = haversine_distance(center_lat, center_lng, corner_lat, corner_lng)
        self.assertGreater(corner_dist, radius_km, "Угловая точка bbox должна быть за пределами круга 1.0 км")

        # Вставляем 260 дешёвых точек (цена 1 000..3 600 руб) в угол bbox
        for i in range(260):
            db.upsert_apartment({
                "id": f"corner_cheap_{i}",
                "source": "test_verified",
                "title": f"Угловая точка вне круга {i}",
                "price": 1000 + i * 5,
                "address": "г. Томск, угол bbox",
                "city": "Томск",
                "lat": corner_lat,
                "lng": corner_lng,
                "geo_precision": "exact",
                "geo_source": "test_verified"
            }, db_path=self.temp_db)

        # Вставляем 1 подходящую точку прямо в центре (цена 50 000 руб, расстояние ~15 м)
        target_lat = center_lat + 0.0001
        target_lng = center_lng + 0.0001
        target_dist = haversine_distance(center_lat, center_lng, target_lat, target_lng)
        self.assertLess(target_dist, radius_km)

        db.upsert_apartment({
            "id": "suitable_target",
            "source": "test_verified",
            "title": "Подходящая квартира в центре радиуса",
            "price": 50000,
            "address": "г. Томск, центр круга",
            "city": "Томск",
            "lat": target_lat,
            "lng": target_lng,
            "geo_precision": "exact",
            "geo_source": "test_verified"
        }, db_path=self.temp_db)

        # Выполняем поиск с limit=1
        res = db.list_apartments_geo(
            center_lat=center_lat,
            center_lng=center_lng,
            radius_km=radius_km,
            limit=1,
            db_path=self.temp_db
        )

        self.assertEqual(res["count"], 1, "Запрос обязан вернуть 1 подходящую точку, не теряя её из-за углов bbox")
        self.assertEqual(res["apartments"][0]["id"], "suitable_target")
        self.assertLess(res["apartments"][0]["distance_km"], radius_km)

    def test_frontend_marker_properties_and_visual_classes_by_provenance(self):
        """
        Регрессионный тест замечания оркестратора 2:
        Проверяет фактическое построение свойств маркера карты:
        - 'unknown': помечается как 'unknown-pin unverified-pin' с бейджем '?';
        - 'approximate': помечается как 'approximate-pin' с бейджем '~';
        - 'exact': помечается как 'exact-pin' без бейджей сомнения;
        - 'none': исключается из массива маркеров.
        """
        frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "frontend")
        env = dict(os.environ)
        env["PATH"] = f"/opt/homebrew/bin:{env.get('PATH', '')}"

        test_script = """
import { buildMarkerProperties, buildMarkerHtml } from "./src/lib/mapMarkerUtils";

const exactApt = { id: "a1", price_badge: "30 000 ₽", geo_precision: "exact" };
const approxApt = { id: "a2", price_badge: "25 000 ₽", geo_precision: "approximate" };
const unknownApt = { id: "a3", price_badge: "20 000 ₽", geo_precision: "unknown" };

const pExact = buildMarkerProperties(exactApt);
const pApprox = buildMarkerProperties(approxApt);
const pUnknown = buildMarkerProperties(unknownApt);

if (!pExact.geo_class.includes("exact-pin")) throw new Error("exact missing exact-pin");
if (pExact.precision_badge_html !== "") throw new Error("exact must not have precision badge");
if (pExact.geo_class.includes("unverified-pin")) throw new Error("exact must not be unverified");

if (!pApprox.geo_class.includes("approximate-pin")) throw new Error("approx missing approximate-pin");
if (!pApprox.precision_badge_html.includes("~")) throw new Error("approx missing ~ badge");
if (pApprox.geo_class.includes("unverified-pin")) throw new Error("approx is not unknown");

if (!pUnknown.geo_class.includes("unverified-pin") || !pUnknown.geo_class.includes("unknown-pin")) {
  throw new Error("unknown missing unverified-pin / unknown-pin");
}
if (!pUnknown.precision_badge_html.includes("?")) throw new Error("unknown missing ? badge");
if (pUnknown.geo_class.includes("exact-pin")) throw new Error("unknown must not be exact-pin");

const htmlUnknown = buildMarkerHtml(pUnknown);
if (!htmlUnknown.includes("unverified-pin") || !htmlUnknown.includes("?")) {
  throw new Error("htmlUnknown missing visual unverified pin");
}
        """

        result = subprocess.run(
            ["npx", "tsx", "-e", test_script],
            cwd=frontend_dir,
            env=env,
            capture_output=True,
            text=True
        )
        self.assertEqual(result.returncode, 0, f"TypeScript marker verification failed: {result.stderr}")

    def test_cian_provenance_accuracy_without_house_guarantee(self):
        """
        Регрессионный тест:
        Координаты Циан без подтверждения точности до дома маркируются unknown
        и не заявляют exact без подтверждающих метаданных.
        Даже при наличии accuracy='house' они остаются unknown.
        Только проверенные источники (verified / test_verified) получают exact.
        """
        clean_lat, clean_lng, precision = classify_coordinates(56.4800, 84.9700, city="Томск", source="cian")
        self.assertEqual(precision, "unknown")
        self.assertEqual(clean_lat, 56.4800)
        self.assertEqual(clean_lng, 84.9700)

        clean_lat_h, clean_lng_h, precision_h = classify_coordinates(
            56.4800, 84.9700, city="Томск", source="cian", accuracy="house"
        )
        self.assertEqual(precision_h, "unknown", "Cian координаты без доказанной точности дома не должны получать exact")

        clean_lat_v, clean_lng_v, precision_v = classify_coordinates(
            56.4800, 84.9700, city="Томск", source="test_verified"
        )
        self.assertEqual(precision_v, "exact")

        # Проверяем, что в scraper.py координаты Циан классифицируются через classify_coordinates
        scraper_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scraper.py")
        with open(scraper_file, encoding="utf-8") as f:
            code = f.read()

        self.assertIn("classify_coordinates", code)
        self.assertIn("source='cian'", code)


class TestGeoObservedAtPolicy(unittest.TestCase):
    """
    Проверка времени фиксации геолокации (geo_observed_at):
    - enrich_tomsk_geo НЕ обновляет время на текущее;
    - сохраняется исходное время наблюдения или NULL;
    - свежее наблюдение обновляется только при явной передаче из источника;
    - при сбросе координат в None geo_observed_at сбрасывается в None.
    """

    def setUp(self):
        self.tf = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db = self.tf.name
        db.init_db(db_path=self.temp_db)

    def tearDown(self):
        if os.path.exists(self.temp_db):
            os.remove(self.temp_db)

    def test_enrich_tomsk_geo_preserves_existing_geo_observed_at(self):
        """Локальная нормализация enrich_tomsk_geo сохраняет исходное geo_observed_at без перезаписи."""
        past_ts = "2025-05-15 10:30:00"
        with db.get_connection(self.temp_db) as conn:
            conn.execute("""
            INSERT INTO apartments (
                id, source, title, price, address, city, district, lat, lng,
                geo_precision, geo_source, geo_observed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "obs_test_1", "cian", "Квартира", 25000,
                "г. Томск, ул. Кирова, 15", "Томск", "Кировский район",
                56.4600, 84.9700, "unknown", "cian", past_ts
            ))
            conn.commit()

        # Запускаем локальную нормализацию
        db.enrich_tomsk_geo(db_path=self.temp_db)

        apt = db.get_apartment_by_id("obs_test_1", db_path=self.temp_db)
        self.assertEqual(apt["geo_observed_at"], past_ts,
                         "enrich_tomsk_geo не должен обновлять существующее время наблюдения на текущее")

    def test_enrich_tomsk_geo_leaves_null_for_unobserved_coords(self):
        """Если у объекта не было geo_observed_at, enrich_tomsk_geo оставляет NULL."""
        with db.get_connection(self.temp_db) as conn:
            conn.execute("""
            INSERT INTO apartments (
                id, source, title, price, address, city, district, lat, lng,
                geo_precision, geo_source, geo_observed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "obs_test_null", "cian", "Квартира", 25000,
                "г. Томск, ул. Кирова, 15", "Томск", "Кировский район",
                56.4600, 84.9700, "unknown", "cian", None
            ))
            conn.commit()

        db.enrich_tomsk_geo(db_path=self.temp_db)

        apt = db.get_apartment_by_id("obs_test_null", db_path=self.temp_db)
        self.assertIsNone(apt["geo_observed_at"],
                          "enrich_tomsk_geo должен оставлять NULL для объектов без времени фиксации")

    def test_live_ingest_sets_geo_observed_at_and_subsequent_update_preserves_it(self):
        """Свежий сборщик задаёт geo_observed_at; последующее обновление без гео сохраняет его."""
        live_ts = "2026-10-22 18:00:00"
        item = {
            "id": "obs_live_1",
            "source": "cian",
            "title": "Свежее объявление",
            "price": 28000,
            "address": "г. Томск, ул. Усова, 5",
            "city": "Томск",
            "lat": 56.4600,
            "lng": 84.9700,
            "geo_accuracy": "house",
            "geo_precision": "exact",
            "geo_source": "cian",
            "geo_observed_at": live_ts
        }
        db.upsert_apartment(item, db_path=self.temp_db)

        apt1 = db.get_apartment_by_id("obs_live_1", db_path=self.temp_db)
        self.assertEqual(apt1["geo_observed_at"], live_ts)

        # Обновление без передачи нового geo_observed_at (например, изменение цены)
        update_item = {
            "id": "obs_live_1",
            "source": "cian",
            "title": "Свежее объявление (скидка)",
            "price": 27000,
            "address": "г. Томск, ул. Усова, 5",
            "city": "Томск",
            "lat": 56.4600,
            "lng": 84.9700,
            "geo_accuracy": "house",
            "geo_precision": "exact",
            "geo_source": "cian"
            # geo_observed_at не передан
        }
        db.upsert_apartment(update_item, db_path=self.temp_db)

        apt2 = db.get_apartment_by_id("obs_live_1", db_path=self.temp_db)
        self.assertEqual(apt2["price"], 27000)
        self.assertEqual(apt2["geo_observed_at"], live_ts,
                         "При обновлении без свежего geo_observed_at прежнее время должно сохраняться")

        # При сбросе координат в None geo_observed_at сбрасывается в None
        reset_item = {
            "id": "obs_live_1",
            "source": "cian",
            "title": "Объявление без гео",
            "price": 27000,
            "address": "г. Томск, ул. Усова, 5",
            "city": "Томск",
            "lat": None,
            "lng": None
        }
        db.upsert_apartment(reset_item, db_path=self.temp_db)
        apt3 = db.get_apartment_by_id("obs_live_1", db_path=self.temp_db)
        self.assertIsNone(apt3["lat"])
        self.assertIsNone(apt3["geo_observed_at"], "При сбросе координат geo_observed_at обязан сбрасываться в NULL")

    def test_coordinate_change_without_new_timestamp_resets_geo_observed_at_to_null(self):
        """
        Регрессионный тест замечания оркестратора 2:
        Если координаты меняются (новые lat/lng), но новый geo_observed_at не передан,
        он строго сбрасывается в NULL, а не сохраняет старую метку чужих координат.
        Старый geo_observed_at сохраняется ТОЛЬКО при неизменных координатах.
        """
        live_ts = "2026-10-22 18:00:00"
        item = {
            "id": "coord_change_test",
            "source": "test_verified",
            "title": "Квартира с исходными гео",
            "price": 28000,
            "address": "г. Томск, ул. Усова, 5",
            "city": "Томск",
            "lat": 56.4600,
            "lng": 84.9700,
            "geo_precision": "exact",
            "geo_source": "test_verified",
            "geo_observed_at": live_ts
        }
        db.upsert_apartment(item, db_path=self.temp_db)

        apt1 = db.get_apartment_by_id("coord_change_test", db_path=self.temp_db)
        self.assertEqual(apt1["geo_observed_at"], live_ts)

        # 1. Обновление цены без изменения координат (координаты те же) -> geo_observed_at сохраняется
        db.upsert_apartment({
            "id": "coord_change_test",
            "source": "test_verified",
            "title": "Квартира с обновлённой ценой",
            "price": 29000,
            "address": "г. Томск, ул. Усова, 5",
            "city": "Томск",
            "lat": 56.4600,
            "lng": 84.9700,
            "geo_precision": "exact",
            "geo_source": "test_verified"
            # geo_observed_at не передан
        }, db_path=self.temp_db)
        apt2 = db.get_apartment_by_id("coord_change_test", db_path=self.temp_db)
        self.assertEqual(apt2["price"], 29000)
        self.assertEqual(apt2["geo_observed_at"], live_ts,
                         "При неизменных координатах старый geo_observed_at сохраняется")

        # 2. Изменение координат без передачи нового geo_observed_at -> сбрасывается в NULL
        db.upsert_apartment({
            "id": "coord_change_test",
            "source": "test_verified",
            "title": "Квартира с новыми координатами",
            "price": 29000,
            "address": "г. Томск, ул. Кирова, 12",
            "city": "Томск",
            "lat": 56.4750,
            "lng": 84.9850,
            "geo_precision": "exact",
            "geo_source": "test_verified"
            # geo_observed_at не передан
        }, db_path=self.temp_db)
        apt3 = db.get_apartment_by_id("coord_change_test", db_path=self.temp_db)
        self.assertEqual(apt3["lat"], 56.4750)
        self.assertIsNone(apt3["geo_observed_at"],
                          "При смене координат без передачи таймстемпа geo_observed_at обязан сброситься в NULL")

        # 3. Передача свежего наблюдения с новыми координатами -> обновляется
        new_ts = "2026-10-22 21:00:00"
        db.upsert_apartment({
            "id": "coord_change_test",
            "source": "test_verified",
            "title": "Квартира с подтверждёнными новыми координатами",
            "price": 29000,
            "address": "г. Томск, ул. Кирова, 12",
            "city": "Томск",
            "lat": 56.4750,
            "lng": 84.9850,
            "geo_precision": "exact",
            "geo_source": "test_verified",
            "geo_observed_at": new_ts
        }, db_path=self.temp_db)
        apt4 = db.get_apartment_by_id("coord_change_test", db_path=self.temp_db)
        self.assertEqual(apt4["geo_observed_at"], new_ts)

        # 4. Сброс координат в NULL -> geo_observed_at сбрасывается в NULL
        db.upsert_apartment({
            "id": "coord_change_test",
            "source": "test_verified",
            "title": "Квартира без координат",
            "price": 29000,
            "address": "г. Томск",
            "city": "Томск",
            "lat": None,
            "lng": None
        }, db_path=self.temp_db)
        apt5 = db.get_apartment_by_id("coord_change_test", db_path=self.temp_db)
        self.assertIsNone(apt5["lat"])
        self.assertIsNone(apt5["geo_observed_at"])


class TestRadiusParameterValidation(unittest.TestCase):
    """
    Проверка строгой валидации параметров API и БД:
    - radius_km без центра координат;
    - границы radius_km (0 < r <= 50.0);
    - границы координат (-90..90, -180..180, finite);
    - границы limit (1..1000);
    - границы bbox.
    """

    def setUp(self):
        self.tf = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db = self.tf.name
        db.init_db(db_path=self.temp_db)

    def tearDown(self):
        if os.path.exists(self.temp_db):
            os.remove(self.temp_db)

    def test_radius_without_center_raises_value_error(self):
        with self.assertRaises(ValueError) as ctx:
            db.list_apartments_geo(radius_km=5.0, db_path=self.temp_db)
        self.assertIn("center_lat", str(ctx.exception))

    def test_incomplete_center_coordinates_raise_value_error(self):
        with self.assertRaises(ValueError):
            db.list_apartments_geo(center_lat=56.46, center_lng=None, db_path=self.temp_db)
        with self.assertRaises(ValueError):
            db.list_apartments_geo(center_lat=None, center_lng=84.97, db_path=self.temp_db)

    def test_radius_km_bounds_validation(self):
        # Отрицательный или нулевой радиус
        with self.assertRaises(ValueError):
            db.list_apartments_geo(center_lat=56.46, center_lng=84.97, radius_km=0.0, db_path=self.temp_db)
        with self.assertRaises(ValueError):
            db.list_apartments_geo(center_lat=56.46, center_lng=84.97, radius_km=-1.0, db_path=self.temp_db)
        # Радиус больше 50 км
        with self.assertRaises(ValueError):
            db.list_apartments_geo(center_lat=56.46, center_lng=84.97, radius_km=50.1, db_path=self.temp_db)
        # Нечисловой или бесконечный радиус
        with self.assertRaises(ValueError):
            db.list_apartments_geo(center_lat=56.46, center_lng=84.97, radius_km=float('inf'), db_path=self.temp_db)
        with self.assertRaises(ValueError):
            db.list_apartments_geo(center_lat=56.46, center_lng=84.97, radius_km=float('nan'), db_path=self.temp_db)

    def test_center_coordinates_bounds_validation(self):
        # Широта вне -90..90
        with self.assertRaises(ValueError):
            db.list_apartments_geo(center_lat=95.0, center_lng=84.97, db_path=self.temp_db)
        # Долгота вне -180..180
        with self.assertRaises(ValueError):
            db.list_apartments_geo(center_lat=56.46, center_lng=185.0, db_path=self.temp_db)
        # Бесконечные координаты
        with self.assertRaises(ValueError):
            db.list_apartments_geo(center_lat=float('inf'), center_lng=84.97, db_path=self.temp_db)

    def test_limit_bounds_validation(self):
        with self.assertRaises(ValueError):
            db.list_apartments_geo(limit=0, db_path=self.temp_db)
        with self.assertRaises(ValueError):
            db.list_apartments_geo(limit=-10, db_path=self.temp_db)
        with self.assertRaises(ValueError):
            db.list_apartments_geo(limit=1001, db_path=self.temp_db)

    def test_bbox_validation(self):
        # Некорректный формат (меньше 4 чисел)
        with self.assertRaises(ValueError):
            db.list_apartments_geo(bbox="56.4,84.9", db_path=self.temp_db)
        # min > max
        with self.assertRaises(ValueError):
            db.list_apartments_geo(bbox="56.5,84.9,56.4,85.0", db_path=self.temp_db)

    def test_api_map_endpoint_validation_behavior(self):
        """Проверка FastApi эндпоинта get_apartments_map через вызов функции."""
        import unittest.mock as mock
        fastapi_mock = mock.MagicMock()
        fastapi_mock.FastAPI.return_value.get.return_value = lambda f: f
        fastapi_mock.FastAPI.return_value.post.return_value = lambda f: f
        fastapi_mock.FastAPI.return_value.api_route.return_value = lambda f: f

        class MockHTTPException(Exception):
            def __init__(self, status_code, detail):
                self.status_code = status_code
                self.detail = detail
                super().__init__(f"{status_code}: {detail}")

        fastapi_mock.HTTPException = MockHTTPException
        fastapi_mock.Query = lambda default=None, **kwargs: default

        saved_modules = {k: sys.modules.get(k) for k in [
            'fastapi', 'fastapi.middleware.cors', 'fastapi.staticfiles',
            'fastapi.responses', 'pydantic', 'curl_cffi', 'curl_cffi.requests'
        ]}
        try:
            sys.modules['fastapi'] = fastapi_mock
            sys.modules['fastapi.middleware.cors'] = mock.MagicMock()
            sys.modules['fastapi.staticfiles'] = mock.MagicMock()
            sys.modules['fastapi.responses'] = mock.MagicMock()
            sys.modules['pydantic'] = mock.MagicMock()
            sys.modules['curl_cffi'] = mock.MagicMock()
            sys.modules['curl_cffi.requests'] = mock.MagicMock()

            if 'main' in sys.modules:
                del sys.modules['main']
            import main

            # 1. radius_km без lat/lng -> 400
            with self.assertRaises(MockHTTPException) as ctx:
                main.get_apartments_map(radius_km=3.0, lat=None, lng=None)
            self.assertEqual(ctx.exception.status_code, 400)

            # 2. Неполные координаты центра -> 400
            with self.assertRaises(MockHTTPException) as ctx:
                main.get_apartments_map(lat=56.48, lng=None)
            self.assertEqual(ctx.exception.status_code, 400)

            # 3. Невалидный limit через ValueError из db -> 400
            with self.assertRaises(MockHTTPException) as ctx:
                main.get_apartments_map(limit=0)
            self.assertEqual(ctx.exception.status_code, 400)
        finally:
            for k, v in saved_modules.items():
                if v is None:
                    sys.modules.pop(k, None)
                else:
                    sys.modules[k] = v
            sys.modules.pop('main', None)


class TestRadiusCandidateChunking(unittest.TestCase):
    """
    Проверка пакетированного чтения кандидатов (fetchmany) и защиты от неконтролируемой памяти:
    Гарантирует, что при разбивке кандидатов на пакеты по 250 ни один подходящий объект
    внутри радиуса не теряется, а чтение ограничивается MAX_CANDIDATES = 5000.
    """

    def setUp(self):
        self.tf = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db = self.tf.name
        db.init_db(db_path=self.temp_db)

    def tearDown(self):
        if os.path.exists(self.temp_db):
            os.remove(self.temp_db)

    def test_chunked_streaming_processes_all_candidates_across_batches(self):
        center_lat = 56.4600
        center_lng = 84.9700
        radius_km = 2.0

        # Вставляем 550 точек (более 2 пакетов по 250):
        # 545 точек в углу bbox вне радиуса
        min_lat, max_lat, min_lng, max_lng = calc_radius_bbox(center_lat, center_lng, radius_km)
        corner_lat = max_lat - 0.0001
        corner_lng = max_lng - 0.0001

        for i in range(545):
            db.upsert_apartment({
                "id": f"chunk_corner_{i}",
                "source": "test_verified",
                "title": f"Угловая точка {i}",
                "price": 1000 + i,
                "address": "г. Томск, угол",
                "city": "Томск",
                "lat": corner_lat,
                "lng": corner_lng,
                "geo_precision": "exact",
                "geo_source": "test_verified"
            }, db_path=self.temp_db)

        # 5 подходящих точек внутри радиуса (~200 м от центра)
        for i in range(5):
            db.upsert_apartment({
                "id": f"chunk_inside_{i}",
                "source": "test_verified",
                "title": f"Подходящая точка {i}",
                "price": 40000 + i * 100,
                "address": "г. Томск, центр",
                "city": "Томск",
                "lat": center_lat + 0.001 * (i + 1),
                "lng": center_lng + 0.001 * (i + 1),
                "geo_precision": "exact",
                "geo_source": "test_verified"
            }, db_path=self.temp_db)

        res = db.list_apartments_geo(
            center_lat=center_lat,
            center_lng=center_lng,
            radius_km=radius_km,
            limit=10,
            db_path=self.temp_db
        )

        returned_ids = [a["id"] for a in res["apartments"]]
        self.assertEqual(len(returned_ids), 5, "Все 5 подходящих точек должны быть найдены через пакетное чтение")
        for i in range(5):
            self.assertIn(f"chunk_inside_{i}", returned_ids)

    def test_radius_search_with_over_5000_bbox_corner_points_finds_inside_point_with_limit_1(self):
        """
        Регрессионный тест замечания оркестратора 1:
        5000 дешёвых точек внутри spatial bbox, но вне окружности радиуса,
        плюс 1 подходящая точка около центра внутри круга, но дороже.
        Радиусный поиск обязан найти подходящую точку и вернуть её при limit=1,
        не отбрасывая из-за искусственного потолка в 5000 записей.
        """
        center_lat = 56.4600
        center_lng = 84.9700
        radius_km = 2.0

        min_lat, max_lat, min_lng, max_lng = calc_radius_bbox(center_lat, center_lng, radius_km)
        corner_lat = max_lat - 0.0001
        corner_lng = max_lng - 0.0001
        corner_dist = haversine_distance(center_lat, center_lng, corner_lat, corner_lng)
        self.assertGreater(corner_dist, radius_km, "Угловая точка должна быть вне круга радиуса")

        rows = []
        # 5049 дешёвых точек в углу bbox (цена 1000..6048 руб)
        for i in range(5049):
            rows.append((
                f"bbox_outside_{i}", "test_verified", 0, None, f"Точка вне круга {i}",
                1000 + i, 0, 0, "Томск, угол bbox", "Томск", "Кировский район",
                "1-комн", 30.0, 1, 5, corner_lat, corner_lng,
                "", "", "[]", "", "", "exact", "test_verified", None
            ))

        # 1 подходящая точка внутри радиуса (~200 м от центра), но с более высокой ценой (50 000 руб)
        target_lat = center_lat + 0.001
        target_lng = center_lng + 0.001
        target_dist = haversine_distance(center_lat, center_lng, target_lat, target_lng)
        self.assertLess(target_dist, radius_km)

        rows.append((
            "bbox_target_inside", "test_verified", 0, None, "Подходящая квартира в центре",
            50000, 0, 0, "Томск, центр", "Томск", "Кировский район",
            "2-комн", 50.0, 3, 9, target_lat, target_lng,
            "", "", "[]", "", "", "exact", "test_verified", None
        ))

        with db.get_connection(self.temp_db) as conn:
            conn.executemany("""
            INSERT INTO apartments (
                id, source, is_secret_early_access, secret_until, title,
                price, deposit, commission, address, city, district,
                rooms, area, floor, total_floors, lat, lng,
                phone, owner_name, photos_json, description, url,
                geo_precision, geo_source, geo_observed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, rows)
            conn.commit()

        # Запрос с limit=1 обязан вернуть именно подходящую точку из центра, несмотря на 5049 дешёвых угловых точек
        res = db.list_apartments_geo(
            center_lat=center_lat,
            center_lng=center_lng,
            radius_km=radius_km,
            limit=1,
            db_path=self.temp_db
        )

        self.assertEqual(res["count"], 1, "Должна быть возвращена ровно 1 подходящая точка")
        self.assertEqual(res["apartments"][0]["id"], "bbox_target_inside")
        self.assertEqual(res["apartments"][0]["price"], 50000)
        self.assertAlmostEqual(res["apartments"][0]["distance_km"], target_dist, places=2)

    def test_unmigrated_db_record_with_coords_defaults_to_unknown_not_exact(self):
        """
        Регрессионный тест замечания оркестратора 3:
        Старые записи в БД со значением geo_precision=NULL в list_apartments_geo
        отдаются как geo_precision='unknown' и is_approximate=True, а не fallback 'exact'.
        """
        with db.get_connection(self.temp_db) as conn:
            conn.execute("""
            INSERT INTO apartments (
                id, source, title, price, address, city, district, lat, lng,
                geo_precision, geo_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "legacy_null_precision", "cian", "Старое объявление без миграции", 25000,
                "г. Томск, ул. Кирова, 15", "Томск", "Кировский район",
                56.4600, 84.9700, None, "cian"
            ))
            conn.commit()

        res = db.list_apartments_geo(db_path=self.temp_db)
        apts = {a["id"]: a for a in res["apartments"]}
        self.assertIn("legacy_null_precision", apts)
        self.assertEqual(apts["legacy_null_precision"]["geo_precision"], "unknown")
        self.assertTrue(apts["legacy_null_precision"]["is_approximate"])

    def test_radius_search_bounded_heap_tie_breaking_order(self):
        """
        Проверка порядка сортировки bounded max-heap:
        1. Сначала минимальное расстояние distance_km ASC;
        2. При равном расстоянии — ранний доступ is_secret_early_access DESC;
        3. При равном раннем доступе — цена price ASC;
        4. Bounded heap строго отсекает худшие объекты по лимиту.
        """
        center_lat = 56.4600
        center_lng = 84.9700
        radius_km = 2.0

        # Точка на расстоянии 0.5 км (секретная, дешёвая 30 000)
        p_close_secret = (center_lat + 0.003, center_lng + 0.003)
        # Точка на том же расстоянии 0.5 км (обычная, дешёвая 30 000)
        p_close_regular = (center_lat + 0.003, center_lng + 0.003)
        # Точка на том же расстоянии 0.5 км (обычная, дорогая 40 000)
        p_close_expensive = (center_lat + 0.003, center_lng + 0.003)
        # Точка дальше: 1.5 км (секретная, очень дешёвая 15 000)
        p_far = (center_lat + 0.010, center_lng + 0.010)

        pts = [
            ("pt_far", 1, 15000, p_far[0], p_far[1]),
            ("pt_close_expensive", 0, 40000, p_close_expensive[0], p_close_expensive[1]),
            ("pt_close_regular", 0, 30000, p_close_regular[0], p_close_regular[1]),
            ("pt_close_secret", 1, 30000, p_close_secret[0], p_close_secret[1]),
        ]

        for pid, is_sec, price, lat, lng in pts:
            db.upsert_apartment({
                "id": pid,
                "source": "test_verified",
                "title": pid,
                "price": price,
                "is_secret_early_access": is_sec,
                "address": "г. Томск",
                "city": "Томск",
                "lat": lat,
                "lng": lng,
                "geo_precision": "exact",
                "geo_source": "test_verified"
            }, db_path=self.temp_db)

        res = db.list_apartments_geo(
            center_lat=center_lat,
            center_lng=center_lng,
            radius_km=radius_km,
            limit=3,
            db_path=self.temp_db
        )

        returned_ids = [a["id"] for a in res["apartments"]]
        self.assertEqual(len(returned_ids), 3)
        # 3 ближайшие точки на расстоянии ~0.45 км должны победить далёкую точку (1.5 км),
        # а между собой они должны отсортироваться: secret=1 (30k) -> secret=0 (30k) -> secret=0 (40k)
        self.assertEqual(returned_ids, ["pt_close_secret", "pt_close_regular", "pt_close_expensive"])
        self.assertNotIn("pt_far", returned_ids)


class TestCityProfileArchitectureAndExtensibility(unittest.TestCase):
    """
    Поведенческие тесты архитектуры профилей городов (CityProfile / CityRegistry).
    Гарантирует:
    1. Профиль Томска зарегистрирован и извлекается по имени и всем алиасам.
    2. В текущем этапе активен только Томск (нет хардкода Новосибирска, Москвы и др.).
    3. Неизвестные/будущие города не наследуют конверт Томска.
    4. Неизвестные города ни при каких условиях не получают районы Томска.
    5. Координаты Циан для неизвестных городов не фильтруются томским конвертом,
       но строго остаются 'unknown' (отсутствие профиля никогда не повышает точность).
    6. Отсутствие профиля города строго запрещает присвоение точности 'exact'.
    7. Будущий профиль города может быть зарегистрирован без правки общего алгоритма.
    8. Все существующие кейсы Томска сохраняются в неизменном виде.
    """

    def test_tomsk_profile_registration_and_aliases(self):
        """Профиль Томска доступен по основному имени и всем документированным псевдонимам."""
        profile = get_city_profile("Томск")
        self.assertIsNotNone(profile)
        self.assertEqual(profile.name, "Томск")
        self.assertIs(profile, TOMSK_PROFILE)

        # Проверка регистра и алиасов
        self.assertIs(get_city_profile("томск"), TOMSK_PROFILE)
        self.assertIs(get_city_profile("Tomsk"), TOMSK_PROFILE)
        self.assertIs(get_city_profile(" г. Томск "), TOMSK_PROFILE)
        self.assertIs(get_city_profile("город томск"), TOMSK_PROFILE)
        self.assertIs(get_city_profile("г.томск"), TOMSK_PROFILE)

        # Список зарегистрированных городов содержит ровно Томск на текущем этапе
        self.assertEqual(list_registered_cities(), ["Томск"])

    def test_unknown_and_future_cities_have_no_profile_currently(self):
        """Города, не запущенные в текущем этапе, не имеют профилей и не придумываются отсебятиной."""
        for city_name in ["Новосибирск", "Москва", "Санкт-Петербург", "Красноярск", "Барнаул", "", None]:
            self.assertIsNone(get_city_profile(city_name))

    def test_unknown_city_does_not_inherit_tomsk_envelope(self):
        """Координаты неизвестного города не проверяются ошибочно по конверту Томска."""
        # Координаты в Красноярске (56.01, 92.86) для города 'Красноярск'
        self.assertFalse(is_in_city_envelope(56.01, 92.86, city="Красноярск"))

        # Даже если координаты физически лежат в черте Томска, для города 'Красноярск'
        # envelope профиля отсутствует, поэтому возвращается False (нет ложной привязки)
        self.assertFalse(is_in_city_envelope(56.48, 84.95, city="Красноярск"))

        # Но для Томска те же координаты возвращают True
        self.assertTrue(is_in_city_envelope(56.48, 84.95, city="Томск"))

    def test_unknown_city_never_gets_tomsk_districts(self):
        """Объекты неизвестного или другого города ни при каких условиях не получают районы Томска."""
        # Улица Кирова есть во многих городах, но для Красноярска район Томска недопустим
        self.assertIsNone(detect_district("г. Красноярск, ул. Кирова, 15", city="Красноярск"))
        self.assertIsNone(detect_tomsk_district("г. Красноярск, ул. Кирова, 15", city="Красноярск"))

        # Проспект Фрунзе для Новосибирска не должен становиться Советским районом Томска
        self.assertIsNone(detect_district("г. Новосибирск, пр. Фрунзе, 20", city="Новосибирск"))

        # Даже если передан current_district='Советский район', для чужого города он сбрасывается в None
        self.assertIsNone(detect_district("ул. Ленина, 1", city="Красноярск", current_district="Советский район"))

        # А для Томска сопоставление районов штатно работает
        self.assertEqual(detect_district("г. Томск, ул. Кирова, 15", city="Томск"), "Кировский район")
        self.assertEqual(detect_district("г. Томск, пр. Фрунзе, 20", city="Томск"), "Советский район")

    def test_unknown_city_cian_coords_not_filtered_by_tomsk_envelope_and_stay_unknown(self):
        """
        Координаты Циан для неизвестного города не отбрасываются томским конвертом,
        но строго сохраняют статус 'unknown' (отсутствие профиля не повышает точность).
        """
        # Координаты в Красноярске (56.01, 92.86) далеко за пределами конверта Томска (84.6-85.4)
        c_lat, c_lng, prec = classify_coordinates(56.012345, 92.865432, city="Красноярск", source="cian")
        self.assertIsNotNone(c_lat)
        self.assertIsNotNone(c_lng)
        self.assertEqual(c_lat, 56.012345)
        self.assertEqual(c_lng, 92.865432)
        # КРИТИЧЕСКИ ВАЖНО: статус строго unknown, а не exact
        self.assertEqual(prec, "unknown")

    def test_unknown_city_profile_absence_never_elevates_to_exact(self):
        """
        Отсутствие зарегистрированного профиля города строго запрещает получение статуса 'exact',
        поскольку невозможно валидировать границы и привязку объекта.
        """
        # Даже если источник заявляет 'verified', без профиля города exact недопустим
        c_lat, c_lng, prec = classify_coordinates(56.01, 92.86, city="Красноярск", source="verified")
        self.assertIsNone(c_lat)
        self.assertIsNone(c_lng)
        self.assertEqual(prec, "none")

        c_lat2, c_lng2, prec2 = classify_coordinates(56.48, 84.95, city="Красноярск", source="test_verified")
        self.assertIsNone(c_lat2)
        self.assertIsNone(c_lng2)
        self.assertEqual(prec2, "none")

    def test_extensibility_future_city_profile_registration_without_core_modification(self):
        """
        Демонстрация масштабируемости: новый город подключается через регистрацию CityProfile
        без модификации общего алгоритмического ядра geo_utils.py.
        """
        test_city_profile = CityProfile(
            name="Тестоград",
            aliases=("тестоград", "testograd"),
            envelope={"min_lat": 50.0, "max_lat": 51.0, "min_lng": 80.0, "max_lng": 81.0},
            center_lat=50.5,
            center_lng=80.5,
            placeholder_centers=((50.5000, 80.5000),),
            districts={"Центральный район", "Заречный район"},
            district_rules=[
                DistrictRule("Центральный район", 50.51, 80.51, ("центральн", "главн")),
                DistrictRule("Заречный район", 50.55, 80.55, ("заречн", "речн"))
            ],
            non_city_settlements={"посёлок": "Посёлок"}
        )

        try:
            # Регистрируем профиль в реестре
            register_city_profile(test_city_profile)

            # 1. Профиль извлекается по имени и алиасу
            self.assertIs(get_city_profile("Тестоград"), test_city_profile)
            self.assertIs(get_city_profile("testograd"), test_city_profile)

            # 2. Конверт нового города работает через общую функцию
            self.assertTrue(is_in_city_envelope(50.52, 80.52, city="Тестоград"))
            self.assertFalse(is_in_city_envelope(56.48, 84.95, city="Тестоград"))

            # 3. Районирование нового города работает через общую функцию
            dist = detect_district("ул. Главная, 5", city="Тестоград")
            self.assertEqual(dist, "Центральный район")

            # 4. Проверенные координаты в конверте нового города получают exact
            c_lat, c_lng, prec = classify_coordinates(50.52, 80.52, city="Тестоград", source="verified")
            self.assertEqual(prec, "exact")
            self.assertEqual(c_lat, 50.52)

            # 5. Заглушка центра нового города корректно отсекается
            c_lat_p, _, prec_p = classify_coordinates(50.5000, 80.5000, city="Тестоград", source="cian")
            self.assertEqual(prec_p, "none")
            self.assertIsNone(c_lat_p)
        finally:
            # Очищаем реестр, возвращая к строго единственному профилю Томска
            CITY_REGISTRY.pop("тестоград", None)
            CITY_REGISTRY.pop("testograd", None)

    def test_tomsk_existing_geo_behavior_fully_preserved(self):
        """Все существующие инварианты Томска сохраняются в неизменном виде."""
        # 1. Проверенный источник в Томске -> exact
        lat, lng, prec = classify_coordinates(56.480000, 84.950000, city="Томск", source="verified")
        self.assertEqual(prec, "exact")
        self.assertEqual(lat, 56.48)

        # 2. Циан в Томске -> unknown (не exact)
        lat_c, lng_c, prec_c = classify_coordinates(56.480000, 84.950000, city="Томск", source="cian")
        self.assertEqual(prec_c, "unknown")
        self.assertEqual(lat_c, 56.48)

        # 3. Циан вне конверта Томска (Колпашево) -> none
        lat_k, lng_k, prec_k = classify_coordinates(58.31, 82.90, city="Томск", source="cian")
        self.assertEqual(prec_k, "none")
        self.assertIsNone(lat_k)

        # 4. Заглушка центра Томска -> none
        lat_z, lng_z, prec_z = classify_coordinates(56.4977, 84.9744, city="Томск", source="cian")
        self.assertEqual(prec_z, "none")
        self.assertIsNone(lat_z)


if __name__ == "__main__":
    unittest.main()
