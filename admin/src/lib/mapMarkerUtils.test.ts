import { describe, it, expect } from 'vitest';
import { buildMarkerProperties, buildMarkerHtml } from '../../../frontend/src/lib/mapMarkerUtils';
import type { MapApartment } from '../../../frontend/src/services/mapService';

describe('mapMarkerUtils - Geo Provenance Marker Rendering', () => {
  it('correctly styles exact coordinates without warning badge', () => {
    const apt: MapApartment = {
      id: 'apt-1',
      title: '1-комн квартира',
      price: 25000,
      price_badge: '25 000 ₽',
      address: 'Томск, ул. Ленина, 1',
      lat: 56.48,
      lng: 84.95,
      is_secret: false,
      geo_precision: 'exact',
    };

    const props = buildMarkerProperties(apt);
    expect(props.geo_precision).toBe('exact');
    expect(props.geo_class).toBe('exact-pin');
    expect(props.precision_badge_html).toBe('');

    const html = buildMarkerHtml(props);
    expect(html).toContain('exact-pin');
    expect(html).not.toContain('pin-badge-unverified');
    expect(html).not.toContain('pin-badge-approx');
  });

  it('correctly styles approximate centroid coordinates with ~ badge', () => {
    const apt: MapApartment = {
      id: 'apt-2',
      title: '2-комн квартира',
      price: 35000,
      price_badge: '35 000 ₽',
      address: 'Томск, Советский район',
      lat: 56.47,
      lng: 84.98,
      is_secret: false,
      geo_precision: 'approximate',
    };

    const props = buildMarkerProperties(apt);
    expect(props.geo_precision).toBe('approximate');
    expect(props.geo_class).toBe('approximate-pin');
    expect(props.precision_badge_html).toContain('~');

    const html = buildMarkerHtml(props);
    expect(html).toContain('approximate-pin');
    expect(html).toContain('pin-badge-approx');
  });

  it('correctly styles unknown coordinates with ? warning badge and dashed style', () => {
    const apt: MapApartment = {
      id: 'apt-3',
      title: 'Студия',
      price: 20000,
      price_badge: '20 000 ₽',
      address: 'Томск',
      lat: 56.49,
      lng: 84.97,
      is_secret: false,
      geo_precision: 'unknown',
    };

    const props = buildMarkerProperties(apt);
    expect(props.geo_precision).toBe('unknown');
    expect(props.geo_class).toBe('unknown-pin unverified-pin');
    expect(props.precision_badge_html).toContain('?');

    const html = buildMarkerHtml(props);
    expect(html).toContain('unknown-pin unverified-pin');
    expect(html).toContain('pin-badge-unverified');
  });

  it('normalizes missing/undefined geo_precision to unknown instead of exact', () => {
    const apt: MapApartment = {
      id: 'apt-4',
      title: 'Квартира без указания точности',
      price: 22000,
      price_badge: '22 000 ₽',
      address: 'Томск',
      lat: 56.49,
      lng: 84.97,
      is_secret: false,
    };

    const props = buildMarkerProperties(apt);
    expect(props.geo_precision).toBe('unknown');
    expect(props.geo_class).toBe('unknown-pin unverified-pin');
    expect(props.precision_badge_html).toContain('?');

    const html = buildMarkerHtml(props);
    expect(html).not.toContain('exact-pin');
    expect(html).toContain('unknown-pin unverified-pin');
    expect(html).toContain('pin-badge-unverified');
  });

  it('normalizes none geo_precision to none-pin and never styles as exact', () => {
    const apt: MapApartment = {
      id: 'apt-5',
      title: 'Квартира без координат',
      price: 18000,
      price_badge: '18 000 ₽',
      address: 'Томск',
      lat: null as any,
      lng: null as any,
      is_secret: false,
      geo_precision: 'none',
    };

    const props = buildMarkerProperties(apt);
    expect(props.geo_precision).toBe('none');
    expect(props.geo_class).toBe('none-pin');
    expect(props.precision_badge_html).toBe('');

    const html = buildMarkerHtml(props);
    expect(html).not.toContain('exact-pin');
    expect(html).toContain('none-pin');
  });
});
