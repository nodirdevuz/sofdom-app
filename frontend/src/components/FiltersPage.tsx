import React from 'react';
import { FilterState } from '../types';
import { Lang, I18N } from '../lib/i18n';

interface FiltersPageProps {
  filter: FilterState;
  onChangeFilter: (newFilter: Partial<FilterState>) => void;
  totalResultsCount: number;
  onReset: () => void;
  onApply: () => void;
  lang?: Lang;
}

const DISTRICTS_LIST = [
  'Все районы',
  'Советский район',
  'Кировский район',
  'Ленинский район',
  'Октябрьский район',
  'Пригород',
];

export const FiltersPage: React.FC<FiltersPageProps> = ({
  filter,
  onChangeFilter,
  totalResultsCount,
  onReset,
  onApply,
  lang = 'ru',
}) => {
  const currentRooms =
    filter.selectedRooms ||
    (filter.rooms ? filter.rooms.split(',').map((s) => s.trim()) : []);

  const toggleRoom = (roomCode: string) => {
    let updated: string[];
    if (currentRooms.includes(roomCode)) {
      updated = currentRooms.filter((r) => r !== roomCode);
    } else {
      updated = [...currentRooms, roomCode];
    }
    onChangeFilter({
      selectedRooms: updated,
      rooms: updated.length === 1 ? updated[0] : updated.length > 1 ? updated.join(',') : null,
    });
  };

  const handlePriceChip = (max: number | null) => {
    onChangeFilter({ maxPrice: filter.maxPrice === max ? null : max });
  };

  const handleAreaChip = (min: number | null, max: number | null) => {
    if (filter.minArea === min && filter.maxArea === max) {
      onChangeFilter({ minArea: null, maxArea: null });
    } else {
      onChangeFilter({ minArea: min, maxArea: max });
    }
  };

  const handleDistrictToggle = (dist: string) => {
    if (dist === 'Все районы') {
      onChangeFilter({ districts: [] });
      return;
    }
    const current = filter.districts || [];
    let updated: string[];
    if (current.includes(dist)) {
      updated = current.filter((d) => d !== dist);
    } else {
      updated = [...current, dist];
    }
    onChangeFilter({ districts: updated });
  };

  const isDistrictActive = (dist: string) => {
    if (dist === 'Все районы') {
      return !filter.districts || filter.districts.length === 0;
    }
    return filter.districts?.includes(dist) || false;
  };

  return (
    <div className="filters-fullpage-container">
      {/* Top Title Bar */}
      <div className="filters-page-header">
        <h1 className="filters-page-title">Фильтры поиска</h1>
        <button className="filters-page-reset-btn clickable" onClick={onReset}>
          Сбросить всё
        </button>
      </div>

      {/* Main Filter Sections */}
      <div className="filters-page-body">
        {/* 1. Количество комнат */}
        <section className="filter-card-section">
          <label className="filter-section-title">Количество комнат</label>
          <div className="rooms-chips-grid">
            {[
              { code: '0', label: 'Студия' },
              { code: '1', label: '1 комната' },
              { code: '2', label: '2 комнаты' },
              { code: '3+', label: '3+ комнат' },
            ].map((r) => {
              const active = currentRooms.includes(r.code);
              return (
                <button
                  key={r.code}
                  type="button"
                  className={`filter-room-btn ${active ? 'active' : ''} clickable`}
                  onClick={() => toggleRoom(r.code)}
                >
                  {active ? '✓ ' : ''}{r.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Цена в месяц */}
        <section className="filter-card-section">
          <div className="filter-section-header-row">
            <label className="filter-section-title">Цена в месяц, ₽</label>
          </div>
          <div className="price-inputs-row">
            <div className="price-input-wrap">
              <span className="price-input-prefix">от</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                className="price-num-input"
                value={filter.minPrice || ''}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value, 10) : null;
                  onChangeFilter({ minPrice: val });
                }}
              />
            </div>
            <div className="price-input-sep">—</div>
            <div className="price-input-wrap">
              <span className="price-input-prefix">до</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Любая"
                className="price-num-input"
                value={filter.maxPrice || ''}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value, 10) : null;
                  onChangeFilter({ maxPrice: val });
                }}
              />
            </div>
          </div>

          <div className="quick-price-chips">
            <button
              type="button"
              className={`quick-p-chip ${filter.maxPrice === 25000 ? 'active' : ''} clickable`}
              onClick={() => handlePriceChip(25000)}
            >
              до 25 000 ₽
            </button>
            <button
              type="button"
              className={`quick-p-chip ${filter.maxPrice === 35000 ? 'active' : ''} clickable`}
              onClick={() => handlePriceChip(35000)}
            >
              до 35 000 ₽
            </button>
            <button
              type="button"
              className={`quick-p-chip ${filter.maxPrice === 50000 ? 'active' : ''} clickable`}
              onClick={() => handlePriceChip(50000)}
            >
              до 50 000 ₽
            </button>
          </div>
        </section>

        {/* 3. Площадь квартиры */}
        <section className="filter-card-section">
          <label className="filter-section-title">Площадь, м²</label>
          <div className="price-inputs-row">
            <div className="price-input-wrap">
              <span className="price-input-prefix">от</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Любая"
                className="price-num-input"
                value={filter.minArea || ''}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value, 10) : null;
                  onChangeFilter({ minArea: val });
                }}
              />
            </div>
            <div className="price-input-sep">—</div>
            <div className="price-input-wrap">
              <span className="price-input-prefix">до</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Любая"
                className="price-num-input"
                value={filter.maxArea || ''}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value, 10) : null;
                  onChangeFilter({ maxArea: val });
                }}
              />
            </div>
          </div>

          <div className="quick-price-chips">
            <button
              type="button"
              className={`quick-p-chip ${filter.maxArea === 35 && !filter.minArea ? 'active' : ''} clickable`}
              onClick={() => handleAreaChip(null, 35)}
            >
              до 35 м²
            </button>
            <button
              type="button"
              className={`quick-p-chip ${filter.minArea === 35 && filter.maxArea === 55 ? 'active' : ''} clickable`}
              onClick={() => handleAreaChip(35, 55)}
            >
              35 – 55 м²
            </button>
            <button
              type="button"
              className={`quick-p-chip ${filter.minArea === 60 && !filter.maxArea ? 'active' : ''} clickable`}
              onClick={() => handleAreaChip(60, null)}
            >
              от 60 м²
            </button>
          </div>
        </section>

        {/* 4. Район города (Томск) */}
        <section className="filter-card-section">
          <label className="filter-section-title">Район города (Томск)</label>
          <div className="districts-chips-wrap">
            {DISTRICTS_LIST.map((dist) => {
              const active = isDistrictActive(dist);
              return (
                <button
                  key={dist}
                  type="button"
                  className={`district-filter-chip ${active ? 'active' : ''} clickable`}
                  onClick={() => handleDistrictToggle(dist)}
                >
                  {active ? '✓ ' : ''}{dist}
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. Сортировка */}
        <section className="filter-card-section">
          <label className="filter-section-title">Сортировка</label>
          <div className="sort-pills-row">
            <button
              type="button"
              className={`sort-pill ${filter.sortBy === 'new' ? 'active' : ''} clickable`}
              onClick={() => onChangeFilter({ sortBy: 'new' })}
            >
              Сначала новые
            </button>
            <button
              type="button"
              className={`sort-pill ${filter.sortBy === 'price_asc' ? 'active' : ''} clickable`}
              onClick={() => onChangeFilter({ sortBy: 'price_asc' })}
            >
              Сначала дешевле
            </button>
            <button
              type="button"
              className={`sort-pill ${filter.sortBy === 'price_desc' ? 'active' : ''} clickable`}
              onClick={() => onChangeFilter({ sortBy: 'price_desc' })}
            >
              Сначала дороже
            </button>
          </div>
        </section>

        {/* Actions Button */}
        <div className="filters-page-actions">
          <button
            type="button"
            className="filters-page-apply-btn clickable"
            onClick={onApply}
          >
            Показать {totalResultsCount} вариантов
          </button>
        </div>
      </div>
    </div>
  );
};
