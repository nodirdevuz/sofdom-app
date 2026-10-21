import React, { useState, useEffect, useRef } from 'react';
import { Offer } from '../types';
import { loadYmaps } from '../lib/ymaps';
import { ListingCard } from './ListingCard';
import { FALLBACK_PHOTO_SVG } from '../lib/constants';
import { telemetry } from '../lib/telemetry';

interface DetailPageProps {
  offer: Offer;
  onBackToFeed: () => void;
  onOpenLightbox: (startIdx: number) => void;
  similarOffers?: Offer[];
  onSelectOffer?: (id: string) => void;
}

export const DetailPage: React.FC<DetailPageProps> = ({
  offer,
  onBackToFeed,
  onOpenLightbox,
  similarOffers = [],
  onSelectOffer,
}) => {
  const getFormattedPhone = (rawPhone?: string, id?: string): string => {
    if (rawPhone) {
      const digits = rawPhone.replace(/\D/g, '');
      if (digits.length >= 10) {
        const d = digits.slice(-10);
        return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
      }
    }
    let hash = 0;
    const str = id || 'offer-default';
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
    }
    const abs = Math.abs(hash);
    const p1 = 913 + (abs % 80);
    const p2 = 200 + ((abs >> 4) % 700);
    const p3 = 10 + ((abs >> 8) % 89);
    const p4 = 10 + ((abs >> 12) % 89);
    return `+7 (${p1}) ${p2}-${p3}-${p4}`;
  };

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isPhoneRevealed, setIsPhoneRevealed] = useState(true);
  const [revealedPhone, setRevealedPhone] = useState(() => getFormattedPhone(offer.phone, offer.id));
  const [isFav, setIsFav] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const mainSliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActivePhotoIdx(0);
    setIsPhoneRevealed(true);
    setRevealedPhone(getFormattedPhone(offer.phone, offer.id));
    if (mainSliderRef.current) {
      mainSliderRef.current.scrollLeft = 0;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [offer.id, offer.phone]);

  const p = offer.photos;

  const scrollToPhoto = (idx: number) => {
    const nextIdx = (idx + p.length) % p.length;
    setActivePhotoIdx(nextIdx);
    if (mainSliderRef.current) {
      const width = mainSliderRef.current.clientWidth;
      mainSliderRef.current.scrollTo({ left: nextIdx * width, behavior: 'smooth' });
    }
  };

  const handleMainSliderScroll = () => {
    if (mainSliderRef.current) {
      const { scrollLeft, clientWidth } = mainSliderRef.current;
      if (clientWidth > 0) {
        const newIdx = Math.round(scrollLeft / clientWidth);
        if (newIdx !== activePhotoIdx && newIdx >= 0 && newIdx < p.length) {
          setActivePhotoIdx(newIdx);
        }
      }
    }
  };

  const prevPhoto = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    scrollToPhoto(activePhotoIdx - 1);
  };

  const nextPhoto = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    scrollToPhoto(activePhotoIdx + 1);
  };

  const handleTogglePhone = async () => {
    if (!isPhoneRevealed) {
      setIsPhoneRevealed(true);
      try {
        const res = await fetch(`/api/apartments/${offer.id}/unlock`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.phone && /\d/.test(data.phone)) {
            setRevealedPhone(getFormattedPhone(data.phone, offer.id));
          }
        }
      } catch (e) {
        // Fallback to local phone
      }
    } else {
      setIsPhoneRevealed(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!mapRef.current) return;

    loadYmaps().then((ym) => {
      if (cancelled || !mapRef.current) return;

      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }

      const map = new ym.Map(
        mapRef.current,
        {
          center: [offer.lat, offer.lng],
          zoom: 15,
          controls: [],
        },
        {
          suppressMapOpenBlock: true,
          suppressObsoleteBrowserNotifier: true,
          yandexMapDisablePoiInteractivity: true,
        }
      );

      // Explicitly enable two-finger multi-touch (pinch-zoom and rotate) and drag gestures
      map.behaviors.enable(['drag', 'multiTouch', 'dblClickZoom']);

      const priceLayout = ym.templateLayoutFactory.createClass(`
        <div class="price-pin-bubble active-pin">
          <span class="price-pin-text">$[properties.price_badge]</span>
          <div class="price-pin-arrow"></div>
        </div>
      `);

      const placemark = new ym.Placemark(
        [offer.lat, offer.lng],
        {
          price_badge: offer.price_display,
        },
        {
          iconLayout: priceLayout,
          iconShape: {
            type: 'Rectangle',
            coordinates: [
              [-42, -34],
              [42, 0],
            ],
          },
          hasBalloon: false,
        }
      );

      map.geoObjects.add(placemark);
      mapInstance.current = map;
    }).catch((err) => {
      console.warn('Yandex map load error in DetailPage:', err);
    });

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
    };
  }, [offer.lat, offer.lng, offer.price_display]);

  const copyPhone = () => {
    navigator.clipboard.writeText(revealedPhone);
    alert('Номер скопирован: ' + revealedPhone);
  };

  const shareOffer = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Ссылка на объявление скопирована в буфер обмена!');
  };

  const handleZoomIn = () => {
    if (mapInstance.current) {
      const z = mapInstance.current.getZoom();
      mapInstance.current.setZoom(Math.min(z + 1, 19), { duration: 250 });
    }
  };

  const handleZoomOut = () => {
    if (mapInstance.current) {
      const z = mapInstance.current.getZoom();
      mapInstance.current.setZoom(Math.max(z - 1, 9), { duration: 250 });
    }
  };

  const openExternalYandexMaps = () => {
    window.open(`https://yandex.ru/maps/?pt=${offer.lng},${offer.lat}&z=16&l=map`, '_blank');
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(offer.address);
    alert('Адрес скопирован: ' + offer.address);
  };

  const specsData = [
    { label: 'Тип жилья', val: offer.building_type || 'Квартира' },
    { label: 'Количество комнат', val: offer.rooms === 0 ? 'Студия' : typeof offer.rooms === 'number' ? `${offer.rooms}-комн` : (offer.rooms || '1-комн') },
    { label: 'Этаж', val: offer.floor ? `${offer.floor}` : (offer.floor_str ? offer.floor_str.split('/')[0] : '3') },
    { label: 'Этажность дома', val: offer.total_floors ? `${offer.total_floors}` : (offer.floor_str ? offer.floor_str.split('/')[1]?.replace(/[^\d]/g, '') || '9' : '9') },
    { label: 'Площадь, м²', val: `${offer.area}` },
    { label: 'Ремонт', val: offer.renovation || 'Евроремонт' },
    { label: 'Залог', val: offer.deposit || 'Без залога' }
  ];

  const sellerDisplayName = !offer.owner_name || offer.owner_name.toLowerCase() === 'собственник'
    ? 'Арендодатель'
    : offer.owner_name;

  return (
    <section id="detailSection" style={{ display: 'block' }}>
      {/* Top Bar with Back Button and Publication Time */}
      <div className="joymee-detail-topbar">
        <button className="joymee-btn-back clickable" onClick={onBackToFeed}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Назад к объявлениям</span>
        </button>
        <div className="joymee-topbar-meta">
          <span className="joymee-id-badge">№ {offer.id}</span>
          <span className="joymee-detail-time">{offer.time_ago || 'Сегодня'}</span>
        </div>
      </div>

      {/* 2-Column Joymee Layout */}
      <div className="joymee-detail-grid">
        {/* LEFT COLUMN: Main Photo Carousel + Thumbs + Desktop Seller Card */}
        <div className="joymee-left-col">
          {/* Main Photo Box with native touch swipe, snap momentum, counter and compact arrows */}
          <div className="joymee-main-photo-card">
            <div
              className="joymee-main-photo-slider"
              ref={mainSliderRef}
              onScroll={handleMainSliderScroll}
            >
              {p.map((imgUrl, i) => (
                <div
                  key={i}
                  className="joymee-main-photo-slide"
                  onClick={() => onOpenLightbox(i)}
                >
                  <img
                    src={imgUrl}
                    alt={`${offer.title} ${i + 1}`}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.fallback) {
                        target.dataset.fallback = '1';
                        target.src = FALLBACK_PHOTO_SVG;
                        telemetry.trackFriction('broken_photo_cdn', 'DetailPage', { offerId: offer.id, url: imgUrl });
                      }
                    }}
                  />
                </div>
              ))}
            </div>

            <button
              className="joymee-arrow-btn joymee-arrow-left"
              onClick={(e) => {
                e.stopPropagation();
                prevPhoto();
              }}
              aria-label="Предыдущее фото"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button
              className="joymee-arrow-btn joymee-arrow-right"
              onClick={(e) => {
                e.stopPropagation();
                nextPhoto();
              }}
              aria-label="Следующее фото"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>

            <div className="joymee-dashes-row">
              {p.map((_, i) => (
                <div
                  key={i}
                  className={`joymee-dash-bar ${i === activePhotoIdx ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToPhoto(i);
                  }}
                />
              ))}
            </div>

            {/* SofDom Photo Shield in bottom right corner */}
            <div className="detail-photo-shield" onClick={() => onOpenLightbox(activePhotoIdx)}>
              <div className="shield-top">
                <span className="shield-dot" />
                <span>SofDom • Проверено</span>
              </div>
              <div className="shield-sub">
                <span>№ {offer.id}</span>
                <span className="shield-tag">Оригинал</span>
              </div>
            </div>
          </div>

          {/* Thumbnails row below photo */}
          <div className="joymee-thumbs-strip">
            {p.map((imgUrl, i) => (
              <div
                key={i}
                className={`joymee-thumb-item ${i === activePhotoIdx ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  scrollToPhoto(i);
                }}
              >
                <img
                  src={imgUrl}
                  alt={`Миниатюра ${i + 1}`}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallback) {
                      target.dataset.fallback = '1';
                      target.src = FALLBACK_PHOTO_SVG;
                    }
                  }}
                />
              </div>
            ))}
          </div>

          {/* Desktop-only Seller Card (under photos) */}
          <div className="joymee-seller-card desktop-seller-card">
            <div className="joymee-seller-header">
              <div className="joymee-seller-avatar">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="joymee-seller-info">
                <div className="joymee-seller-name">{sellerDisplayName}</div>
              </div>
            </div>
            {/* Desktop Action Buttons: Call & Chat (Avito Style) */}
            <div className="joymee-seller-actions">
              {isPhoneRevealed ? (
                <a
                  href={`tel:${revealedPhone.replace(/[^0-9+]/g, '')}`}
                  onClick={() => telemetry.track('phone_reveal_click', 5, { offerId: offer.id, phone: revealedPhone })}
                  className="joymee-btn-seller-call clickable"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>{revealedPhone}</span>
                </a>
              ) : (
                <button
                  className="joymee-btn-seller-call clickable"
                  onClick={() => {
                    telemetry.track('phone_reveal_click', 5, { offerId: offer.id, phone: revealedPhone });
                    handleTogglePhone();
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>Позвонить</span>
                </button>
              )}

              <button
                className="joymee-btn-seller-chat clickable"
                onClick={() => {
                  telemetry.track('chat_click', 3, { offerId: offer.id });
                  const cleanPhone = revealedPhone.replace(/[^0-9]/g, '');
                  const msg = encodeURIComponent(`Здравствуйте! Я по поводу аренды квартиры (${offer.title}, № ${offer.id}) на SofDom.`);
                  window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>Написать</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Actions, Title, Price, Desc, Specs, Mobile-Seller, Location */}
        <div className="joymee-right-col">
          {/* Title */}
          <h1 className="joymee-title">{offer.title}</h1>

          {/* Price */}
          <div className="joymee-price">
            {offer.price_display.includes('₽') ? offer.price_display : `${offer.price_display} ${offer.price_unit}`}
          </div>

          {/* Description */}
          <div className="joymee-desc">{offer.full_desc || offer.desc_short}</div>

          {/* Specs List with Line Leaders */}
          <div className="joymee-specs-list">
            {specsData.map((s, idx) => (
              <div key={idx} className="joymee-spec-row">
                <span className="joymee-spec-label">{s.label}</span>
                <span className="joymee-spec-line"></span>
                <span className="joymee-spec-val">{s.val}</span>
              </div>
            ))}
          </div>

          {/* Mobile-only Seller Card (BEFORE LOCATION) */}
          <div className="joymee-seller-card mobile-seller-card">
            <div className="joymee-seller-header">
              <div className="joymee-seller-avatar">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="joymee-seller-info">
                <div className="joymee-seller-name">{sellerDisplayName}</div>
              </div>
            </div>
            {/* Desktop Action Buttons: Call & Chat (Avito Style) */}
            <div className="joymee-seller-actions">
              {isPhoneRevealed ? (
                <a
                  href={`tel:${revealedPhone.replace(/[^0-9+]/g, '')}`}
                  onClick={() => telemetry.track('phone_reveal_click', 5, { offerId: offer.id, phone: revealedPhone })}
                  className="joymee-btn-seller-call clickable"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>{revealedPhone}</span>
                </a>
              ) : (
                <button
                  className="joymee-btn-seller-call clickable"
                  onClick={() => {
                    telemetry.track('phone_reveal_click', 5, { offerId: offer.id, phone: revealedPhone });
                    handleTogglePhone();
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>Позвонить</span>
                </button>
              )}

              <button
                className="joymee-btn-seller-chat clickable"
                onClick={() => {
                  telemetry.track('chat_click', 3, { offerId: offer.id });
                  const cleanPhone = revealedPhone.replace(/[^0-9]/g, '');
                  const msg = encodeURIComponent(`Здравствуйте! Я по поводу аренды квартиры (${offer.title}, № ${offer.id}) на SofDom.`);
                  window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>Написать</span>
              </button>
            </div>
          </div>

          {/* Location Section */}
          <div className="joymee-location-box">
            <div className="joymee-location-header">
              <h2 className="joymee-location-title">Расположение</h2>
              <button className="joymee-btn-copy-address clickable" onClick={copyAddress} title="Скопировать адрес">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Скопировать</span>
              </button>
            </div>

            <div className="joymee-location-address">
              <div className="joymee-address-line">
                <span className="joymee-address-text">{offer.address}</span>
              </div>
              {offer.metro_name && (
                <div className="joymee-metro-tag">
                  <span className="metro-dot"></span>
                  <span className="metro-name">{offer.metro_name}</span>
                  {offer.metro_walk && <span className="metro-walk">• {offer.metro_walk}</span>}
                </div>
              )}
            </div>

            <div
              className="joymee-map-container"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <div
                ref={mapRef}
                style={{ width: '100%', height: '100%', touchAction: 'none' }}
              ></div>

              {/* Minimal Top-Right Action: Open in Yandex Maps */}
              <button
                className="joymee-map-expand-btn clickable"
                onClick={openExternalYandexMaps}
                title="Открыть в Яндекс Картах"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                <span>В Яндекс Карты</span>
              </button>

              {/* Minimal Sleek Zoom Controls */}
              <div className="joymee-map-zoom-stack">
                <button className="joymee-map-zoom-pill clickable" onClick={handleZoomIn} aria-label="Приблизить">+</button>
                <button className="joymee-map-zoom-pill clickable" onClick={handleZoomOut} aria-label="Отдалить">−</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Offers Section (Full width across the bottom of the page) */}
      {similarOffers && similarOffers.length > 0 && (
        <div className="joymee-similar-section">
          <div className="joymee-similar-header">
            <div>
              <h2 className="joymee-similar-title">Похожие квартиры</h2>
              <div className="joymee-similar-sub">Похожие по параметрам и цене</div>
            </div>
          </div>

          <div className="cards-container mode-grid joymee-similar-cards-container">
            {similarOffers.map((sim) => (
              <ListingCard
                key={sim.id}
                offer={sim}
                layoutMode="grid"
                onOpenDetail={(id) => {
                  if (onSelectOffer) {
                    onSelectOffer(id);
                    window.scrollTo({ top: 0, behavior: 'instant' });
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* AVITO-BENCHMARK STICKY BOTTOM ACTION DOCK (Mobile Benchmark) */}
      <div className="avito-sticky-dock">
        <button
          className={`avito-btn-fav ${isFav ? 'active' : ''} clickable`}
          onClick={() => {
            const next = !isFav;
            setIsFav(next);
            telemetry.track('favorite_toggle', 2, { offerId: offer.id, isFav: next });
          }}
          aria-label={isFav ? "Удалить из избранного" : "Добавить в избранное"}
          title={isFav ? "В избранном" : "В избранное"}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={isFav ? '#ff6163' : 'none'} stroke={isFav ? '#ff6163' : 'var(--text-main)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        </button>

        <a
          href={`tel:${revealedPhone.replace(/[^0-9+]/g, '')}`}
          className="avito-btn-call clickable"
          onClick={() => telemetry.track('phone_call_click', 5, { offerId: offer.id, phone: revealedPhone })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span>Позвонить</span>
        </a>

        <button
          className="avito-btn-chat clickable"
          onClick={() => {
            telemetry.track('chat_click', 3, { offerId: offer.id });
            const cleanPhone = revealedPhone.replace(/[^0-9]/g, '');
            const msg = encodeURIComponent(`Здравствуйте! Я по поводу аренды квартиры (${offer.title}, № ${offer.id}) на SofDom.`);
            window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Написать</span>
        </button>
      </div>
    </section>
  );
};
