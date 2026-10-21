# 🗺️ API_FOR_FRONTEND: Руководство для фронтенд-агента
### Интерактивная карта с ценовыми бейджами и геолокацией «Где я стою» (Томск)

Этот документ подготовлен бэкенд-агентом для фронтенд-агента, работающего над React/TypeScript интерфейсом в `realty/frontend/`.

Сервер бэкенда запущен локально: `http://localhost:8080` (FastAPI).

---

## 📍 1. Новый специализированный Geo-эндпоинт

### `GET /api/apartments/map`
Возвращает облегчённый список точек для быстрого рендера меток на карте без лишних тяжелых описаний.

#### Параметры запроса (Query Params):
* `bbox` *(опционально)*: `min_lat,min_lng,max_lat,max_lng` — координаты видимой области экрана (получается через `map.getBounds().toBBoxString()`).
* `lat`, `lng` *(опционально)*: координаты пользователя (для функции **«Где я стою»**).
* `radius_km` *(опционально, по умолчанию 3.0)*: радиус поиска вокруг пользователя в километрах.
* `district` *(опционально)*: фильтр по району Томска (`Кировский`, `Советский`, `Ленинский`, `Октябрьский`, `Пригород`).
* `rooms` *(опционально)*: `Студия`, `1-комн`, `2-комн`, `3-комн+`.
* `price_min`, `price_max` *(опционально)*: диапазон цены.
* `is_secret_only` *(опционально)*: `true` — только эксклюзивные квартиры раннего доступа.

#### Пример ответа:
```json
{
  "count": 47,
  "center": { "lat": 56.4977, "lng": 84.9744 },
  "districts": [
    { "district": "Кировский район", "count": 18 },
    { "district": "Советский район", "count": 96 },
    { "district": "Ленинский район", "count": 21 },
    { "district": "Октябрьский район", "count": 22 },
    { "district": "Пригород", "count": 20 }
  ],
  "apartments": [
    {
      "id": "cian_335073195",
      "lat": 56.4852,
      "lng": 84.9921,
      "title": "1-к. квартира, 35 м²",
      "price": 22000,
      "price_badge": "22 000 ₽",
      "rooms": "1-комн",
      "address": "Алтайская ул., 76/2",
      "district": "Советский район",
      "photo": "https://images.cdn-cian.ru/...",
      "photos_count": 6,
      "is_secret": false,
      "distance_km": 0.53
    }
  ]
}
```

---

## 🎨 2. Как стилизовать желтые метки с ценами в Яндекс Картах (YMaps v2.1)

Фронтенд-агент использует загрузчик `loadYmaps()` из `Komfort Go`.
В Яндекс Картах v2.1 кастомные желтые плашки цен и кластеризация создаются через `ymaps.templateLayoutFactory` и `ymaps.Clusterer`:

```typescript
import { loadYmaps } from './lib/ymaps';

// 1. Создание кастомного HTML-макета метки с ценой
export function createPriceLayout(ymaps: any) {
  return ymaps.templateLayoutFactory.createClass(`
    <div class="price-pin-bubble $[properties.is_secret_class]">
      <span class="price-pin-text">$[properties.price_badge]</span>
      <div class="price-pin-arrow"></div>
    </div>
  `);
}

// 2. Инициализация карты и кластеризатора с ценами
export async function initYandexMap(containerId: string, onSelectApartment: (aptId: string) => void) {
  const ymaps = await loadYmaps();

  const map = new ymaps.Map(containerId, {
    center: [56.4977, 84.9744], // Центр Томска
    zoom: 13,
    controls: ['zoomControl', 'geolocationControl']
  }, {
    suppressMapOpenBlock: true // Убирает лишний мусор Яндекса
  });

  const priceLayout = createPriceLayout(ymaps);

  // Кластеризатор (группирует квартиры при отдалении)
  const clusterer = new ymaps.Clusterer({
    preset: 'islands#yellowClusterIcons',
    groupByCoordinates: false,
    clusterDisableClickZoom: false,
    clusterHideIconOnBalloonOpen: false,
    geoObjectHideIconOnBalloonOpen: false
  });

  // Загрузка точек с бэкенда
  const res = await fetch('/api/apartments/map');
  const data = await res.json();

  const placemarks = data.apartments.map((apt: any) => {
    const pm = new ymaps.Placemark([apt.lat, apt.lng], {
      price_badge: apt.price_badge,
      is_secret_class: apt.is_secret ? 'secret-pin' : '',
      apartmentId: apt.id
    }, {
      iconLayout: priceLayout,
      iconShape: {
        type: 'Rectangle',
        coordinates: [[-42, -34], [42, 0]]
      }
    });

    pm.events.add('click', () => {
      onSelectApartment(apt.id);
    });

    return pm;
  });

  clusterer.add(placemarks);
  map.geoObjects.add(clusterer);

  return { map, clusterer };
}
```

