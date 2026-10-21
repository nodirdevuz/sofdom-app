import { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ShieldAlert, Ban, CheckCircle, Trash2, UserPlus, X } from 'lucide-react';

export interface UserItem {
  id: string;
  phone: string;
  name: string;
  role: string;
  plan: string;
  dailyLimit: number;
  unlockedToday: number;
  registeredAt: string;
  status: 'active' | 'trial' | 'blocked' | 'banned';
}

const STORAGE_USERS_KEY = 'sofdom_admin_users_v2';

const INITIAL_USERS: UserItem[] = [
  {
    id: 'usr_1',
    phone: '+7 (913) 850-22-11',
    name: 'Алексей Смирнов',
    role: 'Клиент',
    plan: 'Pro (24 часа)',
    dailyLimit: 30,
    unlockedToday: 8,
    registeredAt: '2026-10-21 11:20',
    status: 'active',
  },
  {
    id: 'usr_2',
    phone: '+7 (952) 801-44-33',
    name: 'Елена Кузнецова',
    role: 'Клиент',
    plan: 'Базовый',
    dailyLimit: 5,
    unlockedToday: 3,
    registeredAt: '2026-10-21 12:45',
    status: 'trial',
  },
  {
    id: 'usr_3',
    phone: '+7 (903) 955-12-34',
    name: 'Риелтор (Агентство Этажи)',
    role: 'Подозрительный',
    plan: 'Базовый',
    dailyLimit: 5,
    unlockedToday: 5,
    registeredAt: '2026-10-21 09:10',
    status: 'banned',
  },
  {
    id: 'usr_admin',
    phone: '+7 (999) 000-00-01',
    name: 'Администратор системы',
    role: 'Superadmin',
    plan: 'Безлимит',
    dailyLimit: 9999,
    unlockedToday: 162,
    registeredAt: '2026-10-20 18:00',
    status: 'active',
  },
];

