import React from 'react';
import { VipOffer } from '../types';

interface VipSectionProps {
  vips: VipOffer[];
  onSelectVip: (id: string) => void;
}

export const VipSection: React.FC<VipSectionProps> = ({ vips, onSelectVip }) => {
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
                    target.src = 'https://tsk.s.bsps.ru/images/sobipro/galleries/ec/196162/3dbeb0.jpg';
                  }
                }}
              />
              <span className="card-badge-owner">VIP</span>
            </div>
            <div className="vip-card-body">
              <div className="vip-price">{vip.price}</div>
              <div className="vip-title">{vip.title}</div>
              <div className="vip-metro">
                <span className="metro-dot"></span>
                <span>{vip.metro}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
