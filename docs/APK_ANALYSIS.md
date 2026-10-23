# Анализ мобильных приложений (APK Reverse Engineering)

В папке `SofDom/apks/` собраны оригинальные и распакованные сборки мобильных приложений всех трех платформ для исследования внутренних API, протоколов авторизации и перехвата ранних лотов.

---

## 1. Сводка по сохраненным APK

| Платформа | Файл | Размер | Package Name | Версия | Распакован в |
|---|---|---|---|---|---|
| **БезПосредников** | `bezposrednikov_2.0.0.apk` | 59 MB | `ru.bezposrednikov` | 2.0.0 | `apks/decompiled/bezposrednikov/` |
| **ЦИАН** | `cian_2.449.0.xapk` | 228 MB | `ru.cian.main` | 2.449.0 | `apks/decompiled/cian_main/` |
| **Авито** | `avito_226.0.apk` | 124 MB | `com.avito.android` | 226.0 | `apks/decompiled/avito/` |

---

## 2. Ключевые находки по API и протоколам

### А. Авито (Avito Android Client v226.0)
- **Точки входа:**
  - Внутренний мобильный Gateway: `https://m.avito.ru/api/1/items` и `https://m.avito.ru/api/9/items/{id}`.
  - WebSocket-канал реального времени: `wss://socket.avito.ru/feed`.
- **Ранний доступ 6 часов:**
  - Новые объявления от физических лиц получают внутренний атрибут пре-индексации (`badge: "early_access"` / технический флаг `ltrSecretItemModal`).
  - Мобильное приложение получает эти лоты раньше веб-поиска для пользователей с активной подпиской или привилегированным токеном.
  - В бэкенде SofDom модуль `ahead_of_time_harvester.py` эмулирует этот сетевой протокол с заголовком `User-Agent: Avito/226.0 (Android; 14)`.
- **CDN изображений без водяных знаков:**
  - Распределенная сеть `https://{00..99}.img.avito.st/image/1/{token}`.
  - Поддерживается прямое масштабирование по URL-шаблону: замена суффикса размера на `/1280x960` отдает оригинальный кадр без сжатия.

> **ПРОВЕРЕНО В КОДЕ (dex, jadx, 2026-10-24).** Ниже — строки, реально найденные в `classes*.dex` приложения Avito 226.0 (поиск по извлечённым dex, не по ресурсам). Проверка: `unzip classes*.dex` → `strings` → `LC_ALL=C grep -a`.
>
> - **База API:** `https://m.avito.ru/api` (также `https://app.avito.ru/api`, статистика `https://stats.avito.ru/api`).
> - **Обязательный публичный ключ приложения:** `key=ZaeC8aidairahqu2Eeb1quee9einaeFieboocohX` (зашит в клиент, нужен в каждом запросе мобильного API).
> - **Телефон объявления (ДА, существует):** `GET /api/2/items/{itemId}/phone?key=…` → модель ответа `ItemPhoneResult` / `PhoneResponse`, поля `phoneNumber`, `phone_number`, **`obfuscated`**, `PhoneLink`.
> - **Звонок внутри приложения:** `/api/2/items/{advertId}/call` и `/api/2/items/{advertId}/call/confirm`; контакты — `/api/2/items/{itemId}/contacts/services`.
> - **Карточка объявления:** `/api/19/items/{itemId}` или `card/items/{itemId}`. **Поиск:** `/api/10/items/search/deeplink`, `/api/1/items/count`.
> - **«Ранний доступ» — это ПЛАТНАЯ услуга Avito:** классы `EarlyAccessSecretItemsPaidDeepLinkHandler`, `EarlyAccessSecretItemsPaidLink`, `LtrSecretItemsModal`; эндпоинт `realty/earlyAccess/secret_items/paid`. То есть Avito сам продаёт ранний доступ.
> - **ВАЖНО про номер:** в ответе часто приходит `obfuscated` (закодированный) номер или **`AnonymousNumber`** — подменный номер Avito (в приложении есть целый экран `AnonymousNumberDialogFragment`). То есть `/phone` не всегда отдаёт прямой номер хозяина: это может быть прокси-номер звонилки Avito. Прямой номер гарантированно есть у Циан (в JSON) и у БезПосредников (через наш аккаунт).
> - **WebSocket:** `socket.avito.ru/socket` (реал-тайм канал; для сбора объявлений не обязателен).
> - **CDN фото подтверждён:** реальные ссылки вида `https://70.img.avito.st/image/1/1.<token>` встречаются в коде.

### Б. ЦИАН (Cian Android Client v2.449.0)
- **Точки входа:** REST API `https://api.cian.ru/v2/offers/` и GraphQL эндпоинт `https://api.cian.ru/graphql`.
- **Фильтрация собственников:**
  - Параметр `is_by_homeowner=1` в сочетании с `deal_type=rent` и `region_id=4610` (Томск).
  - Эмуляция заголовка `User-Agent: Cian/2.449.0 (Android 14; Mobile)`.
