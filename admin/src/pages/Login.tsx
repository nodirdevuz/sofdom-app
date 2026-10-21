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
    <div className="min-h-screen flex items-center justify-center bg-[#fbfbfc] px-4 font-sans text-[#1a1f25]">
      <div className="w-full max-w-[380px] bg-white border border-[#ecedf0] rounded-[14px] p-7 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-[40px] h-[40px] rounded-[10px] bg-[#1f2937] text-white flex items-center justify-center font-bold text-[19px] shrink-0">
            S
          </div>
          <div>
            <div className="font-bold text-[15px] text-[#111418]">SofDom Admin</div>
            <div className="text-[12.5px] text-[#8a94a0]">Вход в систему управления</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11.5px] font-semibold text-[#7a8593] uppercase tracking-[0.04em] mb-1.5">
              Телефон администратора
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 border border-[#e6e8eb] rounded-[9px] text-[13.5px] bg-white text-[#1a1f25] outline-none focus:border-[#1f2937] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-[#7a8593] uppercase tracking-[0.04em] mb-1.5">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2 border border-[#e6e8eb] rounded-[9px] text-[13.5px] bg-white text-[#1a1f25] outline-none focus:border-[#1f2937] transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-[#1f2937] hover:bg-[#111827] text-white font-semibold text-[13.5px] rounded-[9px] transition-colors mt-2"
          >
            Войти в систему
          </button>
        </form>

        <div className="mt-6 text-center text-[12px] text-[#8a94a0]">
          SofDom • Недвижимость Томск
        </div>
      </div>
    </div>
  );
}
