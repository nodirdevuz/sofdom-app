# Спецификация API и Контрактов Данных SofDom

Серверная часть SofDom работает на базе **FastAPI**. По умолчанию бэкенд запускается на порту `8000`.

---

## 1. Базовые URL

- Локальный API: `http://localhost:8000/api`
- Swagger UI (интерактивная документация): `http://localhost:8000/docs`
- ReDoc UI: `http://localhost:8000/redoc`

---

## 2. Эндпоинты каталога и объектов

### 2.1. Получить список квартир
`GET /api/apartments`

**Параметры запроса (Query Params):**
| Параметр | Тип | Обязательный | Описание | Пример |
|---|---|---|---|---|
| `rooms` | string | Нет | Комнатность через запятую | `1,2` или `studio,1` |
| `district` | string | Нет | Район Томска | `Советский`, `Кировский`, `Ленинский`, `Октябрьский`, `Пригород` |
| `min_price` | int | Нет | Минимальная арендная ставка | `20000` |
| `max_price` | int | Нет | Максимальная арендная ставка | `45000` |
| `source` | string | Нет | Фильтр по источнику | `avito`, `cian`, `bezposrednikov`, `all` |
| `only_direct`| bool | Нет | Только проверенные собственники | `true` |
| `limit` | int | Нет | Число элементов (по умолч. 50) | `30` |
| `offset` | int | Нет | Смещение пагинации | `0` |

**Пример ответа (200 OK):**
```json
{
  "total": 162,
  "filtered": 1,
  "items": [
    {
      "id": "SD-1001",
      "source": "bezposrednikov",
      "title": "2-к. квартира ⋅ 41.2 м² ⋅ 12/17 эт.",
      "raw_title": "2-к. квартира, 41.2 м², 12/17 эт.",
      "price_display": "28 000 ₽ / мес",
      "price_val": 28000,
      "price_unit": "₽/мес",
      "deposit": "10 000 ₽",
      "status": "active",
      "rooms": "2",
      "area": 41.2,
      "floor_str": "12 из 17",
      "renovation": "Евроремонт",
      "address": "г. Томск, Пригород • Южные Ворота, ул. Королева, 20",
      "district": "Пригород",
      "metro_name": "Пригород • Южные Ворота, Королева 20",
      "lat": 56.4421,
      "lng": 84.9912,
      "phone": "+7 (952) 880-19-61",
      "is_owner": true,
      "is_new": true,
      "is_top": false,
      "time_ago": "20 мин назад",
      "photos": [
        "https://tsk.s.bsps.ru/images/sobipro/galleries/ec/196162/3dbeb0.jpg",
        "https://tsk.s.bsps.ru/images/sobipro/galleries/ec/196162/4fa12c.jpg"
      ],
      "photos_count": 2,
      "desc_short": "Сдам светлую уютную 2-комнатную квартиру на длительный срок от собственника...",
      "amenities": ["Стиральная машина", "Холодильник", "Интернет"]
    }
  ]
}
```

---

### 2.2. Гео-метки для интерактивной карты
`GET /api/geo/map`

Возвращает минимальный легковесный JSON-набор для быстрой отрисовки кластеров и маркеров на Яндекс.Картах без торможения мобильных браузеров.

**Пример ответа (200 OK):**
```json
{
  "count": 162,
  "pins": [
    {
      "id": "SD-1001",
      "lat": 56.4421,
      "lng": 84.9912,
      "price": 28000,
      "price_short": "28 т.₽",
      "rooms": 2,
      "district": "Пригород",
      "title": "2-к., 41.2 м²",
      "status": "active",
      "photo": "https://tsk.s.bsps.ru/images/sobipro/galleries/ec/196162/3dbeb0.jpg"
    }
  ]
}
```

---

### 2.3. Детальная информация по объекту
`GET /api/apartment/{id}`

Возвращает полный профиль квартиры: оригинальное описание, верификацию собственника, технические характеристики здания и галерею фотографий.

---

### 2.4. Сводная статистика сервиса
`GET /api/stats`

**Пример ответа (200 OK):**
```json
{
  "total_apartments": 162,
  "avg_price": 27400,
  "sources": {
    "avito_early_access": 12,
    "avito_full": 84,
    "bezposrednikov": 39,
    "cian": 27
  },
  "districts": {
    "Советский": 52,
    "Кировский": 44,
    "Октябрьский": 38,
    "Ленинский": 20,
    "Пригород": 8
  }
}
```

---

## 3. Спецификация телеметрии («Шотчик»)

Клиентское приложение отправляет события через модуль `frontend/src/lib/telemetry.ts` по неблокирующему протоколу.

### 3.1. Структура телеметрического события
```typescript
export interface TelemetryEvent {
  event: string;              // Название события
  timestamp: number;          // Unix timestamp в миллисекундах
  session_id: string;         // Уникальный ID пользовательской сессии
  data?: Record<string, any>; // Контекстные данные
}
```

### 3.2. Реестр событий воронки

| Событие | Триггер | Передаваемые данные |
|---|---|---|
| `session_start` | Первое открытие сайта | `{ screen: "390x844", referrer: "direct", user_agent: "..." }` |
| `session_heartbeat` | Периодический пинг активности | `{ active_time_sec: 60 }` |
| `session_end` | Закрытие или уход со страницы | `{ total_duration_sec: 185 }` |
| `scroll_depth` | Преодоление порогов скролла | `{ depth: 25 | 50 | 75 | 100 }` |
| `listing_view` | Клик по карточке в каталоге | `{ offerId: "SD-1001", title: "...", price: 28000 }` |
| `favorite_toggle` | Добавление / удаление из избранного | `{ offerId: "SD-1001", isFavorite: true }` |
| `unpublish_toggle` | Снятие с публикации / возврат в поиск | `{ offerId: "SD-1001", isRented: true }` |
| `gallery_swipe` | Листание фотографий в карточке | `{ offerId: "SD-1001", photo_index: 2 }` |
| `lightbox_open` | Полноэкранный просмотр Lightbox | `{ offerId: "SD-1001", initialIndex: 0 }` |
| `phone_reveal_click` | **Раскрытие телефона (конверсия)** | `{ offerId: "SD-1001", phone: "+7 (952) 880-19-61" }` |

### 3.3. Реестр событий сбоев (Friction Log)

| Событие | Причина фиксации | Данные сбоя |
|---|---|---|
| `broken_photo_cdn` | Ошибка загрузки картинки (404 / тайм-аут) | `{ url: "...", offer_id: "avito_..." }` |
| `zero_search_results` | Пустая выдача по фильтрам пользователя | `{ rooms: "4", max_price: 15000, district: "Советский" }` |
| `map_tile_latency` | Задержка тайлов Яндекс.Карт > 3000 мс | `{ load_time_ms: 3420 }` |
| `geolocation_denied` | Пользователь отклонил запрос геолокации | `{ code: 1, message: "User denied" }` |

---

## 4. Контракты данных Панели Администратора

### 4.1. Пользователь (`UserItem`)
```typescript
export interface UserItem {
  id: string;
  phone: string;
  name: string;
  role: string;
  plan: string;
  dailyLimit: number;
  unlockedToday: number;
  registeredAt: string;
  status: 'active' | 'trial' | 'blocked' | 'banned';
}
```

### 4.2. Запись детектора спотыканий (`FrictionEvent`)
```typescript
export interface FrictionEvent {
  id: string;
  type: 'broken_photo' | 'zero_results' | 'map_latency' | 'geo_denied';
  title: string;
  detail: string;
  count: number;
  lastSeen: string;
  resolved: boolean;
}
```
