/**
 * Данные воронки, телеметрии и детектора спотыканий (Komfort Go архитектура)
 */

export interface FunnelStepItem {
  step: number;
  key: string;
  label: string;
  count: number;
  prev_step_count: number;
  conversion_pct: number;
  drop_count: number;
}

export interface SessionRecord {
  id: string;
  startedAt: string;
  durationFormatted: string;
  device: string;
  scrollDepthPct: number;
  listingsViewedCount: number;
  phoneRevealed: boolean;
  status: 'active' | 'completed' | 'bounced';
}

export interface FrictionErrorItem {
  id: string;
  message: string;
  source: string;
  stepName: string;
  stepNumber: number;
  peopleCount: number;
  occurrences: number;
  firstAt: string;
  lastAt: string;
  resolved: boolean;
}

export function getFunnelStepsData(): FunnelStepItem[] {
  return [
    {
      step: 1,
      key: 'session_start',
      label: '1. Заход на сайт (старт визита)',
      count: 1240,
      prev_step_count: 1240,
      conversion_pct: 100,
      drop_count: 0,
    },
    {
      step: 2,
      key: 'scroll_depth',
      label: '2. Прокрутка каталога (глубина 25%+)',
      count: 890,
      prev_step_count: 1240,
      conversion_pct: 71.8,
      drop_count: 350,
    },
    {
      step: 3,
      key: 'listing_view',
      label: '3. Открытие карточки квартиры',
      count: 615,
      prev_step_count: 890,
      conversion_pct: 69.1,
      drop_count: 275,
    },
    {
      step: 4,
      key: 'gallery_swipe',
      label: '4. Просмотр фото и планировки',
      count: 480,
      prev_step_count: 615,
      conversion_pct: 78.0,
      drop_count: 135,
    },
    {
      step: 5,
      key: 'phone_reveal',
      label: '5. Открытие номера хозяина (лид)',
      count: 285,
      prev_step_count: 480,
      conversion_pct: 59.4,
      drop_count: 195,
    },
  ];
}

export function getRecentSessionsData(): SessionRecord[] {
  // Проверяем живую сессию из localStorage
  let liveSession: SessionRecord | null = null;
  try {
    const raw = localStorage.getItem('sofdom_current_session_stats');
    if (raw) {
      const parsed = JSON.parse(raw);
      const mins = Math.floor((parsed.durationSec || 0) / 60);
      const secs = (parsed.durationSec || 0) % 60;
      liveSession = {
        id: parsed.sessionId || 'ses_live_now',
        startedAt: 'Только что (сейчас на сайте)',
        durationFormatted: `${mins > 0 ? `${mins} мин ` : ''}${secs} сек`,
        device: parsed.device || 'Mac / Desktop',
        scrollDepthPct: parsed.maxScrollDepth || 100,
        listingsViewedCount: 4,
        phoneRevealed: true,
        status: 'active',
      };
    }
  } catch {}

  const base: SessionRecord[] = [
    {
      id: 'ses_9k2m1a',
      startedAt: '16:28 (2 мин назад)',
      durationFormatted: '3 мин 42 сек',
      device: 'iPhone 15 / Safari',
      scrollDepthPct: 100,
      listingsViewedCount: 6,
      phoneRevealed: true,
      status: 'completed',
    },
    {
      id: 'ses_4b8x0e',
      startedAt: '16:24 (6 мин назад)',
      durationFormatted: '1 мин 18 сек',
      device: 'Android / Chrome',
      scrollDepthPct: 75,
      listingsViewedCount: 3,
      phoneRevealed: false,
      status: 'completed',
    },
    {
      id: 'ses_1l9z3q',
      startedAt: '16:15 (15 мин назад)',
      durationFormatted: '5 мин 05 сек',
      device: 'Mac / Safari',
      scrollDepthPct: 100,
      listingsViewedCount: 8,
      phoneRevealed: true,
      status: 'completed',
    },
    {
      id: 'ses_7f2p5v',
      startedAt: '15:58 (32 мин назад)',
      durationFormatted: '22 сек',
      device: 'Windows / Chrome',
      scrollDepthPct: 25,
      listingsViewedCount: 1,
      phoneRevealed: false,
      status: 'bounced',
    },
    {
      id: 'ses_3d4t8k',
      startedAt: '15:42 (48 мин назад)',
      durationFormatted: '4 мин 10 сек',
      device: 'iPhone 14 / Safari',
      scrollDepthPct: 100,
      listingsViewedCount: 5,
      phoneRevealed: true,
      status: 'completed',
    },
  ];

  return liveSession ? [liveSession, ...base] : base;
}

export function getFrictionErrorsData(): FrictionErrorItem[] {
  return [
    {
      id: 'err_cdn_photo',
      message: 'Битый URL фотографии с CDN (отдан HTTP 404)',
      source: 'ListingCard / DetailPage',
      stepName: '4. Просмотр фото',
      stepNumber: 4,
      peopleCount: 14,
      occurrences: 38,
      firstAt: '2026-10-21 11:20',
      lastAt: '2026-10-21 16:10',
      resolved: true, // Решено fallback-SVG заглушкой
    },
    {
      id: 'err_zero_search',
      message: 'Поиск вернул 0 результатов (жесткий фильтр)',
      source: 'Toolbar / FilterFeed',
      stepName: '2. Прокрутка каталога',
      stepNumber: 2,
      peopleCount: 8,
      occurrences: 12,
      firstAt: '2026-10-21 13:45',
      lastAt: '2026-10-21 15:50',
      resolved: false,
    },
    {
      id: 'err_map_tile',
      message: 'Задержка загрузки векторных тайлов карты (>2.5 с)',
      source: 'YandexMap',
      stepName: '3. Просмотр на карте',
      stepNumber: 3,
      peopleCount: 5,
      occurrences: 9,
      firstAt: '2026-10-21 12:15',
      lastAt: '2026-10-21 14:30',
      resolved: true,
    },
    {
      id: 'err_geo_denied',
      message: 'Отказ пользователя в выдаче геолокации GPS в браузере',
      source: 'MapListingPreview',
      stepName: '1. Заход на сайт',
      stepNumber: 1,
      peopleCount: 12,
      occurrences: 12,
      firstAt: '2026-10-21 10:00',
      lastAt: '2026-10-21 16:15',
      resolved: true, // Показывается дефолтный центр Томска (пл. Ленина)
    },
  ];
}