### CSS стили для метки (вставь в `index.css`):
```css
/* Желтый ценовой бейдж (Стиль Joymee / Яндекс) */
.custom-price-pin {
  background: transparent !important;
  border: none !important;
}

.price-pin-bubble {
  position: relative;
  background-color: #facc15; /* Brand Yellow */
  color: #0f172a;           /* Dark Slate */
  font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 800;
  padding: 5px 10px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.price-pin-bubble:hover {
  transform: scale(1.08);
  background-color: #eab308;
  z-index: 9999 !important;
}

.price-pin-arrow {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #facc15;
}

.price-pin-bubble:hover .price-pin-arrow {
  border-top-color: #eab308;
}

/* Секретные квартиры раннего доступа */
.price-pin-bubble.secret-pin {
  background-color: #ffedd5;
  color: #c2410c;
  border: 1.5px solid #f97316;
}
.price-pin-bubble.secret-pin .price-pin-arrow {
  border-top-color: #f97316;
}
```

---

## 📍 3. Логика кнопки «Где я стою» (Геолокация рядом со мной)

Кнопка размещается поверх карты справа внизу (над зумом):

```typescript
function handleLocateMe(mapInstance: L.Map) {
  if (!navigator.geolocation) {
    alert("Геолокация не поддерживается вашим браузером");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;

      // 1. Плавно летим к пользователю
      mapInstance.flyTo([latitude, longitude], 15, { duration: 1.5 });

      // 2. Ставим синюю точку "Вы здесь"
      L.circleMarker([latitude, longitude], {
        radius: 8,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 1
      }).addTo(mapInstance).bindPopup("Вы находитесь здесь").openPopup();

      // 3. Загружаем квартиры в радиусе 2.5 км вокруг пользователя
      const res = await fetch(`/api/apartments/map?lat=${latitude}&lng=${longitude}&radius_km=2.5`);
      const data = await res.json();
      
      console.log(`Найдено ${data.count} квартир рядом с вами!`, data.apartments);
      // Отображаем отсортированные квартиры (от ближайшей к дальней)
    },
    (error) => {
      console.warn("Ошибка геолокации:", error.message);
      // Если пользователь запретил гео — центрируем на центре Томска (Новособорная)
      mapInstance.flyTo([56.473, 84.951], 14);
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}
```

---

## 🏙️ 4. Фильтр по Районам Томска (Чипсы-переключатели)

Сверху над картой разместите горизонтальный скролл чипсов:
* **Все районы** (`district=`)
* **Кировский** (`district=Кировский`) — ВУЗы (ТПУ, ТГУ), Южная, Лагерный Сад
* **Советский** (`district=Советский`) — Центр, Фрунзе, Комсомольский
* **Ленинский** (`district=Ленинский`) — Каштак, Черемошники, Мира
* **Октябрьский** (`district=Октябрьский`) — Солнечный, Зеленые Горки, Лазо
* **Пригород** (`district=Пригород`) — Зональная Станция, Южные Ворота, Кисловка

При клике на чипс:
1. Запрашиваем `/api/apartments/map?district=...`
2. Центрируем карту на выбранном районе:
   * Кировский: `[56.460, 84.970]`
   * Советский: `[56.478, 84.985]`
   * Ленинский: `[56.515, 84.960]`
   * Октябрьский: `[56.508, 85.030]`
   * Пригород: `[56.425, 85.015]`

---

## 🪟 5. Карточка предпросмотра при тапе на пин (Bottom Card Preview)

Когда пользователь нажимает на желтую метку цены на карте:
1. Не открывать сразу тяжелую страницу, а показать снизу экрана всплывающую карточку (Bottom Sheet):
   * Миниатюра первой фотографии.
   * Цена: `22 000 ₽ / мес` + залог.
   * Заголовок и адрес: `ул. Алтайская, 76/2`.
   * Расстояние: `0.5 км от вас`.
   * Кнопка: **«Показать телефон»** (вызывает `POST /api/apartments/{id}/unlock`).
   * Кнопка: **«Подробнее»** (открывает `DetailPage`).

---

## 📋 Остальные основные эндпоинты бэкенда:
* `POST /api/auth/login` — вход по телефону (`{"phone": "+7..."}`), выдаёт токен.
* `GET /api/auth/me` — профиль, остаток бесплатных контактов.
* `POST /api/apartments/{id}/unlock` — открытие реального номера собственника с проверкой лимита.
* `GET /api/subscriptions/plans` — список тарифов (Тест-Драйв 490, Снайпер 990, Про 1490).
* `POST /api/subscriptions/upgrade` — мгновенное переключение тарифа для теста.
