import React, { useEffect, useState } from 'react';
import { FilterState } from '../types';
import { Lang, I18N } from '../lib/i18n';

interface FiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  filter: FilterState;
  onChangeFilter: (newFilter: Partial<FilterState>) => void;
  totalResultsCount: number;
  onReset: () => void;
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

export const FiltersModal: React.FC<FiltersModalProps> = ({
  isOpen,
  onClose,
  filter,
  onChangeFilter,
  totalResultsCount,
  onReset,
  lang = 'ru',
}) => {
  // Local state for interactive editing before applying or real-time sync
  const currentRooms = filter.selectedRooms || (filter.rooms ? filter.rooms.split(',').map((s) => s.trim()) : []);

  // Bulletproof body scroll lock so background NEVER moves
  useEffect(() => {
    if (!isOpen) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const preventBackgroundTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.filters-sheet-body')) {
        return; // Allow scrolling inside the filters sheet content
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    window.addEventListener('touchmove', preventBackgroundTouch, { passive: false });

    return () => {
      window.removeEventListener('touchmove', preventBackgroundTouch);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
    };
  }, [isOpen]);

  if (!isOpen) return null;

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
    onChangeFilter({ maxPrice: max });
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
    <div
      className="filters-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="filters-sheet-card" onClick={(e) => e.stopPropagation()}>
        {/* Grab Handle */}
        <div className="sheet-handle-row" onClick={onClose}>
          <div className="sheet-handle-bar"></div>
        </div>

        {/* Header */}
        <div className="filters-sheet-header">
          <button className="filters-reset-btn clickable" onClick={onReset}>
            Сбросить
          </button>
          <h2 className="filters-sheet-title">Фильтры</h2>
          <button className="filters-sheet-close clickable" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="filters-sheet-body">
          {/* 1. Тип аренды */}
          <div className="filter-group">
            <label className="filter-group-label">Срок аренды</label>
            <div className="segmented-tabs filter-tabs">
              <button
                className={`tab-item ${!filter.dealType || filter.dealType === 'all' ? 'active' : ''} clickable`}
                onClick={() => onChangeFilter({ dealType: 'all' as any })}
              >
                Все
              </button>
              <button
                className={`tab-item ${filter.dealType === 'Длительная аренда' ? 'active' : ''} clickable`}
                onClick={() => onChangeFilter({ dealType: 'Длительная аренда' })}
              >
                Длительно
              </button>
              <button
                className={`tab-item ${filter.dealType === 'Посуточная' ? 'active' : ''} clickable`}
                onClick={() => onChangeFilter({ dealType: 'Посуточная' })}
              >
                Посуточно
              </button>
            </div>
          </div>

          {/* 2. Количество комнат */}
          <div className="filter-group">
            <label className="filter-group-label">Количество комнат</label>
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
                    className={`filter-room-btn ${active ? 'active' : ''} clickable`}
                    onClick={() => toggleRoom(r.code)}
                  >
                    {active ? '✓ ' : ''}{r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Цена, ₽ в месяц */}
          <div className="filter-group">
            <label className="filter-group-label">Цена в месяц, ₽</label>
            <div className="price-inputs-row">
              <div className="price-input-wrap">
                <span className="price-input-prefix">от</span>
                <input
                  type="number"
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
                className={`quick-p-chip ${filter.maxPrice === 25000 ? 'active' : ''} clickable`}
                onClick={() => handlePriceChip(filter.maxPrice === 25000 ? null : 25000)}
              >
                до 25 000 ₽
              </button>
              <button
                className={`quick-p-chip ${filter.maxPrice === 35000 ? 'active' : ''} clickable`}
                onClick={() => handlePriceChip(filter.maxPrice === 35000 ? null : 35000)}
              >
                до 35 000 ₽
              </button>
              <button
                className={`quick-p-chip ${filter.maxPrice === 50000 ? 'active' : ''} clickable`}
                onClick={() => handlePriceChip(filter.maxPrice === 50000 ? null : 50000)}
              >
                до 50 000 ₽
              </button>
            </div>
          </div>

          {/* 4. Районы Томска */}
          <div className="filter-group">
            <label className="filter-group-label">Район города (Томск)</label>
            <div className="districts-chips-wrap">
              {DISTRICTS_LIST.map((dist) => {
                const active = isDistrictActive(dist);
                return (
                  <button
                    key={dist}
                    className={`district-filter-chip ${active ? 'active' : ''} clickable`}
                    onClick={() => handleDistrictToggle(dist)}
                  >
                    {active ? '✓ ' : ''}{dist}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Условия и параметры */}
          <div className="filter-group">
            <label className="filter-group-label">Особенности</label>
            <div className="toggles-list">
              <label className="toggle-row clickable">
                <span className="toggle-label-text">Только от собственников (Без комиссии)</span>
                <input
                  type="checkbox"
                  className="filter-checkbox"
                  checked={filter.ownerOnly}
                  onChange={(e) => onChangeFilter({ ownerOnly: e.target.checked })}
                />
              </label>

              <label className="toggle-row clickable">
                <span className="toggle-label-text">Без залога</span>
                <input
                  type="checkbox"
                  className="filter-checkbox"
                  checked={filter.noDeposit}
                  onChange={(e) => onChangeFilter({ noDeposit: e.target.checked })}
                />
              </label>

              <label className="toggle-row clickable">
                <span className="toggle-label-text">С евроремонтом</span>
                <input
                  type="checkbox"
                  className="filter-checkbox"
                  checked={!!filter.hasRenovation}
                  onChange={(e) => onChangeFilter({ hasRenovation: e.target.checked })}
                />
              </label>

              <label className="toggle-row clickable">
                <span className="toggle-label-text">Не первый этаж</span>
                <input
                  type="checkbox"
                  className="filter-checkbox"
                  checked={!!filter.notFirstFloor}
                  onChange={(e) => onChangeFilter({ notFirstFloor: e.target.checked })}
                />
              </label>
            </div>
          </div>

          {/* 6. Сортировка */}
          <div className="filter-group">
            <label className="filter-group-label">Сортировка</label>
            <div className="sort-pills-row">
              <button
                className={`sort-pill ${filter.sortBy === 'new' ? 'active' : ''} clickable`}
                onClick={() => onChangeFilter({ sortBy: 'new' })}
              >
                Сначала новые
              </button>
              <button
                className={`sort-pill ${filter.sortBy === 'price_asc' ? 'active' : ''} clickable`}
                onClick={() => onChangeFilter({ sortBy: 'price_asc' })}
              >
                Сначала дешевле
              </button>
              <button
                className={`sort-pill ${filter.sortBy === 'price_desc' ? 'active' : ''} clickable`}
                onClick={() => onChangeFilter({ sortBy: 'price_desc' })}
              >
                Сначала дороже
              </button>
            </div>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="filters-sheet-footer">
          <button className="filters-apply-btn clickable" onClick={onClose}>
            Показать {totalResultsCount} предложений
          </button>
        </div>
      </div>
    </div>
  );
};
