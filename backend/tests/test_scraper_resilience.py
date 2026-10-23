#!/usr/bin/env python3
"""
backend/tests/test_scraper_resilience.py
Детерминированные офлайн-тесты устойчивости сборщиков ЦИАН, Авито и БезПосредников.

Гарантии:
1. Сетевые сбои, HTTP-ошибки (403/429/500/439), капчи и поломки разметки
   НИКОГДА не маскируются под нормальную пустую выдачу (items = []).
2. Сбой одного источника (например, таймаут ЦИАН) в sync_all() или harvester
   не прерывает сбор с остальных источников (Авито, БезПосредников).
3. Валидная пустая выдача (0 предложений в реальном каталоге) чётко
   отличима от любой ошибки.
4. Тесты полностью офлайн, работают с моками и временными базами SQLite.
"""

import os
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import scraper as scraper_mod
from db import init_db, get_connection
from ahead_of_time_harvester import AheadOfTimeHarvester


class TestCianScraperResilience(unittest.TestCase):
    """Тестирование обязательных сценариев для ЦИАН."""

    def setUp(self):
        self.scraper = scraper_mod.RealtyScraper(avito_session=MagicMock())

    def test_cian_scenario_1_network_timeout(self):
        """Сценарий 1: Сетевой сбой / таймаут выбрасывает явный RuntimeError, не возвращает []."""
        mock_client = MagicMock()
        mock_client.get.side_effect = TimeoutError("Connection timed out after 12s")
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_cian_tomsk(pages=1)
            self.assertIn("Cian request failed on page 1", str(ctx.exception))
            self.assertIn("Connection timed out", str(ctx.exception))

    def test_cian_scenario_2_http_error_or_block(self):
        """Сценарий 2: HTTP 403 / 429 / 500 выбрасывает явный RuntimeError, не маскируется []."""
        for code in [403, 429, 500]:
            mock_client = MagicMock()
            mock_resp = MagicMock()
            mock_resp.status_code = code
            mock_client.get.return_value = mock_resp
            with patch.object(scraper_mod, 'requests', mock_client):
                with self.assertRaises(RuntimeError) as ctx:
                    self.scraper.fetch_cian_tomsk(pages=1)
                self.assertIn(f"Cian page 1 returned HTTP {code}", str(ctx.exception))

    def test_cian_scenario_3a_bot_challenge_captcha(self):
        """Сценарий 3a: Страница с капчей/Cloudflare выбрасывает явный RuntimeError."""
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><body><h1>Cloudflare Captcha Challenge: Доступ ограничен</h1></body></html>"
        mock_client.get.return_value = mock_resp
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_cian_tomsk(pages=1)
            self.assertIn("triggered bot challenge/captcha", str(ctx.exception))

    def test_cian_scenario_3b_unexpected_format_or_missing_script(self):
        """Сценарий 3b: Изменение формата страницы / отсутствие скрипта frontend-serp выбрасывает RuntimeError."""
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><body><div>Каталог объявлений пуст</div></body></html>"
        mock_client.get.return_value = mock_resp
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_cian_tomsk(pages=1)
            self.assertIn("missing frontend-serp config script", str(ctx.exception))

    def test_cian_scenario_3c_missing_results_in_initial_state(self):
        """Сценарий 3c: initialState без ключа 'results' выбрасывает RuntimeError, а не ложный []."""
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = """
        <html><body>
        <script>
        window._cianConfig['frontend-serp'] = [];
        concat([{"key": "initialState", "value": {"otherKey": 123}}])
        </script>
        </body></html>
        """
        mock_client.get.return_value = mock_resp
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_cian_tomsk(pages=1)
            self.assertIn("missing or invalid 'results' object", str(ctx.exception))

    def test_cian_scenario_3d_invalid_results_type(self):
        """Сценарий 3d: initialState с не-dict 'results' выбрасывает RuntimeError."""
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = """
        <html><body>
        <script>
        window._cianConfig['frontend-serp'] = [];
        concat([{"key": "initialState", "value": {"results": "corrupted_string"}}])
        </script>
        </body></html>
        """
        mock_client.get.return_value = mock_resp
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_cian_tomsk(pages=1)
            self.assertIn("missing or invalid 'results' object", str(ctx.exception))

    def test_cian_scenario_3e_missing_offers_in_results(self):
        """Сценарий 3e: results без ключа 'offers' выбрасывает RuntimeError, а не ложный []."""
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = """
        <html><body>
        <script>
        window._cianConfig['frontend-serp'] = [];
        concat([{"key": "initialState", "value": {"results": {"totalOffers": 0}}}])
        </script>
        </body></html>
        """
        mock_client.get.return_value = mock_resp
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_cian_tomsk(pages=1)
            self.assertIn("missing or invalid 'offers' list", str(ctx.exception))

    def test_cian_scenario_3f_invalid_offers_type(self):
        """Сценарий 3f: offers со значением None / dict вместо list выбрасывает RuntimeError."""
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = """
        <html><body>
        <script>
        window._cianConfig['frontend-serp'] = [];
        concat([{"key": "initialState", "value": {"results": {"offers": null}}}])
        </script>
        </body></html>
        """
        mock_client.get.return_value = mock_resp
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_cian_tomsk(pages=1)
            self.assertIn("missing or invalid 'offers' list", str(ctx.exception))

    def test_cian_scenario_4_valid_empty_response(self):
        """Сценарий 4: Валидный пустой ответ (offers: []) успешно возвращает []."""
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = """
        <html><body>
        <script>
        window._cianConfig['frontend-serp'] = [];
        concat([{"key": "initialState", "value": {"results": {"offers": []}}}])
        </script>
        </body></html>
        """
        mock_client.get.return_value = mock_resp
        with patch.object(scraper_mod, 'requests', mock_client):
            items = self.scraper.fetch_cian_tomsk(pages=1)
            self.assertEqual(items, [])


