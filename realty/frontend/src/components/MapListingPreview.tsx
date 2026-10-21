import React from 'react';
import { MapApartment, formatDistance } from '../services/mapService';
import { Lang, I18N } from '../lib/i18n';

interface Props {
  apartment: MapApartment | null;
  onClose: () => void;
  onOpenDetail: (id: string) => void;
  lang?: Lang;
}

export const MapListingPreview: React.FC<Props> = ({
  apartment,
  onClose,
  onOpenDetail,
  lang = 'ru',
}) => {
  if (!apartment) return null;

  const t = I18N[lang];
  const defaultPhoto = 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&fit=crop&q=80';
  const photo = apartment.photo && apartment.photo.trim() !== '' ? apartment.photo : defaultPhoto;
  const distText = formatDistance(apartment.distance_km);

  return (
    <div className="map-sheet-portal">
      {/* Semi-transparent backdrop overlay: tap outside the sheet to dismiss and continue exploring map */}
      <div
        className="map-sheet-backdrop"
        onClick={onClose}
        aria-label={t.map.close}
      />

      {/* Half-height bottom sheet (шторка до середины) */}
      <div
        className="map-bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={apartment.title}
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Grab Handle Bar */}
        <div className="sheet-handle-row" onClick={onClose} title={t.map.close}>
          <div className="sheet-handle-bar" />
        </div>

        {/* Close Button */}
        <button
          className="sheet-close-btn"
          onClick={onClose}
          aria-label={t.map.close}
        >
          ✕
        </button>

        {/* Scrollable / Interactive Sheet Content */}
        <div className="sheet-body" onClick={() => onOpenDetail(apartment.id)}>
          {/* Top Row: Price + Badges */}
          <div className="sheet-header-row">
            <div className="sheet-price-wrap">
              <span className="sheet-price">
                {apartment.price_badge || `${apartment.price.toLocaleString('ru-RU')} ₽`}
              </span>
              <span className="sheet-period">{t.map.perMonth}</span>
            </div>

            <div className="sheet-badges-row">
              {apartment.is_secret && (
                <span className="sheet-badge-secret">{t.map.earlyAccess}</span>
              )}
              <span className="sheet-badge-owner">{t.map.ownerDirect}</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="sheet-title">{apartment.title}</h3>

          {/* Address & District */}
          <div className="sheet-address-row">
            <span className="sheet-address-icon">📍</span>
            <span className="sheet-address-text">
              {apartment.address}
              {apartment.district ? ` • ${apartment.district}` : ''}
            </span>
          </div>

          {/* Main Visual: Photo + Metadata overlay */}
          <div className="sheet-photo-container">
            <img
              src={photo}
              alt={apartment.title}
              className="sheet-photo-img"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = defaultPhoto;
              }}
            />
            {apartment.photos_count && apartment.photos_count > 1 ? (
              <span className="sheet-photos-pill">📷 {apartment.photos_count}</span>
            ) : null}
            {distText ? (
              <span className="sheet-dist-pill">🚶 {distText}</span>
            ) : null}
          </div>

          {/* Details / Badges Tag Row */}
          <div className="sheet-tags-row">
            <span className="sheet-tag">✨ {t.map.noCommission}</span>
            {apartment.deposit ? (
              <span className="sheet-tag">
                {typeof apartment.deposit === 'number' && apartment.deposit === 0
                  ? `🛡️ ${t.map.noDeposit}`
                  : `🛡️ ${apartment.deposit}`}
              </span>
            ) : (
              <span className="sheet-tag">🛡️ {t.map.noDeposit}</span>
            )}
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="sheet-action-footer">
          <button
            className="sheet-primary-btn clickable"
            onClick={() => onOpenDetail(apartment.id)}
          >
            <span>{t.map.viewDetails}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
