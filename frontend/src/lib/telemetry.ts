/**
 * Лёгкий трекер продуктовых событий и датчиков спотыканий (архитектура Komfort Go)
 * 
 * Принципы:
 * 1. Fire-and-forget: никогда не блокирует UI, не тормозит скролл и клики.
 * 2. Без сторонних тяжелых библиотек — сохраняет события в localStorage и буфер.
 * 3. Фиксация времени, глубины скролла, переходов и детекция сбоев (битые фото, ошибки карты, пустой поиск).
 */

export interface TelemetryEvent {
  id: string;
  session_id: string;
  type:
    | 'session_start'
    | 'session_heartbeat'
    | 'session_end'
    | 'scroll_depth'
    | 'listing_view'
    | 'gallery_open'
    | 'photo_swipe'
    | 'phone_reveal_click'
    | 'filter_change'
    | 'search_performed'
    | 'friction_stall'
    | 'error_event';
  timestamp: number;
  step?: number;
  payload?: Record<string, any>;
}

export interface FrictionError {
  fingerprint: string;
  message: string;
  source: string;
  step: number;
  people_count: number;
  occurrences: number;
  first_at: string;
  last_at: string;
  resolved: boolean;
}

const STORAGE_KEY = 'sofdom_telemetry_events_v1';
const SESSION_KEY = 'sofdom_session_id_v1';

// Получение или создание постоянного ID сессии визита
function getOrCreateSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = 'ses_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return 'ses_' + Math.random().toString(36).slice(2, 9);
  }
}

// Определение типа устройства
function getDeviceType(): string {
  if (typeof navigator === 'undefined') return 'Desktop';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh/i.test(ua)) return 'Mac / Desktop';
  if (/Windows/i.test(ua)) return 'Windows / PC';
  return 'Desktop';
}

class TelemetryTracker {
  private sessionId: string;
  private startTime: number;
  private activeSeconds: number = 0;
  private isVisible: boolean = true;
  private maxScrollDepth: number = 0;
  private heartbeatInterval: any = null;

  constructor() {
    this.sessionId = getOrCreateSessionId();
    this.startTime = Date.now();
    this.initListeners();
  }

  private initListeners() {
    if (typeof window === 'undefined') return;

    // Трекинг видимости (активное время на вкладке)
    document.addEventListener('visibilitychange', () => {
      this.isVisible = document.visibilityState === 'visible';
    });

    // Таймер активного времени (heartbeat раз в 10 сек)
    this.heartbeatInterval = setInterval(() => {
      if (this.isVisible) {
        this.activeSeconds += 10;
        this.saveSessionStats();
      }
    }, 10000);

    // Скролл-датчик глубины (25%, 50%, 75%, 100%)
    let lastLoggedDepth = 0;
    window.addEventListener(
      'scroll',
      () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight <= 0) return;
        const currentPct = Math.round((scrollTop / docHeight) * 100);

        const thresholds = [25, 50, 75, 100];
        for (const t of thresholds) {
          if (currentPct >= t && lastLoggedDepth < t) {
            lastLoggedDepth = t;
            this.maxScrollDepth = t;
            this.track('scroll_depth', 2, { depth_pct: t });
          }
        }
      },
      { passive: true }
    );

    // Запись старта визита
    this.track('session_start', 1, {
      device: getDeviceType(),
      referrer: document.referrer || 'direct',
      screen: `${window.innerWidth}x${window.innerHeight}`,
    });

    // При закрытии страницы
    window.addEventListener('beforeunload', () => {
      this.track('session_end', 5, {
        duration_sec: Math.max(this.activeSeconds, Math.round((Date.now() - this.startTime) / 1000)),
        max_scroll: this.maxScrollDepth,
      });
    });
  }

  // Основная точка отправки продуктового события
  public track(type: TelemetryEvent['type'], step?: number, payload?: Record<string, any>) {
    try {
      const event: TelemetryEvent = {
        id: 'evt_' + Math.random().toString(36).slice(2, 9),
        session_id: this.sessionId,
        type,
        step,
        timestamp: Date.now(),
        payload: payload || {},
      };

      // Сохраняем в кольцевой буфер localStorage (последние 100 событий)
      const raw = localStorage.getItem(STORAGE_KEY);
      let list: TelemetryEvent[] = raw ? JSON.parse(raw) : [];
      list.push(event);
      if (list.length > 100) list = list.slice(-100);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

      this.saveSessionStats();
    } catch (e) {
      // Игнорируем в приватном режиме (fail-safe)
    }
  }

  // Детектор спотыканий и поломок (Friction Sensor)
  public trackFriction(errorType: string, source: string, details?: Record<string, any>) {
    this.track('friction_stall', 0, {
      error: errorType,
      source,
      ...details,
    });
  }

  private saveSessionStats() {
    try {
      const sessionData = {
        sessionId: this.sessionId,
        device: getDeviceType(),
        startedAt: this.startTime,
        durationSec: Math.max(this.activeSeconds, Math.round((Date.now() - this.startTime) / 1000)),
        maxScrollDepth: this.maxScrollDepth,
        lastActive: Date.now(),
      };
      localStorage.setItem('sofdom_current_session_stats', JSON.stringify(sessionData));
    } catch {}
  }
}

export const telemetry = new TelemetryTracker();
