import React from 'react';
import { FilterState } from '../types';
import { Lang, I18N } from '../lib/i18n';

interface TabsAndChipsProps {
  filter: FilterState;
  onChangeFilter: (newFilter: Partial<FilterState>) => void;
  lang?: Lang;
}

export const TabsAndChips: React.FC<TabsAndChipsProps> = ({
  filter,
  onChangeFilter,
  lang = 'ru',
}) => {
  const currentRooms: string[] = filter.selectedRooms || (filter.rooms ? filter.rooms.split(',').map((s) => s.trim()) : []);

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

  const isRoomActive = (roomCode: string) => currentRooms.includes(roomCode);

  const t = I18N[lang] || I18N.ru;

  return (
    <>
      <div className="tabs-wrapper">
        <div className="segmented-tabs">
          <button
            className={`tab-item ${!filter.dealType || filter.dealType === 'all' ? 'active' : ''} clickable`}
            onClick={() => onChangeFilter({ dealType: 'all' as any })}
          >
            {t.toolbar.all}
          </button>
          <button
            className={`tab-item ${filter.dealType === 'Длительная аренда' ? 'active' : ''} clickable`}
            onClick={() => onChangeFilter({ dealType: 'Длительная аренда' })}
          >
            {t.toolbar.rent}
          </button>
          <button
            className={`tab-item ${filter.dealType === 'Посуточная' ? 'active' : ''} clickable`}
            onClick={() => onChangeFilter({ dealType: 'Посуточная' })}
          >
            {t.toolbar.daily}
          </button>
        </div>
      </div>

      <div className="quick-chips-wrapper">
        <button
          className={`chip-item ${filter.ownerOnly ? 'active' : ''} clickable`}
          onClick={() => onChangeFilter({ ownerOnly: !filter.ownerOnly })}
        >
          {filter.ownerOnly ? '✓ ' : ''}{t.toolbar.ownerOnly}
        </button>
        <button
          className={`chip-item ${isRoomActive('0') ? 'active' : ''} clickable`}
          onClick={() => toggleRoom('0')}
        >
          {isRoomActive('0') ? '✓ ' : ''}{t.toolbar.studio}
        </button>
        <button
          className={`chip-item ${isRoomActive('1') ? 'active' : ''} clickable`}
          onClick={() => toggleRoom('1')}
        >
          {isRoomActive('1') ? '✓ ' : ''}{t.toolbar.rooms1}
        </button>
        <button
          className={`chip-item ${isRoomActive('2') ? 'active' : ''} clickable`}
          onClick={() => toggleRoom('2')}
        >
          {isRoomActive('2') ? '✓ ' : ''}{t.toolbar.rooms2}
        </button>
        <button
          className={`chip-item ${isRoomActive('3+') ? 'active' : ''} clickable`}
          onClick={() => toggleRoom('3+')}
        >
          {isRoomActive('3+') ? '✓ ' : ''}{t.toolbar.rooms3}
        </button>
        <button
          className={`chip-item ${filter.noDeposit ? 'active' : ''} clickable`}
          onClick={() => onChangeFilter({ noDeposit: !filter.noDeposit })}
        >
          {filter.noDeposit ? '✓ ' : ''}{t.toolbar.noDeposit}
        </button>
      </div>
    </>
  );
};
