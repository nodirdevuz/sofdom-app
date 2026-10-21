import React, { useEffect, useRef, useState, useCallback } from 'react';
import { loadYmaps } from '../lib/ymaps';
import {
  fetchMapApartments,
  MapApartment,
} from '../services/mapService';
import { MapListingPreview } from './MapListingPreview';
import { Lang, I18N } from '../lib/i18n';

interface Props {
  onSelectApartment: (id: string) => void;
  className?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  showDistrictChips?: boolean;
  onClose?: () => void;
  lang?: Lang;
}

const DISTRICT_COORDS: Record<string, [number, number]> = {
  'Кировский': [56.460, 84.970],
  'Советский': [56.478, 84.985],
  'Ленинский': [56.515, 84.960],
  'Октябрьский': [56.508, 85.030],
  'Пригород': [56.425, 85.015],
};

const DISTRICTS = [
  'Все районы',
  'Кировский',
  'Советский',
  'Ленинский',
  'Октябрьский',
  'Пригород',
];

export const YandexMap: React.FC<Props> = ({
  onSelectApartment,
  className = '',
  initialCenter = [56.4977, 84.9744],
  initialZoom = 12,
  showDistrictChips = true,
  onClose,
  lang = 'ru',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const ymapsRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const debounceTimerRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apartments, setApartments] = useState<MapApartment[]>([]);
  const [selectedApartment, setSelectedApartment] = useState<MapApartment | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Все районы');
  const [locating, setLocating] = useState(false);
  const [foundCount, setFoundCount] = useState<number>(0);

  const apartmentsRef = useRef<MapApartment[]>([]);
  useEffect(() => {
    apartmentsRef.current = apartments;
  }, [apartments]);

  const selectAptRef = useRef<((id: string) => void) | null>(null);

  const handleSelectApartmentById = useCallback(
    (id: string) => {
      const apt = apartmentsRef.current.find((a) => String(a.id) === String(id));
      if (apt) {
        setSelectedApartment(apt);
        renderPlacemarks(apartmentsRef.current, apt.id);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([apt.lat, apt.lng], {
            flying: true,
            duration: 350,
          });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    selectAptRef.current = handleSelectApartmentById;
  }, [handleSelectApartmentById]);

  // Capture phase click listener on map container to guarantee 100% pin tap responsiveness
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onContainerClick = (e: MouseEvent | TouchEvent) => {
      const target = (e.target as HTMLElement).closest('.price-pin-bubble');
      if (target) {
        const aptId = target.getAttribute('data-id');
        if (aptId && selectAptRef.current) {
          e.preventDefault();
          e.stopPropagation();
          selectAptRef.current(aptId);
        }
      }
    };

    container.addEventListener('click', onContainerClick, true);
    container.addEventListener('touchend', onContainerClick, true);
    return () => {
      container.removeEventListener('click', onContainerClick, true);
      container.removeEventListener('touchend', onContainerClick, true);
    };
  }, []);

  // Refresh placemarks on the map
  const renderPlacemarks = useCallback(
    (apts: MapApartment[], activeId?: string) => {
      const ym = ymapsRef.current;
      const clusterer = clustererRef.current;
      if (!ym || !clusterer) return;

      clusterer.removeAll();

      const priceLayout = ym.templateLayoutFactory.createClass(
        '<div class="price-pin-bubble $[properties.is_secret_class] $[properties.is_active_class]" data-id="$[properties.apartmentId]">' +
          '<span class="price-pin-text">$[properties.price_badge]</span>' +
          '<div class="price-pin-arrow"></div>' +
        '</div>',
        {
          build: function () {
            priceLayout.superclass.build.call(this);
            const el = this.getParentElement()?.querySelector('.price-pin-bubble');
            if (el) {
              const onPinClick = (e: any) => {
                e.stopPropagation?.();
                const aptId = this.getData()?.properties?.get('apartmentId');
                if (aptId && selectAptRef.current) {
                  selectAptRef.current(aptId);
                }
              };
              el.addEventListener('click', onPinClick);
              el.addEventListener('touchend', onPinClick);
              this._cleanup = () => {
                el.removeEventListener('click', onPinClick);
                el.removeEventListener('touchend', onPinClick);
              };
            }
          },
          clear: function () {
            if (this._cleanup) this._cleanup();
            priceLayout.superclass.clear.call(this);
          },
        }
      );

      const placemarks = apts.map((apt) => {
        const isActive = activeId === apt.id;
        const pm = new ym.Placemark(
          [apt.lat, apt.lng],
          {
            price_badge: apt.price_badge,
            is_secret_class: apt.is_secret ? 'secret-pin' : '',
            is_active_class: isActive ? 'active-pin' : '',
            apartmentId: apt.id,
          },
          {
            iconLayout: priceLayout,
            iconOffset: [-36, -34],
            iconShape: {
              type: 'Rectangle',
              coordinates: [
                [-36, -34],
                [36, 0],
              ],
            },
            hasBalloon: false,
            zIndex: isActive ? 1000 : 100,
          }
        );

        pm.events.add('click', (e: any) => {
          e.stopPropagation?.();
          handleSelectApartmentById(apt.id);
        });

        return pm;
      });

      clusterer.add(placemarks);
    },
    [handleSelectApartmentById]
  );

  // Load apartments with params
  const loadData = useCallback(
    async (params: { district?: string; lat?: number; lng?: number; bbox?: string } = {}) => {
      try {
        const qDistrict = params.district && params.district !== 'Все районы' ? params.district : undefined;
        const res = await fetchMapApartments({
          district: qDistrict,
          lat: params.lat,
          lng: params.lng,
          bbox: params.bbox,
        });

        setApartments(res.apartments);
        setFoundCount(res.apartments.length);
        renderPlacemarks(res.apartments, selectedApartment?.id);
      } catch (err) {
        console.warn('Map data load error:', err);
      }
    },
    [renderPlacemarks, selectedApartment]
  );

  // Initialize Map
  useEffect(() => {
    let cancelled = false;

    loadYmaps()
      .then((ym) => {
        if (cancelled || !containerRef.current) return;
        ymapsRef.current = ym;

        const map = new ym.Map(
          containerRef.current,
          {
            center: initialCenter,
            zoom: initialZoom,
            controls: [],
          },
          {
            suppressMapOpenBlock: true,
            suppressObsoleteBrowserNotifier: true,
            yandexMapDisablePoiInteractivity: true,
            autoFitToViewport: 'always',
          }
        );

        mapInstanceRef.current = map;

        // Custom clusterer with brand styling
        const clusterer = new ym.Clusterer({
          preset: 'islands#yellowClusterIcons',
          groupByCoordinates: false,
          clusterDisableClickZoom: false,
          clusterHideIconOnBalloonOpen: false,
          geoObjectHideIconOnBalloonOpen: false,
          minClusterSize: 2,
        });

        // Clicking a clusterer item selects apartment if it was a single placemark
        clusterer.events.add('click', (e: any) => {
          const target = e.get('target');
          if (target && target.properties) {
            const aptId = target.properties.get('apartmentId');
            if (aptId && selectAptRef.current) {
              selectAptRef.current(aptId);
            }
          }
        });

        clustererRef.current = clusterer;
        map.geoObjects.add(clusterer);

        // Viewport debouncing: 400ms after user pan/zoom
        map.events.add('boundschange', () => {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            const bounds = map.getBounds();
            if (bounds && bounds[0] && bounds[1]) {
              const bbox = `${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]}`;
              loadData({ bbox });
            }
          }, 400);
        });

        // Click outside any marker (on map background) closes preview sheet
        map.events.add('click', (e: any) => {
          const target = e.get('target');
          if (!target || target === map) {
            setSelectedApartment(null);
          }
        });

        setLoading(false);
        loadData();
      })
      .catch((err) => {
        console.error('Failed to load Yandex Maps:', err);
        if (!cancelled) {
          setError('Не удалось загрузить Яндекс Карты. Проверьте подключение к сети.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // District filter change
  const handleSelectDistrict = (district: string) => {
    setSelectedDistrict(district);
    setSelectedApartment(null);

    const coords = DISTRICT_COORDS[district];
    if (coords && mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(coords, 13, {
        duration: 400,
        checkZoomRange: true,
      });
    }

    loadData({ district });
  };

  // "Где я стою" (Geolocation)
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается вашим браузером');
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;

        const map = mapInstanceRef.current;
        const ym = ymapsRef.current;

        if (map && ym) {
          map.setCenter([latitude, longitude], 14, {
            duration: 500,
            checkZoomRange: true,
          });

          if (userMarkerRef.current) {
            map.geoObjects.remove(userMarkerRef.current);
          }

          const userPlacemark = new ym.Placemark(
            [latitude, longitude],
            { hintContent: I18N[lang].map.nearYou },
            {
              preset: 'islands#blueCircleDotIcon',
              zIndex: 2000,
            }
          );

          userMarkerRef.current = userPlacemark;
          map.geoObjects.add(userPlacemark);
        }

        loadData({ lat: latitude, lng: longitude });
      },
      (err) => {
        setLocating(false);
        console.warn('Geolocation error:', err.message);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter([56.4977, 84.9744], 13, { duration: 400 });
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const t = I18N[lang];

  return (
    <div className={`joymee-yandex-map-wrapper ${className}`}>
      {/* Top Header / District Filter */}
      {showDistrictChips && (
        <div className="map-top-bar">
          <div className="map-districts-scroll">
            {DISTRICTS.map((d) => (
              <button
                key={d}
                className={`map-district-chip ${selectedDistrict === d ? 'active' : ''}`}
                onClick={() => handleSelectDistrict(d)}
              >
                {d === 'Все районы' ? t.map.allDistricts : d}
              </button>
            ))}
          </div>

          {onClose && (
            <button className="map-close-overlay-btn" onClick={onClose} aria-label="Закрыть карту">
              ✕
            </button>
          )}
        </div>
      )}

      {/* Map Canvas */}
      <div ref={containerRef} className="joymee-ymap-canvas" />

      {/* Floating Action Button: Где я стою */}
      <button
        className={`map-locate-me-btn ${locating ? 'locating' : ''}`}
        onClick={handleLocateMe}
        title={t.map.locateMe}
      >
        <span className="locate-icon">{locating ? '⏳' : '🎯'}</span>
        <span className="locate-text">{locating ? t.map.locating : t.map.locateMe}</span>
      </button>

      {/* Sleek Minimal Zoom Controls */}
      <div className="map-zoom-controls">
        <button
          className="map-zoom-btn clickable"
          onClick={() => {
            if (mapInstanceRef.current) {
              const z = mapInstanceRef.current.getZoom();
              mapInstanceRef.current.setZoom(Math.min(z + 1, 19), { duration: 200 });
            }
          }}
          aria-label="Приблизить"
        >
          +
        </button>
        <button
          className="map-zoom-btn clickable"
          onClick={() => {
            if (mapInstanceRef.current) {
              const z = mapInstanceRef.current.getZoom();
              mapInstanceRef.current.setZoom(Math.max(z - 1, 9), { duration: 200 });
            }
          }}
          aria-label="Отдалить"
        >
          −
        </button>
      </div>

      {/* Counter Tag */}
      {foundCount > 0 && (
        <div className="map-count-badge">
          {t.map.variants(foundCount)}
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="map-loading-overlay">
          <div className="map-spinner" />
          <span>{t.map.loading}</span>
        </div>
      )}

      {/* Error Message */}
      {error && <div className="map-error-banner">⚠️ {error}</div>}

      {/* Half-Height Bottom Sheet (Шторка до середины) */}
      <MapListingPreview
        apartment={selectedApartment}
        onClose={() => setSelectedApartment(null)}
        onOpenDetail={onSelectApartment}
        lang={lang}
      />
    </div>
  );
};