class TestAvitoScraperResilience(unittest.TestCase):
    """Тестирование обязательных сценариев для Авито."""

    def test_avito_scenario_1_network_timeout(self):
        """Сценарий 1: Сетевой сбой / таймаут выбрасывает явный RuntimeError, не возвращает []."""
        mock_session = MagicMock()
        mock_session.get.side_effect = TimeoutError("Avito connection timed out")
        scraper = scraper_mod.RealtyScraper(avito_session=mock_session)
        with self.assertRaises(RuntimeError) as ctx:
            scraper.fetch_avito_tomsk()
        self.assertIn("Avito request failed", str(ctx.exception))
        self.assertIn("connection timed out", str(ctx.exception))

    def test_avito_scenario_2_http_error_or_block(self):
        """Сценарий 2: HTTP 403 / 429 / 439 / 500 выбрасывает явный RuntimeError, не маскируется []."""
        for code in [403, 429, 439, 500]:
            mock_session = MagicMock()
            mock_resp = MagicMock()
            mock_resp.status_code = code
            mock_session.get.return_value = mock_resp
            scraper = scraper_mod.RealtyScraper(avito_session=mock_session)
            with self.assertRaises(RuntimeError) as ctx:
                scraper.fetch_avito_tomsk()
            self.assertIn(f"Avito search returned HTTP {code}", str(ctx.exception))

    def test_avito_scenario_3a_bot_verification_captcha(self):
        """Сценарий 3a: Страница проверки на бота или капчи выбрасывает явный RuntimeError."""
        for text in [
            "<html><body><div>Доступ ограничен: проблема с IP</div></body></html>",
            "<html><body><div>Пожалуйста, подтвердите, что вы человек</div></body></html>",
            "<html><body><div>Avito Firewall Challenge Blocked</div></body></html>"
        ]:
            mock_session = MagicMock()
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.text = text
            mock_session.get.return_value = mock_resp
            scraper = scraper_mod.RealtyScraper(avito_session=mock_session)
            with self.assertRaises(RuntimeError) as ctx:
                scraper.fetch_avito_tomsk()
            self.assertTrue(
                "bot verification/captcha" in str(ctx.exception) or "firewall challenge" in str(ctx.exception)
            )

    def test_avito_scenario_3b_unexpected_format_no_catalog_container(self):
        """Сценарий 3b: Страница промо/акции без каталога и без индикатора пустоты выбрасывает RuntimeError."""
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><body><div>Рекламная страница промо-акции</div></body></html>"
        mock_session.get.return_value = mock_resp
        scraper = scraper_mod.RealtyScraper(avito_session=mock_session)
        with self.assertRaises(RuntimeError) as ctx:
            scraper.fetch_avito_tomsk()
        self.assertIn("Avito unexpected response format", str(ctx.exception))

    def test_avito_scenario_3c_catalog_header_without_items_or_empty_state_fails(self):
        """
        Сценарий 3c: Неполный ответ с заголовком каталога ('page-title', 'Снять квартиру'),
        но без блоков объявлений и без подтверждённого empty-state, выбрасывает RuntimeError.
        """
        incomplete_html = """
        <html><body>
        <div data-marker="page-title">Снять квартиру в Томске</div>
        <div data-marker="catalog-header">Каталог аренды</div>
        </body></html>
        """
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = incomplete_html
        mock_session.get.return_value = mock_resp
        scraper = scraper_mod.RealtyScraper(avito_session=mock_session)
        with self.assertRaises(RuntimeError) as ctx:
            scraper.fetch_avito_tomsk()
        self.assertIn("neither items nor verified empty-state marker found", str(ctx.exception))

    def test_avito_scenario_3d_malformed_item_missing_or_invalid_price_fails(self):
        """
        Сценарий 3d: Карточка объявления найдена (data-marker='item'), но в ней отсутствует
        или не положительна цена (itemProp='price'). Выбрасывает RuntimeError, а не ложный [].
        """
        malformed_html = """
        <html><body>
        <div data-marker="catalog-serp">
            <div data-marker="item" data-item-id="777001">
                <div data-marker="item-title">1-к. квартира, 35 м², 4/9 эт.</div>
                <!-- Price missing / non-positive -->
                <meta content="0" itemProp="price" />
                <div data-marker="item-address">г. Томск, ул. Ленина, 50</div>
            </div>
        </div>
        </body></html>
        """
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = malformed_html
        mock_session.get.return_value = mock_resp
        scraper = scraper_mod.RealtyScraper(avito_session=mock_session)
        with self.assertRaises(RuntimeError) as ctx:
            scraper.fetch_avito_tomsk()
        self.assertIn("one or more items have a missing or non-positive price", str(ctx.exception))

    def test_avito_scenario_3e_mixed_valid_and_malformed_items_fails(self):
        html = """
        <html><body>
        <div data-marker="item" data-item-id="777001"><meta content="0" itemProp="price" /></div>
        <div data-marker="item" data-item-id="777002"><meta itemProp="price" content="25000" /></div>
        </body></html>
        """
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = html
        mock_session.get.return_value = mock_resp
        scraper = scraper_mod.RealtyScraper(avito_session=mock_session)
        with self.assertRaises(RuntimeError) as ctx:
            scraper.fetch_avito_tomsk()
        self.assertIn("parsed 1 of 2 listing blocks", str(ctx.exception))

    def test_avito_scenario_4_valid_empty_response(self):
        """Сценарий 4: Подтверждённый empty-state ('Ничего не найдено' / 'empty-state') успешно возвращает []."""
        for valid_empty_html in [
            "<html><body><div data-marker='catalog-serp'></div><div data-marker='empty-state'>Ничего не найдено</div></body></html>",
            "<html><body><div>По вашему запросу ничего не найдено</div></body></html>",
            "<html><body><div data-marker='empty-state/title'>Ничего не нашлось</div></body></html>"
        ]:
            mock_session = MagicMock()
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.text = valid_empty_html
            mock_session.get.return_value = mock_resp
            scraper = scraper_mod.RealtyScraper(avito_session=mock_session)
            items = scraper.fetch_avito_tomsk()
            self.assertEqual(items, [])