export default function Users() {
  const [users, setUsers] = useState<UserItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_USERS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_USERS;
  });

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'banned'>('all');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserItem | null>(null);
  const [newLimitUser, setNewLimitUser] = useState<UserItem | null>(null);

  // Сохранение изменений в хранилище
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    } catch {}
  }, [users]);

  // Смена статуса (заблокировать на время, заблокировать навсегда, активировать)
  const handleChangeStatus = (id: string, newStatus: UserItem['status']) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: newStatus } : u))
    );
  };

  // Удаление пользователя
  const handleDeleteUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setDeleteConfirmUser(null);
  };

  // Изменение суточного лимита
  const handleSetLimit = (id: string, limit: number) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, dailyLimit: limit } : u))
    );
    setNewLimitUser(null);
  };

  const filteredUsers = users.filter((u) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return u.status === 'active' || u.status === 'trial';
    return u.status === statusFilter;
  });

  const chipClass = (active: boolean) =>
    `px-[13px] py-[6px] rounded-[9px] text-[13px] font-semibold whitespace-nowrap transition-colors border ${
      active
        ? 'bg-[#1f2937] text-white border-[#1f2937]'
        : 'bg-white text-[#56616e] border-[#e6e8eb] hover:bg-[#f7f8f9]'
    }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Пользователи и подписки"
          subtitle="Управление доступом, блокировка навсегда, лимиты номеров и черный список"
        />
        <button
          onClick={() => {
            const phone = prompt('Введите номер телефона нового клиента:');
            if (phone) {
              const newUser: UserItem = {
                id: 'usr_' + Math.random().toString(36).slice(2, 7),
                phone,
                name: 'Новый клиент',
                role: 'Клиент',
                plan: 'Базовый',
                dailyLimit: 15,
                unlockedToday: 0,
                registeredAt: 'Только что',
                status: 'active',
              };
              setUsers((prev) => [newUser, ...prev]);
            }
          }}
          className="flex items-center gap-2 px-[15px] py-2 bg-[#1f2937] hover:bg-[#111827] text-white rounded-[9px] text-[13.5px] font-semibold transition-colors shrink-0"
        >
          <UserPlus size={15} />
          <span>Добавить пользователя</span>
        </button>
      </div>

      {/* Фильтр статусов в стиле Komfort Go */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={chipClass(statusFilter === 'all')}
        >
          Все ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('active')}
          className={chipClass(statusFilter === 'active')}
        >
          Активные ({users.filter((u) => u.status === 'active' || u.status === 'trial').length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('blocked')}
          className={chipClass(statusFilter === 'blocked')}
        >
          Заблокированные ({users.filter((u) => u.status === 'blocked').length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('banned')}
          className={chipClass(statusFilter === 'banned')}
        >
          Бан навсегда ({users.filter((u) => u.status === 'banned').length})
        </button>
      </div>

      {/* Таблица пользователей — каноническая вёрстка DataTable */}
      <div className="border border-[#ecedf0] rounded-[14px] overflow-hidden bg-white">
        <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-[#f1f2f4]">
          <div className="text-[15px] font-semibold text-[#111418]">База клиентов и статус доступа</div>
          <div className="text-[12.5px] text-[#8a94a0] font-medium bg-[#f3f4f6] px-2.5 py-[3px] rounded-full">
            {filteredUsers.length} пользователей
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[760px]">
            <thead>
              <tr>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Телефон
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Имя
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Роль
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Лимит номеров
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Открыто сегодня
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Статус
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-right">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isBanned = u.status === 'banned';

                return (
                  <tr
                    key={u.id}
                    className={`border-b border-[#f1f2f4] hover:bg-[#fafbfc] transition-colors ${
                      isBanned ? 'bg-[#fafafa] opacity-60' : ''
                    }`}
                  >
                    <td className="px-5 py-[13px] font-semibold text-[#111418] text-[13.5px] tabular-nums whitespace-nowrap">
                      {u.phone}
                    </td>
                    <td className="px-5 py-[13px] text-[#1a1f25] text-[13.5px]">
                      {u.name}
                    </td>
                    <td className="px-5 py-[13px] text-[#5b6b7a] text-[13.5px]">
                      {u.role}
                    </td>
                    <td className="px-5 py-[13px] whitespace-nowrap">
                      <button
                        onClick={() => setNewLimitUser(u)}
                        className="text-[13px] font-medium text-[#111418] hover:underline"
                        title="Нажмите, чтобы изменить лимит"
                      >
                        {u.dailyLimit === 9999 ? 'Безлимит' : `${u.dailyLimit} в сутки`} ✎
                      </button>
                    </td>
                    <td className="px-5 py-[13px] text-[#111418] font-semibold text-[13.5px] tabular-nums">
                      {u.unlockedToday}
                    </td>
                    <td className="px-5 py-[13px] whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[12px] font-semibold ${
                          u.status === 'active'
                            ? 'bg-[#1f2937] text-white'
                            : u.status === 'trial'
                            ? 'bg-[#eef0f2] text-[#5a6675]'
                            : u.status === 'blocked'
                            ? 'bg-[#e5e7eb] text-[#374151]'
                            : 'bg-[#111418] text-white'
                        }`}
                      >
                        {u.status === 'active'
                          ? 'Активен'
                          : u.status === 'trial'
                          ? 'Пробный'
                          : u.status === 'blocked'
                          ? 'Заблокирован'
                          : 'Бан навсегда'}
                      </span>
                    </td>
                    <td className="px-5 py-[13px] text-right whitespace-nowrap relative">
                      <div className="flex items-center justify-end gap-1.5">
                        {u.status !== 'active' && (
                          <button
                            onClick={() => handleChangeStatus(u.id, 'active')}
                            title="Разблокировать"
                            className="p-1.5 text-[#5b6b7a] hover:text-[#111418] hover:bg-[#f2f3f5] rounded-[7px] transition-colors"
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                        {u.status === 'active' && (
                          <button
                            onClick={() => handleChangeStatus(u.id, 'blocked')}
                            title="Заблокировать на 24 часа"
                            className="p-1.5 text-[#5b6b7a] hover:text-[#111418] hover:bg-[#f2f3f5] rounded-[7px] transition-colors"
                          >
                            <ShieldAlert size={15} />
                          </button>
                        )}
                        {!isBanned && (
                          <button
                            onClick={() => handleChangeStatus(u.id, 'banned')}
                            title="Заблокировать навсегда (Бан)"
                            className="p-1.5 text-[#5b6b7a] hover:text-[#111418] hover:bg-[#f2f3f5] rounded-[7px] transition-colors"
                          >
                            <Ban size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirmUser(u)}
                          title="Удалить пользователя"
                          className="p-1.5 text-[#8a94a0] hover:text-[#c8332b] hover:bg-[#fbeae8] rounded-[7px] transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальное окно подтверждения удаления (по образцу Komfort Go) */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-[14px] border border-[#ecedf0] p-6 max-w-sm w-full space-y-4 shadow-lg">
            <div className="flex items-start justify-between">
              <h3 className="text-[16px] font-bold text-[#111418]">Удалить пользователя?</h3>
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="text-[#8a94a0] hover:text-[#111418]"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-[13.5px] text-[#5b6b7a]">
              Вы действительно хотите удалить пользователя <b className="text-[#111418]">{deleteConfirmUser.phone}</b>? Доступ и история контактов будут стёрты насовсем.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 border border-[#e6e8eb] text-[#56616e] hover:bg-[#f7f8f9] rounded-[9px] text-[13px] font-semibold"
              >
                Отмена
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirmUser.id)}
                className="px-4 py-2 bg-[#1f2937] hover:bg-[#111827] text-white rounded-[9px] text-[13px] font-semibold"
              >
                Удалить насовсем
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно изменения лимитов */}
      {newLimitUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-[14px] border border-[#ecedf0] p-6 max-w-xs w-full space-y-4 shadow-lg">
            <div className="flex items-start justify-between">
              <h3 className="text-[15px] font-bold text-[#111418]">Суточный лимит номеров</h3>
              <button
                onClick={() => setNewLimitUser(null)}
                className="text-[#8a94a0] hover:text-[#111418]"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-[12.5px] text-[#7a8593]">
              Выберите количество телефонов, которое клиент {newLimitUser.phone} может открыть за 24 часа:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[5, 15, 30, 9999].map((lim) => (
                <button
                  key={lim}
                  onClick={() => handleSetLimit(newLimitUser.id, lim)}
                  className={`py-2 px-3 border rounded-[9px] text-[13px] font-semibold transition-colors ${
                    newLimitUser.dailyLimit === lim
                      ? 'bg-[#1f2937] text-white border-[#1f2937]'
                      : 'bg-white text-[#56616e] border-[#e6e8eb] hover:bg-[#f7f8f9]'
                  }`}
                >
                  {lim === 9999 ? 'Безлимит' : `${lim} контактов`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
