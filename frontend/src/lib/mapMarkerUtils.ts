import { MapApartment } from '../services/mapService';

export interface MarkerProperties {
  apartmentId: string;
  price_badge: string;
  is_secret_class: string;
  is_active_class: string;
  geo_class: string;
  geo_precision: 'exact' | 'approximate' | 'unknown' | 'none';
  precision_badge_html: string;
}

/**
 * Builds placemark properties for map rendering based on apartment provenance.
 *
 * Rules:
 * - 'exact': verified coordinates from source. Has 'exact-pin' class, no warning badges.
 * - 'approximate': district centroid. Has 'approximate-pin' class and '~' badge.
 * - 'unknown': offline fallback without proven location. Has 'unknown-pin unverified-pin' class
 *   and '?' badge with visual dashed styling to prevent misleading users into thinking it's exact.
 * - 'none': coordinates are absent / rejected; should not be rendered on the map.
 */
export function buildMarkerProperties(apt: MapApartment, isActive = false): MarkerProperties {
  const rawPrecision = apt.geo_precision;
  const precision: 'exact' | 'approximate' | 'unknown' | 'none' =
    rawPrecision === 'exact' || rawPrecision === 'approximate' || rawPrecision === 'none'
      ? rawPrecision
      : 'unknown';

  const isUnknown = precision === 'unknown';
  const isApprox = precision === 'approximate';
  const isNone = precision === 'none';

  const geoClass = isUnknown
    ? 'unknown-pin unverified-pin'
    : isApprox
    ? 'approximate-pin'
    : isNone
    ? 'none-pin'
    : 'exact-pin';

  const badgeHtml = isUnknown
    ? '<span class="pin-badge-unverified" title="Точка не подтверждена">?</span>'
    : isApprox
    ? '<span class="pin-badge-approx" title="Приблизительно">~</span>'
    : '';

  return {
    apartmentId: apt.id,
    price_badge: apt.price_badge || `${(apt.price || 0).toLocaleString('ru-RU')} ₽`,
    is_secret_class: apt.is_secret ? 'secret-pin' : '',
    is_active_class: isActive ? 'active-pin' : '',
    geo_class: geoClass,
    geo_precision: precision,
    precision_badge_html: badgeHtml,
  };
}

/**
 * Creates the HTML layout string for the custom Yandex Map price pin.
 */
export function buildMarkerHtml(props: MarkerProperties): string {
  const classes = [
    'price-pin-bubble',
    props.is_secret_class,
    props.is_active_class,
    props.geo_class,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    `<div class="${classes}" data-id="${props.apartmentId}" data-precision="${props.geo_precision}">` +
    `<span class="price-pin-text">${props.price_badge}</span>` +
    props.precision_badge_html +
    `<div class="price-pin-arrow"></div>` +
    `</div>`
  );
}