class TestBezposrednikovScraperResilience(unittest.TestCase):
    """Тестирование обязательных сценариев для БезПосредников."""

    def setUp(self):
        self.scraper = scraper_mod.RealtyScraper(avito_session=MagicMock())

    def test_bezposrednikov_scenario_1_network_timeout(self):
        """Сценарий 1: Сетевой сбой / таймаут выбрасывает явный RuntimeError, не возвращает []."""
        mock_client = MagicMock()
        mock_client.get.side_effect = TimeoutError("Bezposrednikov connection timeout")
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_bezposrednikov_tomsk(pages=1)
            self.assertIn("BezPosrednikov request failed on page 1", str(ctx.exception))

    def test_bezposrednikov_scenario_2_http_error_or_block(self):
        """Сценарий 2: HTTP 403 / 429 / 500 выбрасывает явный RuntimeError, не маскируется []."""
        for code in [403, 429, 500]:
            mock_client = MagicMock()
            mock_resp = MagicMock()
            mock_resp.status_code = code
            mock_client.get.return_value = mock_resp
            with patch.object(scraper_mod, 'requests', mock_client):
                with self.assertRaises(RuntimeError) as ctx:
                    self.scraper.fetch_bezposrednikov_tomsk(pages=1)
                self.assertIn(f"BezPosrednikov page 1 returned HTTP {code}", str(ctx.exception))

    def test_bezposrednikov_scenario_3a_bot_block_captcha(self):
        """Сценарий 3a: Страница блокировки/капчи выбрасывает явный RuntimeError."""
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><body><div>Доступ заблокирован администратором (ip-block)</div></body></html>"
        mock_client.get.return_value = mock_resp
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_bezposrednikov_tomsk(pages=1)
            self.assertIn("triggered bot challenge/block", str(ctx.exception))

    def test_bezposrednikov_scenario_3b_unexpected_format(self):
        """Сценарий 3b: Страница с нарушенным форматом без каталога выбрасывает RuntimeError."""
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><body><div>Unknown landing page</div></body></html>"
        mock_client.get.return_value = mock_resp
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_bezposrednikov_tomsk(pages=1)
            self.assertIn("unexpected response format", str(ctx.exception))

    def test_bezposrednikov_scenario_3c_domain_error_page_without_empty_state_fails(self):
        """
        Сценарий 3c: Страница ошибки с текстом домена и заголовком портала
        (например, 'tomsk.bezposrednikov.ru - Аренда квартир'), но без empty-state
        и без контейнера каталога, выбрасывает RuntimeError, а не ложный [].
        """
        error_page_with_domain = """
        <html><body>
        <h1>tomsk.bezposrednikov.ru - Аренда квартир на БезПосредников</h1>
        <div class="alert alert-danger">Внутренняя ошибка сервиса БД</div>
        </body></html>
        """
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = error_page_with_domain
        mock_client.get.return_value = mock_resp
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_bezposrednikov_tomsk(pages=1)
            self.assertIn("neither entries nor verified empty-state found", str(ctx.exception))

    def test_bezposrednikov_scenario_3d_malformed_entry_missing_or_invalid_price_fails(self):
        """
        Сценарий 3d: Карточка объявления найдена (class='sEnLiCell'), но в ней отсутствует
        или не положительна цена (itemprop='price'). Выбрасывает RuntimeError, а не ложный [].
        """
        malformed_html = """
        <html><body>
        <div id="spEntries" class="sEnLiEntries">
            <div class="sEnLiCell" data-sid="99901">
                <div class="sEnLiTitle"><a href="/realty/99901">2-к квартира, 54 м²</a></div>
                <!-- Price tag completely missing or non-positive -->
                <div class="sEnLiCity"><span>Томск, Советский район</span></div>
            </div><!-- cell -->
        </div>
        </body></html>
        """
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = malformed_html
        mock_client.get.return_value = mock_resp
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_bezposrednikov_tomsk(pages=1)
            self.assertIn("one or more items have a missing or non-positive price", str(ctx.exception))

    def test_bezposrednikov_scenario_3e_mixed_valid_and_malformed_entries_fails(self):
        html = """
        <html><body>
        <div class="sEnLiCell" data-sid="99901"><meta itemprop="price" content="0"></div>
        <div class="sEnLiCell" data-sid="99902"><meta itemprop="price" content="25000"></div>
        </body></html>
        """
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = html
        mock_client.get.return_value = mock_resp
        with patch.object(scraper_mod, 'requests', mock_client):
            with self.assertRaises(RuntimeError) as ctx:
                self.scraper.fetch_bezposrednikov_tomsk(pages=1)
        self.assertIn("parsed 1 of 2 listing cells", str(ctx.exception))

    def test_bezposrednikov_scenario_4_valid_empty_response(self):
        """Сценарий 4: Подтверждённый каталог с явным empty-state успешно возвращает []."""
        for valid_empty_html in [
            "<html><body><div class='sEnLiEmpty'>В этом разделе нет объявлений</div></body></html>",
            "<html><body><div id='spEntries' class='sEnLiEntries'></div><div>Объявлений не найдено</div></body></html>"
        ]:
            mock_client = MagicMock()
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.text = valid_empty_html
            mock_client.get.return_value = mock_resp
            with patch.object(scraper_mod, 'requests', mock_client):
                items = self.scraper.fetch_bezposrednikov_tomsk(pages=1)
                self.assertEqual(items, [])


