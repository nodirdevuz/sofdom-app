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
            "source": "cian",
            "title": "Квартира с точной точкой",
            "price": 30000,
            "address": "г. Томск, ул. Кирова, 10",
            "city": "Томск",
            "lat": 56.4800,
            "lng": 84.9700,
            "geo_precision": "exact",
            "geo_source": "cian"
        }
        db.upsert_apartment(item_exact, db_path=self.temp_db)
        apt1 = db.get_apartment_by_id(apt_id, db_path=self.temp_db)
        self.assertEqual(apt1["lat"], 56.4800)
        self.assertEqual(apt1["lng"], 84.9700)
        self.assertEqual(apt1["geo_precision"], "exact")
        self.assertEqual(apt1["geo_source"], "cian")
        self.assertIsNotNone(apt1.get("geo_observed_at"))

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
                "source": "cian",
                "title": f"Далёкая дешёвая квартира {i}",
                "price": 10000 + i * 100,
                "address": "г. Томск, окраина",
                "city": "Томск",
                "lat": 56.5700,
                "lng": 84.9700,
                "geo_precision": "exact",
                "geo_source": "cian"
            }, db_path=self.temp_db)

        # Вставляем 2 более дорогие квартиры прямо в центре (~100 м, цена 40 000 руб)
        for i in range(2):
            db.upsert_apartment({
                "id": f"nearby_expensive_{i}",
                "source": "cian",
                "title": f"Близкая квартира {i}",
                "price": 40000 + i * 500,
                "address": "г. Томск, центр",
                "city": "Томск",
                "lat": 56.4605 + i * 0.0002,
                "lng": 84.9705,
                "geo_precision": "exact",
                "geo_source": "cian"
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

    def test_radius_search_without_center_coordinates_handled_safely(self):
        """
        Вызов с radius_km без center_lat/center_lng обрабатывается безопасно:
        не падает с ошибкой, возвращает объекты без радиусной фильтрации и distance_km=None.
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
            "geo_precision": "exact",
            "geo_source": "cian"
        }, db_path=self.temp_db)

        res = db.list_apartments_geo(
            radius_km=3.0,
            center_lat=None,
            center_lng=None,
            db_path=self.temp_db
        )
        self.assertGreaterEqual(res["count"], 1)
        for apt in res["apartments"]:
            self.assertIsNone(apt["distance_km"], "Без координат центра distance_km не может быть вычислен")

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


if __name__ == "__main__":
    unittest.main()
