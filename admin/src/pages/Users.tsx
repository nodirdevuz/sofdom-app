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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Пользователи и Подписки"
          subtitle="Учет клиентов, суточных лимитов открытия телефонов и тарифов"
        />
        <button
          onClick={() => alert('Форма добавления пользователя готова к подключению SMS шлюза.')}
          className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-semibold text-sm rounded-xl shadow-sm transition-colors"
        >
          + Создать пользователя
        </button>
      </div>

      <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#e2e8f0] text-[11px] uppercase tracking-wider text-[#64748b] font-bold">
                <th className="px-5 py-3.5">Телефон</th>
                <th className="px-5 py-3.5">Имя</th>
                <th className="px-5 py-3.5">Роль</th>
                <th className="px-5 py-3.5">Тарифный план</th>
                <th className="px-5 py-3.5">Суточный лимит</th>
                <th className="px-5 py-3.5">Открыто сегодня</th>
                <th className="px-5 py-3.5">Статус</th>
                <th className="px-5 py-3.5">Регистрация</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-5 py-3.5 font-bold text-[#0f172a] whitespace-nowrap">
                    {u.phone}
                  </td>
                  <td className="px-5 py-3.5 text-[#334155]">{u.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#f1f5f9] text-[#475569]">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-[#059669] whitespace-nowrap">
                    {u.plan}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-[#334155]">
                    {u.dailyLimit} тел/день
                  </td>
                  <td className="px-5 py-3.5 font-bold text-[#3b82f6]">
                    {u.unlockedToday} шт.
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        u.status === 'active'
                          ? 'bg-[#dcfce7] text-[#166534]'
                          : u.status === 'trial'
                          ? 'bg-[#f1f5f9] text-[#475569]'
                          : 'bg-[#fee2e2] text-[#991b1b]'
                      }`}
                    >
                      {u.status === 'active' ? 'Активен' : u.status === 'trial' ? 'Пробный' : 'Истек'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#94a3b8] whitespace-nowrap">
                    {u.registeredAt}
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
