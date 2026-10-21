import React, { useState, useMemo } from 'react';
import { Offer } from '../../types';

interface AdminDashboardProps {
  offers: Offer[];
  onClose: () => void;
  onOpenDetail?: (id: string) => void;
}

type AdminTab = 'overview' | 'offers' | 'users' | 'caching';

interface UserRecord {
  id: string;
  phone: string;
  name: string;
  role: string;
  subscriptionPlan: string;
  dailyLimit: number;
  unlockedCount: number;
  createdAt: string;
  status: 'active' | 'trial' | 'expired';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ offers, onClose, onOpenDetail }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'avito' | 'cian' | 'bezposrednikov'>('all');
  const [isAuthenticated, setIsAuthenticated] = useState(true); // Demo mode is enabled by default
  const [phoneInput, setPhoneInput] = useState('');

  // Sample initial users matching realty.db schema
  const [users] = useState<UserRecord[]>([
    {
      id: 'usr_1',
      phone: '+7 (913) 850-22-11',
      name: 'Алексей Смирнов',
      role: 'Клиент',
      subscriptionPlan: 'Pro (24 часа)',
      dailyLimit: 30,
      unlockedCount: 8,
      createdAt: '2026-10-21 11:20',
      status: 'active'
    },
    {
      id: 'usr_2',
      phone: '+7 (952) 801-44-33',
      name: 'Елена Кузнецова',
      role: 'Клиент',
      subscriptionPlan: 'Базовый',
      dailyLimit: 5,
      unlockedCount: 3,
      createdAt: '2026-10-21 12:45',
      status: 'trial'
    },
    {
      id: 'usr_admin',
      phone: '+7 (999) 000-00-01',
      name: 'Владелец / Администратор',
      role: 'Superadmin',
      subscriptionPlan: 'Безлимит',
      dailyLimit: 9999,
      unlockedCount: 162,
      createdAt: '2026-10-20 18:00',
      status: 'active'
    }
  ]);

  const getSource = (o: Offer): string => {
    if (o.source) return o.source.toLowerCase();
    if (o.id.startsWith('avito')) return 'avito';
    if (o.id.startsWith('cian')) return 'cian';
    return 'bezposrednikov';
  };

  // Source Stats
  const sourceStats = useMemo(() => {
    const counts = { avito: 0, cian: 0, bezposrednikov: 0 };
    offers.forEach((o) => {
      const src = getSource(o);
      if (src.includes('avito')) counts.avito++;
      else if (src.includes('cian')) counts.cian++;
      else counts.bezposrednikov++;
    });
    return counts;
  }, [offers]);

  // District Stats
  const districtStats = useMemo(() => {
    const map: Record<string, number> = {};
    offers.forEach((o) => {
      const d = o.metro_name || 'Советский';
      map[d] = (map[d] || 0) + 1;
    });
    return map;
  }, [offers]);

  // Filtered offers
  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      const src = getSource(o);
      const matchesSource =
        sourceFilter === 'all' ||
        (sourceFilter === 'avito' && src.includes('avito')) ||
        (sourceFilter === 'cian' && src.includes('cian')) ||
        (sourceFilter === 'bezposrednikov' && src.includes('bezposr'));

      const q = searchQuery.toLowerCase();
      const matchesQuery =
        !q ||
        o.title.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q) ||
        (o.phone && o.phone.includes(q));

      return matchesSource && matchesQuery;
    });
  }, [offers, sourceFilter, searchQuery]);

  const handleClearCache = async () => {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
      alert('Кэш браузера и сохраненные фотографии очищены. Страница будет перезагружена.');
      window.location.reload();
    } else {
      alert('Service Worker Cache API не поддерживается в этом браузере.');
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-panel-container">
        {/* Top Header */}
        <header className="admin-header">
          <div className="admin-header-left">
            <button className="admin-back-btn" onClick={onClose} title="Вернуться к витрине">
              ← На сайт
            </button>
            <div className="admin-logo-badge">
              <span className="admin-brand">SofDom</span>
              <span className="admin-chip">Панель управления</span>
            </div>
          </div>
          <div className="admin-header-right">
            <span className="admin-user-pill">👤 Администратор (+7 999 000-00-01)</span>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="admin-nav-tabs">
          <button
            className={`admin-nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Обзор и Метрики
          </button>
          <button
            className={`admin-nav-tab ${activeTab === 'offers' ? 'active' : ''}`}
            onClick={() => setActiveTab('offers')}
          >
            🏠 Объявления ({offers.length})
          </button>
          <button
            className={`admin-nav-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Пользователи и Подписки ({users.length})
          </button>
          <button
            className={`admin-nav-tab ${activeTab === 'caching' ? 'active' : ''}`}
            onClick={() => setActiveTab('caching')}
          >
            ⚡ Парсеры и Кэширование
          </button>
        </nav>

        {/* Content Area */}
        <div className="admin-content-scroll">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="admin-tab-pane">
              {/* KPI Cards Grid */}
              <div className="admin-kpi-grid">
                <div className="admin-kpi-card">
                  <div className="kpi-label">Всего квартир в базе</div>
                  <div className="kpi-value text-emerald">{offers.length}</div>
                  <div className="kpi-sub">Томск • 100% с телефонами</div>
                </div>
                <div className="admin-kpi-card">
                  <div className="kpi-label">Авито: Ранний доступ (6ч)</div>
                  <div className="kpi-value text-amber">12</div>
                  <div className="kpi-sub">До выхода в публичный поиск</div>
                </div>
                <div className="admin-kpi-card">
                  <div className="kpi-label">Пользователей в системе</div>
                  <div className="kpi-value text-blue">{users.length}</div>
                  <div className="kpi-sub">Готовность к SMS-авторизации</div>
                </div>
                <div className="admin-kpi-card">
                  <div className="kpi-label">Открытий контактов за сутки</div>
                  <div className="kpi-value text-purple">48</div>
                  <div className="kpi-sub">Прямые звонки собственникам</div>
                </div>
              </div>

              {/* Breakdown Cards */}
              <div className="admin-sections-split">
                {/* Sources breakdown */}
                <div className="admin-box">
                  <h3 className="admin-box-title">Распределение по источникам</h3>
                  <div className="stat-bars">
                    <div className="stat-bar-row">
                      <span className="stat-name">Авито Недвижимость</span>
                      <span className="stat-val">{sourceStats.avito} ({Math.round((sourceStats.avito / offers.length) * 100)}%)</span>
                    </div>
                    <div className="stat-progress-bg">
                      <div className="stat-progress-fill" style={{ width: `${(sourceStats.avito / offers.length) * 100}%`, background: '#10b981' }} />
                    </div>

                    <div className="stat-bar-row mt-3">
                      <span className="stat-name">ЦИАН (Собственники)</span>
                      <span className="stat-val">{sourceStats.cian} ({Math.round((sourceStats.cian / offers.length) * 100)}%)</span>
                    </div>
                    <div className="stat-progress-bg">
                      <div className="stat-progress-fill" style={{ width: `${(sourceStats.cian / offers.length) * 100}%`, background: '#3b82f6' }} />
                    </div>

                    <div className="stat-bar-row mt-3">
                      <span className="stat-name">БезПосредников.ру</span>
                      <span className="stat-val">{sourceStats.bezposrednikov} ({Math.round((sourceStats.bezposrednikov / offers.length) * 100)}%)</span>
                    </div>
                    <div className="stat-progress-bg">
                      <div className="stat-progress-fill" style={{ width: `${(sourceStats.bezposrednikov / offers.length) * 100}%`, background: '#f59e0b' }} />
                    </div>
                  </div>
                </div>

                {/* Districts breakdown */}
                <div className="admin-box">
                  <h3 className="admin-box-title">Квартиры по районам Томска</h3>
                  <div className="stat-bars">
                    {Object.entries(districtStats).map(([name, count]) => (
                      <div key={name} className="mb-2">
                        <div className="stat-bar-row">
                          <span className="stat-name">{name}</span>
                          <span className="stat-val">{count} кв.</span>
                        </div>
                        <div className="stat-progress-bg">
                          <div
                            className="stat-progress-fill"
                            style={{
                              width: `${(count / offers.length) * 100}%`,
                              background: '#6366f1'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OFFERS TABLE */}
          {activeTab === 'offers' && (
            <div className="admin-tab-pane">
              {/* Toolbar */}
              <div className="admin-table-toolbar">
                <input
                  type="text"
                  className="admin-search-input"
                  placeholder="Поиск по адресу, названию или номеру телефона..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="admin-filter-chips">
                  <button
                    className={`chip ${sourceFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSourceFilter('all')}
                  >
                    Все ({offers.length})
                  </button>
                  <button
                    className={`chip ${sourceFilter === 'avito' ? 'active' : ''}`}
                    onClick={() => setSourceFilter('avito')}
                  >
                    Авито ({sourceStats.avito})
                  </button>
                  <button
                    className={`chip ${sourceFilter === 'cian' ? 'active' : ''}`}
                    onClick={() => setSourceFilter('cian')}
                  >
                    ЦИАН ({sourceStats.cian})
                  </button>
                  <button
                    className={`chip ${sourceFilter === 'bezposrednikov' ? 'active' : ''}`}
                    onClick={() => setSourceFilter('bezposrednikov')}
                  >
                    БезПосредников ({sourceStats.bezposrednikov})
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Источник</th>
                      <th>Квартира</th>
                      <th>Район / Адрес</th>
                      <th>Цена</th>
                      <th>Телефон</th>
                      <th>Фото</th>
                      <th>Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOffers.slice(0, 50).map((o) => {
                      const src = getSource(o);
                      return (
                      <tr key={o.id}>
                        <td>
                          <span className={`source-badge ${src.includes('avito') ? 'avito' : src.includes('cian') ? 'cian' : 'bezposr'}`}>
                            {src.includes('avito') ? 'Авито' : src.includes('cian') ? 'ЦИАН' : 'БезПосред'}
                          </span>
                        </td>
                        <td>
                          <div className="font-semibold">{o.title}</div>
                          <div className="text-xs text-muted">ID: {o.id}</div>
                        </td>
                        <td>
                          <div>{o.address}</div>
                          <div className="text-xs text-muted">{o.metro_name || 'Советский'}</div>
                        </td>
                        <td className="font-bold whitespace-nowrap">{o.price_val ? o.price_val.toLocaleString('ru-RU') : o.price_display} ₽</td>
                        <td>
                          <a href={`tel:${o.phone}`} className="admin-phone-link">
                            📞 {o.phone || 'Нет номера'}
                          </a>
                        </td>
                        <td>
                          <span className="text-xs">📷 {o.photos?.length || 1} шт.</span>
                        </td>
                        <td>
                          <button
                            className="admin-action-btn"
                            onClick={() => {
                              onClose();
                              if (onOpenDetail) onOpenDetail(o.id);
                            }}
                          >
                            Открыть
                          </button>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-muted mt-2 text-center">
                Показано {Math.min(50, filteredOffers.length)} из {filteredOffers.length} объявлений
              </div>
            </div>
          )}

          {/* TAB 3: USERS AND SUBSCRIPTIONS */}
          {activeTab === 'users' && (
            <div className="admin-tab-pane">
              <div className="admin-box">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="admin-box-title">Зарегистрированные пользователи и подписки</h3>
                  <button className="admin-btn-primary" onClick={() => alert('Форма регистрации готова к подключению SMS Gateway.')}>
                    + Добавить пользователя
                  </button>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Телефон</th>
                        <th>Имя</th>
                        <th>Роль</th>
                        <th>Тарифный план</th>
                        <th>Лимит в сутки</th>
                        <th>Открыто</th>
                        <th>Статус</th>
                        <th>Регистрация</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="font-semibold">{u.phone}</td>
                          <td>{u.name}</td>
                          <td>
                            <span className="badge-role">{u.role}</span>
                          </td>
                          <td className="font-medium text-emerald">{u.subscriptionPlan}</td>
                          <td>{u.dailyLimit} тел/день</td>
                          <td>{u.unlockedCount} шт.</td>
                          <td>
                            <span className={`status-pill ${u.status === 'active' ? 'pos' : u.status === 'trial' ? 'neu' : 'neg'}`}>
                              {u.status === 'active' ? 'Активен' : u.status === 'trial' ? 'Пробный' : 'Истек'}
                            </span>
                          </td>
                          <td className="text-xs text-muted">{u.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PARSERS & CACHING */}
          {activeTab === 'caching' && (
            <div className="admin-tab-pane">
              <div className="admin-kpi-grid">
                <div className="admin-kpi-card">
                  <div className="kpi-label">PWA Service Worker Кэш</div>
                  <div className="kpi-value text-emerald">АКТИВЕН</div>
                  <div className="kpi-sub">Версия: sofdom-cache-v2</div>
                </div>
                <div className="admin-kpi-card">
                  <div className="kpi-label">Кэширование фотографий</div>
                  <div className="kpi-value text-emerald">ВКЛЮЧЕНО</div>
                  <div className="kpi-sub">CacheFirst: Авито, ЦИАН, БезПоср.</div>
                </div>
                <div className="admin-kpi-card">
                  <div className="kpi-label">Режим отдачи данных</div>
                  <div className="kpi-value text-blue">0 ms</div>
                  <div className="kpi-sub">Мгновенный показ из кэша памяти</div>
                </div>
              </div>

              <div className="admin-box mt-4">
                <h3 className="admin-box-title">Управление кэшем устройства</h3>
                <p className="text-sm text-muted mb-4">
                  При включенном кэшировании все фотографии и данные сохраняются на телефоне пользователя. Страницы открываются моментально даже при медленном 3G или нестабильном соединении.
                </p>
                <div className="flex gap-3">
                  <button className="admin-btn-danger" onClick={handleClearCache}>
                    🗑 Очистить кэш картинок и перезагрузить
                  </button>
                  <button
                    className="admin-btn-secondary"
                    onClick={() => {
                      if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.getRegistrations().then((regs) => {
                          for (const r of regs) r.update();
                        });
                        alert('Service Worker проверил и обновил кэш в фоне.');
                      }
                    }}
                  >
                    🔄 Проверить обновления Service Worker
                  </button>
                </div>
              </div>

              <div className="admin-box mt-4">
                <h3 className="admin-box-title">Статус фоновых сборщиков (Томск)</h3>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Парсер</th>
                        <th>Интервал</th>
                        <th>Специфика</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="font-semibold">Авито (Ранний доступ)</td>
                        <td>Каждые 30 сек</td>
                        <td>Перехват лотов до индексации (6ч)</td>
                        <td><span className="status-pill pos">Работает</span></td>
                      </tr>
                      <tr>
                        <td className="font-semibold">ЦИАН (Собственники)</td>
                        <td>Каждые 2 мин</td>
                        <td>Фильтр is_by_homeowner=1</td>
                        <td><span className="status-pill pos">Работает</span></td>
                      </tr>
                      <tr>
                        <td className="font-semibold">БезПосредников.ру</td>
                        <td>Каждые 3 мин</td>
                        <td>Томский каталог + сессии</td>
                        <td><span className="status-pill pos">Работает</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