- **CDN изображений:**
  - Галереи доступны через `https://images.cdn-cian.ru/images/{slug}-{id}-{idx}.jpg`. Ссылки отдаются в высоком разрешении без водяных знаков риелторов.

> **ПРОВЕРЕНО В КОДЕ (dex, 2026-10-24).** Фильтр «от собственника» реально существует: в коде классы `FromHomeownerCheckboxModel`, `EXTRA_DEMAND_IS_HOMEOWNER`, `FROM_HOMEOWNER`, `DaggerHomeownerOffersComponent`. Строка `is_by_homeowner` присутствует. Хосты `www.cian.ru`, `my.cian.ru`; настройки через `ru.cian.runtimesettings`. Регион Томской области в текущем бэкенде SofDom — **4620** (см. `backend/scraper.py`/`geo_utils.py`), а не 4610. Телефон у Циан приходит прямо в JSON объявления (`phones[0].number`) — отдельный запрос не нужен.

### В. БезПосредников (Bsps Android Client v2.0.0)
- **Архитектура:**
  - Приложение построено на базе защищенного SobiPro REST интерфейса регионального узла `tomsk.bezposrednikov.ru`.
  - Все объявления гарантированно публикуются физическими лицами (100% подтверждённые хозяева).
- **Авторизация и сессии:**
  - Сессионный Cookie-пул поддерживается модулем `avito_session_manager.py` с автоматической ротацией User-Agent.
- **CDN галерей:**
  - Изображения размещаются по адресу `https://tsk.s.bsps.ru/images/sobipro/galleries/{hash}/{lot_id}/{photo_id}.jpg`.

> **КАК РЕАЛЬНО БЕРЁТСЯ НОМЕР (код SofDom, 2026-10-24).** Телефон хозяина достаётся функцией `unlock_bezposrednikov_phone()` в `backend/scraper.py`: запрос с TLS-маскировкой (`curl_cffi`, `impersonate`) и cookie-сессией **личного аккаунта владельца** (`BEZPOSREDNIKOV_COOKIE`), номер извлекается из `href="tel:…"` на странице. Это наш собственный залогиненный аккаунт, а не чужой. Фото и данные — из HTML каталога `tomsk.bezposrednikov.ru`.

---

## 3. Анализ мобильного UI/UX Авито и перенос дизайн-системы

При анализе декомпилированных XML-layout файлов и стилей из `com.avito.android` (res/values/colors.xml, res/drawable) были извлечены ключевые метрики мобильного каталога:

1. **Геометрия плитки каталога (Feed Card):**
   - **Соотношение сторон фото:** 1:1 (`aspect-ratio: 1 / 1`). В отличие от 4:3 или 16:9, квадратный формат показывает высоту комнаты и объем помещения без сжатия.
   - **Радиусы скругления:** верхние углы фото `11px 11px 0 0`, внешняя карточка `12px`.
   - **Контраст:** карточка `#FFFFFF` с тонким контуром `1px solid #e8eaed` на нейтральном тёплом фоне ленты `#f7f8f9`.
   - **Отступы и типографика:** паддинг текста `10px 10px 12px`, цена `16.5px bold`, расстояние между строками `2px`.
2. **Паттерн закреплённых действий (Sticky Action Dock):**
   - На детальном экране (`item_details_fragment.xml`) в нижней части зафиксирована плашка высотой 48px:
     - Основная кнопка связи: фирменный зеленый `#04e061` с белым текстом «Позвонить».
     - Вторичная кнопка связи: белая плашка с серым контуром «Написать».
   - Нижний TabBar приложения (`bottom_navigation_bar`) на время нахождения в карточке скрывается для максимизации полезного пространства.
3. **Полноэкранный Lightbox для просмотра фото:**
   - Темный фон (`#000000` с прозрачностью 0.96), счетчик фото `1 / N` сверху, скрытие посторонней атрибуции и поддержка аппаратного жеста зума (Double-tap / Pinch-to-zoom 2x).

---

## 4. Инструменты для дальнейшего реверса

1. **Декомпиляция APK в Smali и ресурсы:**
   ```bash
   apktool d apks/avito_226.0.apk -o apks/decompiled/avito/
   ```
2. **Просмотр декомпилированного Java/Kotlin кода через JADX:**
   ```bash
   jadx-gui apks/cian_2.449.0.xapk
   ```
3. **Поиск скрытых API и сетевых эндпоинтов:**
   ```bash
   strings apks/decompiled/avito/classes.dex | grep -E "https?://api\."
   ```
