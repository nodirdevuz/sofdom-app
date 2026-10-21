// Загрузчик Yandex Maps JS API v2.1 — внешний скрипт, грузим ОДИН раз и по требованию
// (только на экранах с картой; в основной бандл не попадает). Ключ JS API — VITE_YANDEX_MAPS_KEY.
// Обратный геокодинг идёт ОТДЕЛЬНЫМ ключом через lib/geocode.ts (другая квота Яндекса).
type Ymaps = Window['ymaps'];

let loader: Promise<Ymaps> | null = null;

export function loadYmaps(): Promise<Ymaps> {
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_YANDEX_MAPS_KEY;
    if (!key) {
      reject(new Error('VITE_YANDEX_MAPS_KEY не задан'));
      return;
    }
    // Скрипт уже загружен (повторный вход на экран) — просто ждём ready.
    if (window.ymaps) {
      window.ymaps.ready(() => resolve(window.ymaps));
      return;
    }
    // crossorigin (27.09.2026): ошибки внутри карты — а карта живёт на экранах адреса и корзины —
    // приходили как «Script error.» без файла и строки. Яндекс отдаёт Access-Control-Allow-Origin: *
    // (сверено 27.09). Если заголовок пропадёт, скрипт с crossorigin не загрузится — одна повторная
    // попытка без него, карта важнее подробностей ошибки.
    const inject = (cors: boolean) => {
      const script = document.createElement('script');
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
      script.async = true;
      if (cors) script.crossOrigin = 'anonymous';
      script.onload = () => window.ymaps.ready(() => resolve(window.ymaps));
      script.onerror = () => {
        script.remove();
        if (cors) { inject(false); return; }
        loader = null; // дать шанс повторной попытки
        reject(new Error('Не удалось загрузить Yandex Maps'));
      };
      document.head.appendChild(script);
    };
    inject(true);
  });
  return loader;
}
