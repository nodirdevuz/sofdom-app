// Обратный геокодинг через HTTP-Геокодер Яндекса (ОТДЕЛЬНЫЙ ключ/квота — 1000/сутки).
// Вызывать с debounce и только после остановки карты (см. AddressPicker) — экономим лимит.
// Координаты Яндекса в URL идут в порядке "долгота,широта".
//
// ЭКОНОМИЯ ЛИМИТА (три слоя, ниже по стеку — дешевле):
//   1) AddressPicker: debounce после остановки карты + дедуп «центр не сдвинулся» (~17 м);
//   2) КЭШ здесь: точка округляется до ~11 м, ответ живёт 30 дней в localStorage → повторное
//      открытие карты на том же месте и «туда-сюда» по карте не стоят НИ ОДНОГО запроса;
//   3) склейка параллельных запросов: две подряд идущие остановки на одной точке → один fetch.
interface YandexGeoObject {
  name?: string; // короткая часть: «улица, дом»
  metaDataProperty?: { GeocoderMetaData?: { text?: string } }; // полный адрес
}
interface YandexGeocodeResponse {
  response?: {
    GeoObjectCollection?: { featureMember?: { GeoObject?: YandexGeoObject }[] };
  };
}

/** Округление ключа кэша: 3 знака ≈ 110 м. Было 4 (~11 м) — дрейф GPS 10–30 м между сессиями
 *  давал промах мимо кэша, и каждый повторный прогрев стоил платного запроса. Для ПОДСКАЗКИ
 *  адреса в кишлаке 110 м достаточно (точность самого пина от этого не зависит — пин двигают
 *  руками); дедуп движения карты (~17 м в AddressPicker) — отдельный слой и не менялся. */
const CACHE_PRECISION = 3;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней — адреса домов не меняются
const CACHE_LIMIT = 300; // ограничиваем localStorage (адресов у клиента единицы)
const STORAGE_KEY = 'geocode_cache_v1';

interface CacheEntry {
  /** null — Яндекс ответил «адреса нет»: кэшируем и это, иначе будем долбить лимит впустую. */
  text: string | null;
  ts: number;
}

const keyOf = (lat: number, lng: number) => `${lat.toFixed(CACHE_PRECISION)},${lng.toFixed(CACHE_PRECISION)}`;

let memory: Map<string, CacheEntry> | null = null;
const inflight = new Map<string, Promise<string | null>>();

/** Счётчик РЕАЛЬНЫХ обращений к API и попаданий в кэш за сессию приложения — для диагностики.
 *  Читается в components/AddressPicker.tsx: на закрытии карты снимается разница за сеанс
 *  открытия и уходит в clog('geocode_session', …) — так расход геокодера виден в клиентском логе
 *  без ручного дебага (поток C, Фаза 3, 05.08.2026). */
export const geocodeStats = { apiCalls: 0, cacheHits: 0 };

function loadCache(): Map<string, CacheEntry> {
  if (memory) return memory;
  memory = new Map();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, CacheEntry>;
      const now = Date.now();
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v.ts === 'number' && now - v.ts < CACHE_TTL_MS) memory.set(k, v);
      }
    }
  } catch {
    // приватный режим / повреждённый JSON — работаем без персистентного кэша
  }
  return memory;
}

