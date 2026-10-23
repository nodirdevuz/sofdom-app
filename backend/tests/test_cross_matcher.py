import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

import db
from cross_matcher import find_duplicate_match


class TestCrossMatcherEvidence(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db_path = self.temp_db.name
        self.temp_db.close()
        db.init_db(self.db_path)
        db.upsert_apartment({
            "id": "avito_100",
            "source": "avito",
            "title": "1-комнатная квартира",
            "price": 25000,
            "rooms": "1-комн",
            "area": 36,
            "address": "Томск, ул. Ленина, 10",
            "phone": "+79990000000",
        }, db_path=self.db_path)

    def tearDown(self):
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_does_not_borrow_phone_for_different_room_and_area(self):
        target = {
            "id": "bezposr_200",
            "source": "bezposrednikov",
            "price": 25000,
            "rooms": "3-комн",
            "area": 64,
            "address": "Томск, ул. Ленина, 10",
        }
        self.assertIsNone(find_duplicate_match(target, db_path=self.db_path))

    def test_does_not_match_listing_from_same_source(self):
        target = {
            "id": "avito_101",
            "source": "avito",
            "price": 25000,
            "rooms": "1-комн",
            "area": 36,
            "address": "Томск, ул. Ленина, 10",
        }
        self.assertIsNone(find_duplicate_match(target, db_path=self.db_path))

    def test_returns_unique_cross_source_candidate_with_matching_attributes(self):
        target = {
            "id": "bezposr_201",
            "source": "bezposrednikov",
            "price": 25000,
            "rooms": "1-комн",
            "area": 36.5,
            "address": "Томск, ул. Ленина, 10",
        }
        matched = find_duplicate_match(target, db_path=self.db_path)
        self.assertEqual(matched["id"], "avito_100")

    def test_returns_no_candidate_when_multiple_cross_source_matches_exist(self):
        db.upsert_apartment({
            "id": "cian_102",
            "source": "cian",
            "title": "1-комнатная квартира",
            "price": 25000,
            "rooms": "1-комн",
            "area": 36,
            "address": "Томск, ул. Ленина, 10",
            "phone": "+79991111111",
        }, db_path=self.db_path)
        target = {
            "id": "bezposr_202",
            "source": "bezposrednikov",
            "price": 25000,
            "rooms": "1-комн",
            "area": 36,
            "address": "Томск, ул. Ленина, 10",
        }
        self.assertIsNone(find_duplicate_match(target, db_path=self.db_path))


class TestStableKeysAndSourceIsolation(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db_path = self.temp_db.name
        self.temp_db.close()
        db.init_db(self.db_path)

    def tearDown(self):
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_cross_source_identical_numeric_id_does_not_collide(self):
        """Одинаковый числовой ID на разных площадках не перезаписывает запись благодаря префиксу источника."""
        db.upsert_apartment({
            "id": "cian_77777",
            "source": "cian",
            "title": "Квартира на ЦИАН",
            "price": 25000,
            "address": "Томск, Ленина 1",
            "phone": "+79991110001",
        }, db_path=self.db_path)

        db.upsert_apartment({
            "id": "avito_77777",
            "source": "avito",
            "title": "Квартира на Авито",
            "price": 26000,
            "address": "Томск, Кирова 2",
            "phone": "+79992220002",
        }, db_path=self.db_path)

        db.upsert_apartment({
            "id": "bezposr_77777",
            "source": "bezposrednikov",
            "title": "Квартира на БезПосредников",
            "price": 27000,
            "address": "Томск, Фрунзе 3",
            "phone": "+79993330003",
        }, db_path=self.db_path)

        cian_item = db.get_apartment_by_id("cian_77777", db_path=self.db_path)
        avito_item = db.get_apartment_by_id("avito_77777", db_path=self.db_path)
        bp_item = db.get_apartment_by_id("bezposr_77777", db_path=self.db_path)

        self.assertIsNotNone(cian_item)
        self.assertIsNotNone(avito_item)
        self.assertIsNotNone(bp_item)
        self.assertEqual(cian_item["price"], 25000)
        self.assertEqual(avito_item["price"], 26000)
        self.assertEqual(bp_item["price"], 27000)


class TestListingLifecycleAndPhonePersistence(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db_path = self.temp_db.name
        self.temp_db.close()
        db.init_db(self.db_path)

    def tearDown(self):
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_rescrape_preserves_existing_phone_when_new_scrape_has_empty_phone(self):
        """Повторный сбор без телефона не затирает ранее найденный номер."""
        db.upsert_apartment({
            "id": "cian_555",
            "source": "cian",
            "title": "1-комн",
            "price": 22000,
            "address": "Томск, Ленина 5",
            "phone": "+79995554433",
        }, db_path=self.db_path)

        # Повторный сбор возвращает пустой телефон
        db.upsert_apartment({
            "id": "cian_555",
            "source": "cian",
            "title": "1-комн обновлено",
            "price": 23000,
            "address": "Томск, Ленина 5",
            "phone": "",
        }, db_path=self.db_path)

        item = db.get_apartment_by_id("cian_555", db_path=self.db_path)
        self.assertEqual(item["price"], 23000)
        self.assertEqual(item["phone"], "+79995554433")

    def test_rescrape_does_not_purge_missing_apartments_documenting_lifecycle_blocker(self):
        """Фиксация текущего поведения: отсутствующие в новой пачке объявления остаются в БД бессрочно."""
        db.upsert_apartment({
            "id": "cian_active_1",
            "source": "cian",
            "title": "Остаётся на площадке",
            "price": 20000,
            "address": "Томск, Ленина 10",
        }, db_path=self.db_path)

        db.upsert_apartment({
            "id": "cian_removed_2",
            "source": "cian",
            "title": "Снято с площадки",
            "price": 30000,
            "address": "Томск, Ленина 20",
        }, db_path=self.db_path)

        # Следующий сбор содержит только первое объявление
        new_batch = [{
            "id": "cian_active_1",
            "source": "cian",
            "title": "Остаётся на площадке (обновлено)",
            "price": 21000,
            "address": "Томск, Ленина 10",
        }]
        for item in new_batch:
            db.upsert_apartment(item, db_path=self.db_path)

        all_apts = db.list_apartments(db_path=self.db_path)
        ids = {a["id"] for a in all_apts}
        # cian_removed_2 всё ещё присутствует в БД, так как нет статуса снятия/удаления
        self.assertIn("cian_active_1", ids)
        self.assertIn("cian_removed_2", ids)


class TestHarvestRoundIntegration(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db_path = self.temp_db.name
        self.temp_db.close()
        db.init_db(self.db_path)

    def tearDown(self):
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_harvest_round_cross_matches_phone_into_bezposrednikov(self):
        from unittest.mock import MagicMock
        from ahead_of_time_harvester import AheadOfTimeHarvester

        # Сначала сохраняем объявление Авито с телефоном
        db.upsert_apartment({
            "id": "avito_901",
            "source": "avito",
            "title": "2-комнатная квартира",
            "price": 30000,
            "rooms": "2-комн",
            "area": 52.0,
            "address": "Томск, пр-кт Фрунзе, 25",
            "phone": "+79138887766",
            "owner_name": "Иван",
        }, db_path=self.db_path)

        harvester = AheadOfTimeHarvester()
        # Мокаем сборщики: ЦИАН пуст, Авито пуст, БезПосредников отдаёт дубль без телефона
        harvester.scraper.fetch_cian_tomsk = MagicMock(return_value=[])
        harvester.scraper.fetch_avito_tomsk = MagicMock(return_value=[])
        harvester.scraper.fetch_bezposrednikov_tomsk = MagicMock(return_value=[{
            "id": "bezposr_801",
            "source": "bezposrednikov",
            "title": "2-комн на Фрунзе",
            "price": 30000,
            "rooms": "2-комн",
            "area": 52.0,
            "address": "Томск, пр-кт Фрунзе, 25",
            "phone": "БезПосредников (скрыт)",
            "owner_name": "Собственник",
        }])

        res = harvester.harvest_round(db_path=self.db_path)
        self.assertEqual(res["cross_matched"], 1)

        saved = db.get_apartment_by_id("bezposr_801", db_path=self.db_path)
        self.assertEqual(saved["phone"], "+79138887766")
        self.assertEqual(saved["owner_name"], "Иван")

    def test_harvest_round_does_not_cross_match_when_rooms_differ(self):
        from unittest.mock import MagicMock
        from ahead_of_time_harvester import AheadOfTimeHarvester

        # Авито: 1-комн
        db.upsert_apartment({
            "id": "avito_902",
            "source": "avito",
            "title": "1-комнатная",
            "price": 30000,
            "rooms": "1-комн",
            "area": 52.0,
            "address": "Томск, пр-кт Фрунзе, 25",
            "phone": "+79138887766",
        }, db_path=self.db_path)

        harvester = AheadOfTimeHarvester()
        harvester.scraper.fetch_cian_tomsk = MagicMock(return_value=[])
        harvester.scraper.fetch_avito_tomsk = MagicMock(return_value=[])
        # БезПосредников: 2-комн
        harvester.scraper.fetch_bezposrednikov_tomsk = MagicMock(return_value=[{
            "id": "bezposr_802",
            "source": "bezposrednikov",
            "title": "2-комн на Фрунзе",
            "price": 30000,
            "rooms": "2-комн",
            "area": 52.0,
            "address": "Томск, пр-кт Фрунзе, 25",
            "phone": "БезПосредников (скрыт)",
        }])

        res = harvester.harvest_round(db_path=self.db_path)
        self.assertEqual(res["cross_matched"], 0)

        saved = db.get_apartment_by_id("bezposr_802", db_path=self.db_path)
        self.assertIn("БезПосредников", saved["phone"])
