import React from 'react';
import { LayoutMode } from '../types';

interface ToolbarProps {
  count: number;
  layoutMode: LayoutMode;
  onSetLayoutMode: (mode: LayoutMode) => void;
  sortBy: string;
  onSetSortBy: (sort: any) => void;
  isMapVisible: boolean;
  onToggleMap: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  count,
  layoutMode,
  onSetLayoutMode,
  sortBy,
  onSetSortBy,
  isMapVisible,
  onToggleMap
}) => {
  return (
    <div className="toolbar-row">
      <div className="toolbar-left">
        <span className="offers-count-text">Найдено {count} предложений</span>
        <div className="view-switcher-pills desktop-only-content">
          <button
            className={`view-btn ${layoutMode === 'list' ? 'active' : ''} clickable`}
            onClick={() => onSetLayoutMode('list')}
            title="Список"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <button
            className={`view-btn ${layoutMode === 'grid' ? 'active' : ''} clickable`}
            onClick={() => onSetLayoutMode('grid')}
            title="Сетка"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="toolbar-right">
        {/* Desktop only map button */}
        <button
          className={`btn-toggle-map ${isMapVisible ? 'active' : ''} clickable`}
          onClick={onToggleMap}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          <span>Смотреть на карте</span>
        </button>

        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => onSetSortBy(e.target.value)}
        >
          <option value="new">Новые ⌵</option>
          <option value="price_asc">Дешевле ⌵</option>
          <option value="price_desc">Дороже ⌵</option>
        </select>
      </div>
    </div>
  );
};
