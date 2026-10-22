import React, { useEffect, useRef, useState, useCallback } from 'react';
import { loadYmaps } from '../lib/ymaps';
import {
  fetchMapApartments,
  MapApartment,
} from '../services/mapService';
import { buildMarkerProperties } from '../lib/mapMarkerUtils';
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
  isActive?: boolean;
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
  isActive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const ymapsRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const debounceTimerRef = useRef<any>(null);
  const lastPinClickTimeRef = useRef<number>(0);

  // Smoothly adapt map when active tab changes without remounting
  useEffect(() => {
    if (isActive && mapInstanceRef.current) {
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.container.fitToViewport();
        }
      }, 60);
    }
  }, [isActive]);

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
      lastPinClickTimeRef.current = Date.now();
      const apt = apartmentsRef.current.find((a) => String(a.id) === String(id));
      if (apt) {
        setSelectedApartment(apt);
        // Highlight active pin via DOM without destroying and rebuilding clusterer
        document.querySelectorAll('.price-pin-bubble.active-pin').forEach((el) => {
          el.classList.remove('active-pin');
        });
        const activeEl = document.querySelector(`.price-pin-bubble[data-id="${id}"]`);
        if (activeEl) {
          activeEl.classList.add('active-pin');
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([apt.lat, apt.lng], {
            flying: true,
            duration: 300,
          });
        }
      }
    },
    []
  );

  useEffect(() => {
    selectAptRef.current = handleSelectApartmentById;
  }, [handleSelectApartmentById]);

  // Capture phase click/touch listener on map container to guarantee 100% pin tap responsiveness
  // and ensure 2-finger pinch-to-zoom is never interrupted or blocked
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isMultiTouch = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isTouchDrag = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        isMultiTouch = true;
        isTouchDrag = true;
        return;
      }
      isMultiTouch = false;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      isTouchDrag = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        isMultiTouch = true;
        isTouchDrag = true;
        return;
      }
      if (e.touches.length === 1) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX);
        const dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx > 12 || dy > 12) {
          isTouchDrag = true;
        }
      }
    };

    const onPinTrigger = (e: MouseEvent | TouchEvent) => {
      if (isMultiTouch) {
        if ('touches' in e && e.touches.length === 0) {
          setTimeout(() => {
            isMultiTouch = false;
            isTouchDrag = false;
          }, 300);
        }
        return;
      }
      if (isTouchDrag && Date.now() - touchStartTime > 250 && e.type === 'touchend') return;

      // Extract tap coordinates from touch or mouse
      let clientX = 0;
      let clientY = 0;
      if ('changedTouches' in e && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      // Check all elements under finger/cursor piercing through Yandex Maps events pane
      let targetBubble: HTMLElement | null = null;
      if (clientX && clientY && typeof document.elementsFromPoint === 'function') {
        const stack = document.elementsFromPoint(clientX, clientY);
        for (const el of stack) {
          const bubble = (el as HTMLElement).closest?.('.price-pin-bubble');
          if (bubble) {
            targetBubble = bubble as HTMLElement;
            break;
          }
        }
      }

      if (!targetBubble) {
        targetBubble = (e.target as HTMLElement).closest?.('.price-pin-bubble');
      }

      if (targetBubble) {
        const aptId = targetBubble.getAttribute('data-id');
        if (aptId && selectAptRef.current) {
          lastPinClickTimeRef.current = Date.now();
          if (e.cancelable) {
            e.preventDefault();
          }
          e.stopPropagation();
          selectAptRef.current(aptId);
        }
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onPinTrigger, { capture: true, passive: false });
    container.addEventListener('click', onPinTrigger, true);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onPinTrigger, true);
      container.removeEventListener('click', onPinTrigger, true);
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
        '<div style="position:relative;transform:translate(-50%,-100%);margin-top:-2px;pointer-events:auto;">' +
          '<div class="price-pin-bubble $[properties.is_secret_class] $[properties.is_active_class] $[properties.geo_class]" data-id="$[properties.apartmentId]" data-precision="$[properties.geo_precision]">' +
            '<span class="price-pin-text">$[properties.price_badge]</span>' +
            '$[properties.precision_badge_html]' +
            '<div class="price-pin-arrow"></div>' +
          '</div>' +
        '</div>',
        {
          build: function () {
            priceLayout.superclass.build.call(this);
            const el = this.getParentElement()?.querySelector('.price-pin-bubble');
            if (el) {
              const onPinClick = (e: any) => {
                e.stopPropagation?.();
                lastPinClickTimeRef.current = Date.now();
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

      const placemarks = apts
        .filter((apt) => apt.geo_precision !== 'none')
        .map((apt) => {
          const isActive = activeId === apt.id;
          const markerProps = buildMarkerProperties(apt, isActive);
          const pm = new ym.Placemark(
            [apt.lat, apt.lng],
            markerProps,
            {
              iconLayout: priceLayout,
              iconOffset: [0, 0],
              iconShape: {
                type: 'Rectangle',
                coordinates: [
                  [-48, -42],
                  [48, 2],
                ],
              },
              hasBalloon: false,
              zIndex: isActive ? 1000 : 100,
            }
          );

          pm.events.add('click', (e: any) => {
            e.stopPropagation?.();
            lastPinClickTimeRef.current = Date.now();
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
            behaviors: ['drag', 'scrollZoom', 'multiTouch', 'dblClickZoom'],
          },
          {
            suppressMapOpenBlock: true,
            suppressObsoleteBrowserNotifier: true,
            yandexMapDisablePoiInteractivity: true,
            autoFitToViewport: 'always',
          }
        );

        // Explicitly enable multiTouch for smooth 2-finger pinch zoom
        map.behaviors.enable(['drag', 'scrollZoom', 'multiTouch', 'dblClickZoom']);

        mapInstanceRef.current = map;

        // Custom clusterer with brand styling and smooth controlled zoom without any popups/balloons
        const clusterer = new ym.Clusterer({
          preset: 'islands#yellowClusterIcons',
          groupByCoordinates: false,
          clusterDisableClickZoom: true, // We handle smooth controlled zoom
          clusterOpenBalloonOnClick: false, // Absolutely NO popup balloon window on cluster click
          hasBalloon: false,
          geoObjectHasBalloon: false,
          clusterHideIconOnBalloonOpen: false,
          geoObjectHideIconOnBalloonOpen: false,
          minClusterSize: 2,
          gridSize: 64,
          maxZoom: 16,
        });

        // Click on clusterer item or cluster itself
        clusterer.events.add('click', (e: any) => {
          e.preventDefault?.();
          const target = e.get('target');
          // If clicked on cluster of apartments (e.g. 2, 3, 4, 5 apartments)
          if (target && typeof target.getGeoObjects === 'function') {
            const map = mapInstanceRef.current;
            if (map) {
              const currentZoom = map.getZoom();
              // Smooth gentle zoom (+2 levels), capped at 17 to reveal individual apartment pins
              const nextZoom = Math.min(Math.round(currentZoom + 2), 17);
              const coords = target.geometry.getCoordinates();
              map.setCenter(coords, nextZoom, {
                duration: 320,
                timingFunction: 'ease-in-out',
                checkZoomRange: true,
              });
            }
            return;
          }

          // If clicked on a single placemark inside clusterer
          if (target && target.properties) {
            const aptId = target.properties.get('apartmentId');
            if (aptId && selectAptRef.current) {
              lastPinClickTimeRef.current = Date.now();
              selectAptRef.current(aptId);
            }
          }
        });

        clustererRef.current = clusterer;
        map.geoObjects.add(clusterer);

        // Click outside any marker (on map background) closes preview sheet
        map.events.add('click', (e: any) => {
          // Ignore click if a pin was just clicked in the last 700ms (prevents mobile synthetic click race condition)
          if (Date.now() - lastPinClickTimeRef.current < 700) return;
          const target = e.get('target');
          if (target && target !== map) return;
          setSelectedApartment(null);
          document.querySelectorAll('.price-pin-bubble.active-pin').forEach((el) => {
            el.classList.remove('active-pin');
          });
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
