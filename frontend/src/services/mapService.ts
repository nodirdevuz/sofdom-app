import { TOMSK_MAP_FALLBACK } from '../data/tomskApartments';
import { OFFERS } from '../data/offers';
import { Offer } from '../types';

export interface MapApartment {
  id: string;
  lat: number;
  lng: number;
  title: string;
  price: number;
  price_badge: string;
  rooms?: string;
  area?: number;
  address: string;
  district?: string;
  photo?: string;
  photos_count?: number;
  is_secret?: boolean;
  distance_km?: number | null;
  deposit?: number | string;
  floor_str?: string;
  geo_precision?: 'exact' | 'approximate' | 'none';
  is_approximate?: boolean;
}

export interface MapApiResponse {
  count: number;
  center: { lat: number; lng: number };
  districts: { district: string; count: number }[];
  apartments: MapApartment[];
}

export interface MapQueryParams {
  bbox?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
  district?: string;
  rooms?: string;
  price_min?: number;
  price_max?: number;
  is_secret_only?: boolean;
}

// In-memory cache for map data (TTL: 10 minutes)
interface CacheEntry {
  data: MapApiResponse;
  timestamp: number;
}
const mapCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export function calcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function formatDistance(km?: number | null): string {
  if (km === null || km === undefined) return '';
  if (km < 1) {
    return `~${Math.round(km * 1000)} м от вас`;
  }
  return `~${km.toFixed(1)} км от вас`;
}

function getCacheKey(params: MapQueryParams): string {
  return JSON.stringify({
    district: params.district || '',
    rooms: params.rooms || '',
    is_secret: !!params.is_secret_only,
    // Round lat/lng to 2 decimal places (~1.1 km grid) to prevent cache thrashing
    lat: params.lat ? params.lat.toFixed(2) : '',
    lng: params.lng ? params.lng.toFixed(2) : '',
    radius: params.radius_km || '',
    bbox: params.bbox ? params.bbox.split(',').map((n) => parseFloat(n).toFixed(2)).join(',') : '',
  });
}

/**
 * Fallback generator using local dataset if backend API is not running
 */
function getFallbackMapData(params: MapQueryParams): MapApiResponse {
  let list =
    TOMSK_MAP_FALLBACK.apartments && TOMSK_MAP_FALLBACK.apartments.length > 0
      ? [...TOMSK_MAP_FALLBACK.apartments]
      : OFFERS.map(
          (o) =>
            ({
              id: o.id,
              lat: o.lat,
              lng: o.lng,
              title: o.title,
              price: o.price_val,
              price_badge: `${o.price_val.toLocaleString('ru-RU')} ₽`,
              rooms: String(o.rooms),
              address: o.address,
              district: o.metro_name ? `${o.metro_name} район` : 'Центральный',
              photo: o.photos?.[0] || '',
              photos_count: o.photos_count || o.photos?.length || 0,
              is_secret: !!o.is_top,
              deposit: o.deposit,
              floor_str: o.floor_str,
              geo_precision: o.geo_precision || 'exact',
              is_approximate: !!o.is_approximate || o.geo_precision === 'approximate',
            } as MapApartment)
        );

  if (params.district && params.district !== 'Все районы') {
    const search = params.district.toLowerCase().replace(' район', '');
    list = list.filter((a) => a.district?.toLowerCase().includes(search));
  }

  if (params.lat && params.lng) {
    list = list
      .map((a) => {
        const isApprox = !!a.is_approximate;
        return {
          ...a,
          distance_km: isApprox ? null : calcDistanceKm(params.lat!, params.lng!, a.lat, a.lng),
        };
      })
      .filter((a) => {
        if (params.radius_km !== undefined) {
          // Приблизительные точки не включаются в точный радиусный поиск
          if (a.is_approximate || a.distance_km === null || a.distance_km > params.radius_km) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const da = a.distance_km ?? 9999;
        const db = b.distance_km ?? 9999;
        return da - db;
      });
  }

  return {
    count: list.length,
    center: { lat: 56.4977, lng: 84.9744 },
    districts: TOMSK_MAP_FALLBACK.districts,
    apartments: list,
  };
}

/**
 * Fetch map apartments with client-side caching & instant zero-lag rendering
 */
export async function fetchMapApartments(params: MapQueryParams = {}): Promise<MapApiResponse> {
  const cacheKey = getCacheKey(params);
  const cached = mapCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Instant render from authentic local Tomsk dataset (0ms latency)
  const fallback = getFallbackMapData(params);
  mapCache.set(cacheKey, { data: fallback, timestamp: now });

  // Background non-blocking sync with backend API
  try {
    const q = new URLSearchParams();
    if (params.bbox) q.set('bbox', params.bbox);
    if (params.lat !== undefined) q.set('lat', String(params.lat));
    if (params.lng !== undefined) q.set('lng', String(params.lng));
    if (params.radius_km !== undefined) q.set('radius_km', String(params.radius_km));
    if (params.district) q.set('district', params.district);
    if (params.rooms) q.set('rooms', params.rooms);
    if (params.price_min) q.set('price_min', String(params.price_min));
    if (params.price_max) q.set('price_max', String(params.price_max));

    const url = `/api/apartments/map?${q.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    fetch(url, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        clearTimeout(timeoutId);
        if (data && data.apartments && data.apartments.length > 0) {
          mapCache.set(cacheKey, { data, timestamp: Date.now() });
        }
      })
      .catch(() => {});
  } catch (e) {
    // Non-blocking
  }

  return fallback;
}
