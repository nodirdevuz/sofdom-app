# Анализ мобильных приложений (APK Reverse Engineering)

В папке `SofDom/apks/` собраны оригинальные и распакованные сборки мобильных приложений всех трех платформ для исследования внутренних API и перехвата ранних лотов.

---

## 1. Сводка по сохраненным APK

| Платформа | Файл | Размер | Package Name | Версия | Распакован в |
|---|---|---|---|---|---|
| **БезПосредников** | `bezposrednikov_2.0.0.apk` | 59 MB | `ru.bezposrednikov` | 2.0.0 | `apks/decompiled/bezposrednikov/` |
| **ЦИАН** | `cian_2.449.0.xapk` | 228 MB | `ru.cian.main` | 2.449.0 | `apks/decompiled/cian_main/` |
| **Авито** | `avito_226.0.apk` | 124 MB | `com.avito.android` | 226.0 | `apks/decompiled/avito/` |

---

## 2. Ключевые находки по API

### А. Авито (Avito)
- **Точки входа:** Внутренний мобильный Gateway `m.avito.ru/api/` и WebSocket поток свежих объявлений.
- **Ранний доступ 6ч:** Новые объявления от физлиц получают внутренний флаг пре-индексации (`ltrSecretItemModal` / `badge: early_access`). Мобильное приложение получает их раньше публичного веб-поиска для пользователей с активной подпиской.
- **Фото CDN:** Все фото отдаются через распределенную CDN `https://{00..99}.img.avito.st/image/1/{token}`. Токены поддерживают прямое масштабирование до 1280×960.

### Б. ЦИАН (Cian)
- **Точки входа:** REST API `https://api.cian.ru/v2/offers/` и GraphQL эндпоинты.
- **Фильтрация собственников:** Заголовки `User-Agent: Cian/2.449.0 (Android)` в связке с параметром `is_by_homeowner=1` и `deal_type=rent`.
- **Фото CDN:** Прямые ссылки на `https://images.cdn-cian.ru/images/{slug}-{id}-{idx}.jpg`.

### В. БезПосредников
- **Архитектура:** Приложение работает поверх защищенного SobiPro REST интерфейса `tomsk.bezposrednikov.ru`.
- **Авторизация:** Сессионные cookies и HMAC-подпись запросов.

---

## 3. Инструменты для дальнейшего реверса
- `apktool d <file.apk>` — декомпиляция ресурсов и smali кода.
- `jadx-gui <file.apk>` — просмотр декомпилированного Java/Kotlin кода.
- `strings classes.dex | grep -E "https?://"` — быстрый поиск скрытых API эндпоинтов.