class TestScraperOrchestrationAndIsolation(unittest.TestCase):
    """Тестирование оркестрации в sync_all() и AheadOfTimeHarvester."""

    def test_sync_all_isolates_cian_network_failure_and_collects_avito_and_bezposr(self):
        """
        Проверяет, что таймаут/сбой ЦИАН не роняет весь sync_all():
        Авито и БезПосредников продолжают сбор, найденные объекты сохраняются в БД.
        """
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            temp_db_path = f.name

        try:
            init_db(temp_db_path)

            mock_avito_items = [
                {
                    'id': 'avito_123',
                    'source': 'avito',
                    'title': '1-к квартира, 40 м², 5/10 эт.',
                    'price': 25000,
                    'deposit': 0,
                    'commission': 0,
                    'address': 'Томск, ул. Кирова, 10',
                    'city': 'Томск',
                    'district': 'Кировский район',
                    'rooms': '1-комн',
                    'area': 40.0,
                    'floor': 5,
                    'total_floors': 10,
                    'lat': None,
                    'lng': None,
                    'geo_precision': 'none',
                    'geo_source': 'none',
                    'phone': 'Собственник',
                    'owner_name': 'Собственник',
                    'photos': [],
                    'description': 'Отличная квартира',
                    'url': 'https://avito.ru/123'
                }
            ]

            mock_bezposr_items = [
                {
                    'id': 'bezposr_456',
                    'source': 'bezposrednikov',
                    'title': '2-к квартира, 55 м², 3/9 эт.',
                    'price': 32000,
                    'deposit': 0,
                    'commission': 0,
                    'address': 'Томск, пр. Фрунзе, 50',
                    'city': 'Томск',
                    'district': 'Советский район',
                    'rooms': '2-комн',
                    'area': 55.0,
                    'floor': 3,
                    'total_floors': 9,
                    'lat': None,
                    'lng': None,
                    'geo_precision': 'none',
                    'geo_source': 'none',
                    'phone': 'Собственник',
                    'owner_name': 'Собственник',
                    'photos': [],
                    'description': 'Без комиссии',
                    'url': 'https://bezposrednikov.ru/456'
                }
            ]

            scraper = scraper_mod.RealtyScraper(avito_session=MagicMock())

            # Мокаем: ЦИАН падает по таймауту, Авито и БезПосредников возвращают данные
            with patch.object(scraper, 'fetch_cian_tomsk', side_effect=RuntimeError("Cian request failed on page 1: timed out")), \
                 patch.object(scraper, 'fetch_avito_tomsk', return_value=mock_avito_items), \
                 patch.object(scraper, 'fetch_bezposrednikov_tomsk', return_value=mock_bezposr_items):

                res = scraper.sync_all(db_path=temp_db_path)

                # Сбой ЦИАН зафиксирован, но не уронил весь sync_all
                self.assertFalse(res['success'])
                self.assertIn('cian', res['errors'])
                self.assertIn("Cian request failed on page 1: timed out", res['errors']['cian'])
                self.assertEqual(res['cian_count'], 0)
                self.assertEqual(res['avito_count'], 1)
                self.assertEqual(res['bezposr_count'], 1)
                self.assertEqual(res['total_saved'], 2)

                # Проверяем сохранение в изолированной SQLite
                with get_connection(temp_db_path) as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT id, source FROM apartments ORDER BY id ASC")
                    rows = cursor.fetchall()
                    self.assertEqual(len(rows), 2)
                    self.assertEqual(rows[0]['id'], 'avito_123')
                    self.assertEqual(rows[1]['id'], 'bezposr_456')
        finally:
            if os.path.exists(temp_db_path):
                os.remove(temp_db_path)

    def test_sync_all_full_success(self):
        """Проверяет успешное завершение sync_all() при отсутствии ошибок."""
        scraper = scraper_mod.RealtyScraper(avito_session=MagicMock())
        with patch.object(scraper, 'fetch_cian_tomsk', return_value=[]), \
             patch.object(scraper, 'fetch_avito_tomsk', return_value=[]), \
             patch.object(scraper, 'fetch_bezposrednikov_tomsk', return_value=[]), \
             patch('scraper.upsert_apartment'):

            res = scraper.sync_all()
            self.assertTrue(res['success'])
            self.assertEqual(res['errors'], {})
            self.assertEqual(res['total_saved'], 0)

    def test_harvester_round_failure_semantics(self):
        """
        Проверяет семантику статусов в harvest_round():
        1. Один отказ -> status='partial', success=False, зафиксировано имя ошибки.
        2. Все три отказа -> status='failed', success=False, зафиксированы 3 ошибки.
        3. Все три успеха -> status='success', success=True, errors пустой.
        """
        harvester = AheadOfTimeHarvester()

        # 1. Частичный сбой: ЦИАН упал, остальные работают
        with patch.object(harvester.scraper, 'fetch_cian_tomsk', side_effect=RuntimeError("Cian down")), \
             patch.object(harvester.scraper, 'fetch_avito_tomsk', return_value=[]), \
             patch.object(harvester.scraper, 'fetch_bezposrednikov_tomsk', return_value=[]):

            round_res = harvester.harvest_round()
            self.assertFalse(round_res['success'])
            self.assertEqual(round_res['status'], 'partial')
            self.assertIn('cian', round_res['errors'])
            self.assertEqual(round_res['errors']['cian'], 'Cian down')
            self.assertNotIn('avito', round_res['errors'])
            self.assertNotIn('bezposrednikov', round_res['errors'])

        # 2. Полный сбой: все 3 источника недоступны
        with patch.object(harvester.scraper, 'fetch_cian_tomsk', side_effect=RuntimeError("Cian down")), \
             patch.object(harvester.scraper, 'fetch_avito_tomsk', side_effect=RuntimeError("Avito down")), \
             patch.object(harvester.scraper, 'fetch_bezposrednikov_tomsk', side_effect=RuntimeError("BP down")):

            round_res = harvester.harvest_round()
            self.assertFalse(round_res['success'])
            self.assertEqual(round_res['status'], 'failed')
            self.assertEqual(len(round_res['errors']), 3)

        # 3. Полный успех: все 3 источника ответили
        with patch.object(harvester.scraper, 'fetch_cian_tomsk', return_value=[]), \
             patch.object(harvester.scraper, 'fetch_avito_tomsk', return_value=[]), \
             patch.object(harvester.scraper, 'fetch_bezposrednikov_tomsk', return_value=[]):

            round_res = harvester.harvest_round()
            self.assertTrue(round_res['success'])
            self.assertEqual(round_res['status'], 'success')
            self.assertEqual(round_res['errors'], {})


if __name__ == '__main__':
    unittest.main()