function saveCache(cache: Map<string, CacheEntry>): void {
  try {
    // Вытесняем самые старые записи, чтобы не пухнуть в localStorage.
    const entries = [...cache.entries()].sort((a, b) => b[1].ts - a[1].ts).slice(0, CACHE_LIMIT);
    memory = new Map(entries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // квота localStorage переполнена — кэш остаётся только в памяти
  }
}

async function fetchFromYandex(lat: number, lng: number): Promise<string | null> {
  const key = import.meta.env.VITE_YANDEX_GEOCODER_KEY;
  if (!key) return null;
  geocodeStats.apiCalls += 1;
  const url =
    `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(key)}` +
    `&format=json&kind=house&results=1&lang=ru_RU&geocode=${lng},${lat}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const j = (await res.json()) as YandexGeocodeResponse;
  const obj = j.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  if (!obj) return null;
  return obj.name || obj.metaDataProperty?.GeocoderMetaData?.text || null;
}

/**
 * Адрес «улица, дом» под точкой. Нет ключа / ошибка сети → null (UI оставит ручной ввод).
 * Сначала кэш, потом сеть. Сетевая ошибка НЕ кэшируется (в отличие от честного «адреса нет»).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const cache = loadCache();
  const k = keyOf(lat, lng);

  const hit = cache.get(k);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    geocodeStats.cacheHits += 1;
    return hit.text;
  }

  const running = inflight.get(k);
  if (running) return running;

  const p = fetchFromYandex(lat, lng)
    .then((text) => {
      cache.set(k, { text, ts: Date.now() });
      saveCache(cache);
      return text;
    })
    .catch(() => null) // сеть/лимит — не кэшируем, попробуем в следующий раз
    .finally(() => inflight.delete(k));

  inflight.set(k, p);
  return p;
}

// ─── ПОИСК АДРЕСА ПО НАЗВАНИЮ (20.09.2026, образец владельца) ────────────────────────────────
//
// 🔴 ЗАЧЕМ. Двигать карту пальцем через полгорода — работа, а не выбор адреса. Человек знает
// название своей улицы и хочет просто написать его.
//
// 🔴 ЭКОНОМИЯ ЛИМИТА ЗДЕСЬ ВАЖНЕЕ, ЧЕМ УДОБСТВО ПОДСКАЗОК. Квота геокодера — 1000 запросов
// в сутки на всех, и подсказки «на каждую букву» съели бы её за один вечер. Поэтому:
//   • ищем ТОЛЬКО по явной команде человека (Enter или кнопка), а не пока он печатает;
//   • ответ кладём в тот же localStorage на неделю: повтор того же запроса бесплатен;
//   • запрос короче трёх букв не отправляем вовсе.

/** Одна находка: что показать в списке и куда вести карту. */
export interface GeocodeHit {
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

const SEARCH_KEY = 'geocode_search_v1';
const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Город поиска: без него Яндекс ищет по всему миру и первым отдаёт не тот «Хуррам». */
const SEARCH_REGION = 'Узбекистан, Наманган';

interface SearchEntry { hits: GeocodeHit[]; ts: number }

function loadSearchCache(): Record<string, SearchEntry> {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_KEY) ?? '{}') as Record<string, SearchEntry>;
  } catch {
    return {};
  }
}

function saveSearchCache(cache: Record<string, SearchEntry>): void {
  try {
    const entries = Object.entries(cache).sort((a, b) => b[1].ts - a[1].ts).slice(0, 50);
    localStorage.setItem(SEARCH_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // переполнение хранилища не должно ломать поиск
  }
}

interface YandexSearchObject {
  name?: string;
  description?: string;
  Point?: { pos?: string };
}

/**
 * Найти адрес по названию. Пустой массив — «ничего не нашли» или нет ключа: экран покажет это
 * человеку словами и оставит карту в покое. Ошибку сети не кэшируем.
 */
export async function searchAddress(query: string): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const cache = loadSearchCache();
  const k = q.toLocaleLowerCase('ru');
  const hit = cache[k];
  if (hit && Date.now() - hit.ts < SEARCH_TTL_MS) {
    geocodeStats.cacheHits += 1;
    return hit.hits;
  }
  const key = import.meta.env.VITE_YANDEX_GEOCODER_KEY;
  if (!key) return [];
  geocodeStats.apiCalls += 1;
  const url =
    `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(key)}` +
    `&format=json&results=5&lang=ru_RU&geocode=${encodeURIComponent(`${SEARCH_REGION}, ${q}`)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const json = (await res.json()) as {
    response?: { GeoObjectCollection?: { featureMember?: { GeoObject?: YandexSearchObject }[] } };
  };
  const hits: GeocodeHit[] = [];
  for (const member of json.response?.GeoObjectCollection?.featureMember ?? []) {
    const point = member.GeoObject?.Point?.pos;
    if (!point) continue;
    // Яндекс отдаёт «долгота широта» через пробел — порядок обратный привычному.
    const [lng, lat] = point.split(' ').map(Number) as (number | undefined)[];
    if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    hits.push({ title: member.GeoObject?.name ?? q, subtitle: member.GeoObject?.description ?? '', lat, lng });
  }
  cache[k] = { hits, ts: Date.now() };
  saveSearchCache(cache);
  return hits;
}
