import React, { useRef, useState } from 'react';
import { Offer, LayoutMode } from '../types';
import { FALLBACK_PHOTO_SVG } from '../lib/constants';
import { telemetry } from '../lib/telemetry';

interface ListingCardProps {
  offer: Offer;
  layoutMode: LayoutMode;
  onOpenDetail: (id: string) => void;
  onRevealPhoneFromFeed?: (id: string) => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  offer,
  layoutMode,
  onOpenDetail
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isFav, setIsFav] = useState(false);

  const scrollSlider = (e: React.MouseEvent, dir: number) => {
    e.stopPropagation();
    if (sliderRef.current) {
      const w = sliderRef.current.clientWidth;
      sliderRef.current.scrollBy({ left: dir * w, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (sliderRef.current) {
      const idx = Math.round(sliderRef.current.scrollLeft / sliderRef.current.clientWidth);
      setActivePhotoIdx(idx);
    }
  };

  const getDistrictText = () => {
    let d = offer.district;
    if (!d && offer.metro_name) {
      d = offer.metro_name.split('•')[0].trim();
    }
    if (!d && offer.address) {
      const match = offer.address.match(/(Советский|Кировский|Октябрьский|Ленинский)/i);
      if (match) d = match[1];
    }
    const cleaned = (d || 'Советский')
      .replace(/г\.?\s*Томск/gi, '')
      .replace(/Томск/gi, '')
      .replace(/р-н|район/gi, '')
      .trim();
    return `Томск, р-н ${cleaned || 'Советский'}`;
  };

  const districtText = getDistrictText();

  const formattedPrice = offer.price_val
    ? `${offer.price_val.toLocaleString('ru-RU')} ₽ / мес.`
    : `${offer.price_display.replace(/\/.*$/, '').replace(/₽/g, '').trim()} ₽ / мес.`;

  const handleOpen = () => {
    telemetry.track('listing_view', 3, { offerId: offer.id, title: offer.title, price: offer.price_val });
    onOpenDetail(offer.id);
  };

  const handleToggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isFav;
    setIsFav(next);
    telemetry.track('favorite_toggle', 2, { offerId: offer.id, isFavorite: next });
  };

  return (
    <article
      className={`offer-card ${layoutMode === 'list' ? 'card-list-layout' : 'card-grid-layout'}`}
      onClick={handleOpen}
    >
      {/* 1. Photo Gallery — Clean photo surface, no overlay icons or numbers */}
      <div className="card-gallery-wrap" onClick={handleOpen}>
        <div className="gallery-slider" ref={sliderRef} onScroll={handleScroll}>
          {offer.photos.slice(0, 3).map((p, idx) => (
            <img
              key={idx}
              className="gallery-slide-img"
              src={p}
              alt={offer.title}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.fallback) {
                  target.dataset.fallback = '1';
                  target.src = FALLBACK_PHOTO_SVG;
                  telemetry.trackFriction('broken_photo_cdn', 'ListingCard', { offerId: offer.id, url: p });
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* 2. Desktop List View: Middle Specs (Hidden on mobile 2-tile view) */}
      <div className="card-info-middle desktop-only-content">
        <div>
          <h2 className="card-title-h2">{offer.title}</h2>
          <div className="card-specs-row">
            {offer.floor_str} • Ремонт: {offer.renovation}
          </div>
          <div className="card-metro-box">
            <span className="metro-dot"></span>
            <span>{offer.metro_name}</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>• {offer.metro_walk}</span>
          </div>
          <div className="card-address-text">{offer.address}</div>
        </div>
        <div className="card-desc-snippet">{offer.desc_short}</div>
      </div>

      {/* 3. Desktop List View: Action Right (Hidden on mobile 2-tile view) */}
      <div className="card-action-right desktop-only-content">
        <div>
          <div className="card-price-main">
            {offer.price_display.includes('₽') ? offer.price_display : `${offer.price_display} ${offer.price_unit}`}
          </div>
          <div className="card-deposit-info">Залог: {offer.deposit}</div>
        </div>
        <div>
          <div className="card-time-ago">{offer.time_ago}</div>
          <button
            type="button"
            className="btn-card-details clickable"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(offer.id);
            }}
          >
            <span>Смотреть объявление</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>

      {/* 4. Mobile 2-Tile Body (Avito Exact Hierarchy: Photo -> Title + Heart -> Price -> District) */}
      <div className="card-mobile-body">
        {/* Шаг 1: Название квартиры (не жирное, аккуратное) + Лайк рядом на одной строке */}
        <div className="card-mobile-title-row">
          <h3 className="card-mobile-title">{offer.title}</h3>
          <button
            type="button"
            className={`card-inline-heart-btn ${isFav ? 'active' : ''} clickable`}
            onClick={handleToggleFav}
            aria-label={isFav ? "Удалить из избранного" : "Добавить в избранное"}
            title={isFav ? "В избранном" : "В избранное"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? '#ff6163' : 'none'} stroke={isFav ? '#ff6163' : '#8f98a3'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
          </button>
        </div>

        {/* Шаг 2: Цена на одной строке (чуть меньше, жирнее) */}
        <div className="card-mobile-price">{formattedPrice}</div>

        {/* Шаг 3: Район внизу (Томск, р-н ...) */}
        <div className="card-mobile-location">{districtText}</div>
      </div>
    </article>
  );
};
