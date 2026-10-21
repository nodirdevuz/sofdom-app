import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';

interface UserItem {
  id: string;
  phone: string;
  name: string;
  role: string;
  plan: string;
  dailyLimit: number;
  unlockedToday: number;
  registeredAt: string;
  status: 'active' | 'trial' | 'expired';
}

export default function Users() {
  const [users] = useState<UserItem[]>([
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
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Пользователи и подписки"
          subtitle="Учет клиентов, суточных лимитов открытия телефонов и тарифов"
        />
        <button
          onClick={() => alert('Форма добавления пользователя')}
          className="flex items-center gap-2 px-[15px] py-2 bg-[#1f2937] hover:bg-[#111827] text-white rounded-[9px] text-[13.5px] font-semibold transition-colors shrink-0"
        >
          <span>+</span> Добавить пользователя
        </button>
      </div>

      <div className="border border-[#ecedf0] rounded-[14px] overflow-hidden bg-white">
        <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-[#f1f2f4]">
          <div className="text-[15px] font-semibold text-[#111418]">Зарегистрированные клиенты</div>
          <div className="text-[12.5px] text-[#8a94a0] font-medium bg-[#f3f4f6] px-2.5 py-[3px] rounded-full">
            {users.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
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
                  Тариф
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Лимит
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Открыто
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Статус
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[#f1f2f4] hover:bg-[#fafbfc] transition-colors"
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
                  <td className="px-5 py-[13px] text-[#111418] font-medium text-[13.5px]">
                    {u.plan}
                  </td>
                  <td className="px-5 py-[13px] text-[#5b6b7a] text-[13.5px] tabular-nums">
                    {u.dailyLimit === 9999 ? 'Безлимит' : `${u.dailyLimit} контактов`}
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
                          : 'bg-[#f3f4f6] text-[#8a94a0]'
                      }`}
                    >
                      {u.status === 'active' ? 'Активен' : u.status === 'trial' ? 'Пробный' : 'Истек'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
