import React from 'react';
import { VipOffer } from '../types';
import { FALLBACK_PHOTO_SVG } from '../lib/constants';

interface VipSectionProps {
  vips: VipOffer[];
  onSelectVip: (id: string) => void;
}

export const VipSection: React.FC<VipSectionProps> = ({ vips, onSelectVip }) => {
  const getVipDistrict = (metro: string) => {
    const cleaned = metro
      .replace(/г\.?\s*Томск/gi, '')
      .replace(/Томск/gi, '')
      .replace(/р-н|район/gi, '')
      .replace(/•.*$/g, '')
      .trim();
    return `Томск, р-н ${cleaned || 'Советский'}`;
  };

  const formatVipPrice = (priceStr: string) => {
    let clean = priceStr.replace(/\/.*$/, '').replace(/₽/g, '').trim();
    return `${clean} ₽ / мес.`;
  };

  return (
    <section className="vip-section">
      <div className="section-title-wrap">
        <div className="section-title">
          <span>Рекомендуемые квартиры</span>
          <span className="vip-badge-tag">VIP</span>
        </div>
      </div>
      <div className="vip-carousel">
        {vips.map((vip) => (
          <div key={vip.id} className="vip-card clickable" onClick={() => onSelectVip(vip.offer_ref || vip.id)}>
            <div className="vip-card-img-wrap">
              <img
                src={vip.photo}
                alt={vip.title}
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.fallback) {
                    target.dataset.fallback = '1';
                    target.src = FALLBACK_PHOTO_SVG;
                  }
                }}
              />
              <span className="card-badge-owner">VIP</span>
            </div>
            <div className="vip-card-body">
              {/* Шаг 1: Название квартиры (не жирное, обычными словами) */}
              <div className="vip-title">{vip.title}</div>
              {/* Шаг 2: Цена на одной строке (чуть-чуть жирное) */}
              <div className="vip-price">{formatVipPrice(vip.price)}</div>
              {/* Шаг 3: Район (на сером, незаметными: Томск, р-н ...) */}
              <div className="vip-metro">{getVipDistrict(vip.metro)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
