import React, { useState, useEffect, useRef } from 'react';
import { Offer } from '../types';
import { loadYmaps } from '../lib/ymaps';

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
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isPhoneRevealed, setIsPhoneRevealed] = useState(false);
  const [revealedPhone, setRevealedPhone] = useState(offer.phone);
  const [isFav, setIsFav] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    setActivePhotoIdx(0);
    setIsPhoneRevealed(false);
    setRevealedPhone(offer.phone);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [offer.id, offer.phone]);

  const handleTogglePhone = async () => {
    if (!isPhoneRevealed) {
      setIsPhoneRevealed(true);
      try {
        const res = await fetch(`/api/apartments/${offer.id}/unlock`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.phone) {
            setRevealedPhone(data.phone);
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

  const p = offer.photos;

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePhotoIdx((prev) => (prev - 1 + p.length) % p.length);
  };

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePhotoIdx((prev) => (prev + 1) % p.length);
  };

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
    { label: 'Кто разместил', val: offer.is_owner ? 'Собственник' : 'Агент' },
    { label: 'Тип квартиры', val: offer.building_type || 'Вторичка' },
    { label: 'Количество комнат', val: offer.rooms === 0 ? 'Студия' : typeof offer.rooms === 'number' ? `${offer.rooms}-комн` : (offer.rooms || '1-комн') },
    { label: 'Этаж', val: offer.floor ? `${offer.floor}` : (offer.floor_str ? offer.floor_str.split('/')[0] : '3') },
    { label: 'Этажность дома', val: offer.total_floors ? `${offer.total_floors}` : (offer.floor_str ? offer.floor_str.split('/')[1]?.replace(/[^\d]/g, '') || '9' : '9') },
    { label: 'Площадь, м²', val: `${offer.area}` },
    { label: 'Ремонт', val: offer.renovation || 'Евроремонт' },
    { label: 'Залог', val: offer.deposit || 'Без залога' }
  ];

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
        <span className="joymee-detail-time">{offer.time_ago || 'Сегодня'}</span>
      </div>

      {/* 2-Column Joymee Layout */}
      <div className="joymee-detail-grid">
        {/* LEFT COLUMN: Main Photo Carousel + Thumbs + Desktop Seller Card */}
        <div className="joymee-left-col">
          {/* Main Photo Box with compact subtle arrows & dashes */}
          <div className="joymee-main-photo-card" onClick={() => onOpenLightbox(activePhotoIdx)}>
            <img src={p[activePhotoIdx]} alt={offer.title} />

            <button className="joymee-arrow-btn joymee-arrow-left" onClick={prevPhoto}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button className="joymee-arrow-btn joymee-arrow-right" onClick={nextPhoto}>
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
                    setActivePhotoIdx(i);
                  }}
                />
              ))}
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
                  setActivePhotoIdx(i);
                }}
              >
                <img src={imgUrl} alt={`Миниатюра ${i + 1}`} />
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
                <div className="joymee-seller-name">{offer.owner_name || 'Собственник'}</div>
                <div className="joymee-seller-role">Собственник • Проверен</div>
              </div>
            </div>
            <button className="joymee-btn-view-profile clickable" onClick={() => alert('Профиль собственника проверен через Росреестр')}>
              Посмотреть профиль
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Actions, Tags, Title, Price, Desc, Specs, Mobile-Seller, Location */}
        <div className="joymee-right-col">
          {/* Top Action Buttons */}
          <div className="joymee-action-btns-row">
            <button className="joymee-btn-message clickable" onClick={() => alert('Открывается диалог с собственником в SofDom')}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Написать продавцу</span>
            </button>
            <button className="joymee-btn-call clickable" onClick={handleTogglePhone}>
              {isPhoneRevealed ? 'Скрыть номер' : 'Позвонить'}
            </button>
          </div>

          {/* Revealed Phone Box */}
          {isPhoneRevealed && (
            <div className="joymee-phone-revealed">
              <a href={`tel:${revealedPhone.replace(/[^0-9+]/g, '')}`} className="joymee-phone-number">
                {revealedPhone}
              </a>
              <button className="joymee-btn-copy clickable" onClick={copyPhone}>
                Скопировать
              </button>
            </div>
          )}

          {/* Badges & Action Icons */}
          <div className="joymee-meta-row">
            <div className="joymee-tags-group">
              <span className="joymee-pill-tag">
                {offer.deal_type === 'Посуточная' ? 'ПОСУТОЧНО' : 'АРЕНДА'}
              </span>
              <span className="joymee-pill-tag">КВАРТИРА</span>
              <span className="joymee-pill-tag">
                {offer.is_owner ? 'СОБСТВЕННИК' : 'ПРОВЕРЕНО'}
              </span>
            </div>

            <div className="joymee-icons-group">
              <button
                className="joymee-icon-btn clickable"
                title="В избранное"
                onClick={() => setIsFav(!isFav)}
                style={{ color: isFav ? '#ef4444' : '' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill={isFav ? '#ef4444' : 'none'} stroke="currentColor" strokeWidth="1.8">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </button>
              <button className="joymee-icon-btn clickable" title="Чат" onClick={() => alert('Открывается диалог в SofDom')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
              <button className="joymee-icon-btn clickable" title="Поделиться" onClick={shareOffer}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Title */}
          <h1 className="joymee-title">{offer.title}</h1>

          {/* Price */}
          <div className="joymee-price">
            {offer.price_display} {offer.price_unit}
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
                <div className="joymee-seller-name">{offer.owner_name || 'Собственник'}</div>
                <div className="joymee-seller-role">Собственник • Проверен</div>
              </div>
            </div>
            <button className="joymee-btn-view-profile clickable" onClick={() => alert('Профиль собственника проверен через Росреестр')}>
              Посмотреть профиль
            </button>
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

            <div className="joymee-map-container">
              <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>

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

          {/* Similar Offers Section */}
          {similarOffers && similarOffers.length > 0 && (
            <div className="joymee-similar-section">
              <div className="joymee-similar-header">
                <div>
                  <h2 className="joymee-similar-title">Похожие квартиры</h2>
                  <div className="joymee-similar-sub">Похожие по параметрам и цене</div>
                </div>
              </div>

              <div className="joymee-similar-grid">
                {similarOffers.map((sim) => (
                  <div
                    key={sim.id}
                    className="joymee-similar-card clickable"
                    onClick={() => {
                      if (onSelectOffer) {
                        onSelectOffer(sim.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                  >
                    <div className="joymee-similar-photo-wrap">
                      <img
                        src={sim.photos[0] || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80'}
                        alt={sim.title}
                        className="joymee-similar-photo"
                        loading="lazy"
                      />
                      {sim.photos_count > 1 && (
                        <span className="joymee-similar-count-badge">📷 {sim.photos_count}</span>
                      )}
                    </div>
                    <div className="joymee-similar-info">
                      <div className="joymee-similar-price">
                        {sim.price_display} <span className="joymee-similar-unit">{sim.price_unit}</span>
                      </div>
                      <div className="joymee-similar-card-title">{sim.title}</div>
                      <div className="joymee-similar-address-text">📍 {sim.metro_name || sim.address}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
