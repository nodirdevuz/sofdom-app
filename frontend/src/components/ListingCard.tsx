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

  const district = offer.metro_name || (offer.address ? offer.address.split(',')[1]?.trim() : 'Советский р-н');

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
      {/* 1. Photo Gallery */}
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

        {/* Avito Benchmark Heart Favorite Button */}
        <button
          className={`card-heart-btn ${isFav ? 'active' : ''} clickable`}
          onClick={handleToggleFav}
          aria-label={isFav ? "Удалить из избранного" : "Добавить в избранное"}
          title={isFav ? "В избранном" : "В избранное"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? '#ff6163' : 'rgba(0,0,0,0.3)'} stroke={isFav ? '#ff6163' : '#ffffff'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        </button>

        <button className="gallery-arrow left" onClick={(e) => scrollSlider(e, -1)} aria-label="Предыдущее фото">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button className="gallery-arrow right" onClick={(e) => scrollSlider(e, 1)} aria-label="Следующее фото">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <span className="gallery-counter">
          {activePhotoIdx + 1}/{offer.photos_count || offer.photos.length}
        </span>
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

      {/* 4. Mobile 2-Tile Body (Avito 1-to-1 Exact Hierarchy) */}
      <div className="card-mobile-body">
        <div className="card-mobile-price-row">
          <span className="card-mobile-price">
            {offer.price_val ? `${offer.price_val.toLocaleString('ru-RU')} ₽` : offer.price_display.replace(/\/.*$/, '').replace(/₽/g, '').trim() + ' ₽'}
          </span>
          <span className="card-mobile-period">/мес.</span>
        </div>
        <h2 className="card-mobile-title">{offer.title}</h2>
        <div className="card-mobile-location">
          <span>Томск, {district}</span>
        </div>
        <div className="card-mobile-time">
          {offer.time_ago || 'Сегодня'}
        </div>
      </div>
    </article>
  );
};
