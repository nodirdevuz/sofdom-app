import { useState } from 'react';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('+7 (999) 000-00-01');
  const [password, setPassword] = useState('admin');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(phone, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-3xl p-8 shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#059669] text-white flex items-center justify-center font-extrabold text-xl shadow-sm shadow-emerald-500/20">
            S
          </div>
          <div>
            <div className="font-extrabold text-lg text-[#0f172a]">SofDom Admin</div>
            <div className="text-xs text-[#94a3b8]">Вход в панель управления базой</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1.5">
              Номер телефона администратора
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-sm font-medium outline-none focus:border-[#10b981]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1.5">
              Пароль доступа
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-sm font-medium outline-none focus:border-[#10b981]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#10b981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all mt-2"
          >
            Войти в панель управления
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-[#94a3b8]">
          SofDom Недвижимость Томск • Защищенный доступ
        </div>
      </div>
    </div>
  );
}
