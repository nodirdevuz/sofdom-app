import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../auth';
import { useHaptic } from '../lib/useHaptic';
import { formatDecimal, formatInt } from '../lib/format';
import { useMyAttendance, useMyProfile, useMyPurchases, useMySalary } from '../data/useCabinet';
import { Skeleton } from '../components/Skeleton';

// Кабинет — часть Telegram-бота: язык интерфейса — узбекская латиница,
// как на экране входа (Login.tsx), без словаря админки (там кириллица).

type Tab = 'attendance' | 'salary' | 'purchases';

const soms = (n: number) => `${formatInt(n)} so'm`;

const MONTHS_UZ = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];
// getDay(): 0 = воскресенье.
const WEEKDAYS_UZ = ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Shan'];

/** Опоздание в человеческом виде: 105 → «1 soat 45 daq», 45 → «45 daq».
 * В базе минуты — только формат показа. */
function lateLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} daq`;
  return m > 0 ? `${h} soat ${m} daq` : `${h} soat`;
}

/** «06.07 · Du» — компактная дата для карточки дня. */
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm} · ${WEEKDAYS_UZ[d.getDay()]}`;
}

const chip = (active: boolean) =>
  `px-[12px] py-[7px] rounded-[9px] text-[13px] font-semibold border ${
    active ? 'bg-[#1f2937] text-white border-[#1f2937]' : 'bg-white text-[#56616e] border-[#e6e8eb]'
  }`;

const card = 'rounded-[14px] border border-[#ecedf0] bg-white px-4 py-3';

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
      Yuklashda xatolik: {message}
    </div>
  );
}

function EmptyBox() {
  return (
    <div className="rounded-[14px] border border-[#ecedf0] bg-white px-5 py-10 text-center text-sm text-[#8a94a0]">
      Bu oyda yozuvlar yo'q
    </div>
  );
}

/** Личный кабинет сотрудника (бот Komfort Team): только просмотр своих данных. */
export default function EmployeeCabinet({ token }: { token: string }) {
  const { logout } = useAuth();
  const h = useHaptic();
  const [tab, setTab] = useState<Tab>('attendance');

  // Текущий месяц: табель/зарплата/покупки за него.
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthLabel = `${MONTHS_UZ[now.getMonth()]} ${now.getFullYear()}`;

  const profile = useMyProfile(token);
  const attendance = useMyAttendance(token, month);
  const salary = useMySalary(token, month);
  const purchases = useMyPurchases(token, month);

  // Профиль вернул null → сессия истекла/отозвана → на экран входа.
  useEffect(() => {
    if (profile.isSuccess && profile.data === null) void logout();
  }, [profile.isSuccess, profile.data, logout]);

  const p = profile.data;

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      {/* Шапка: профиль. pt с учётом fullscreen-инсетов Telegram (ставит telegram.ts). */}
      <div className="bg-[#1f2937] px-5 pb-5 pt-[calc(var(--safe-top,0px)+20px)] text-white">
        <div className="flex items-start justify-between gap-3">
          {p ? (
            <div>
              <div className="text-[18px] font-bold leading-snug">{p.name}</div>
              <div className="mt-1 text-[13px] text-white/60">
                {[p.jobTitle, p.phone].filter(Boolean).join(' · ') || '—'}
              </div>
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                  p.isActive ? 'bg-[#e7f5ec] text-[#1b7a3d]' : 'bg-white/15 text-white/70'
                }`}
              >
                {p.isActive ? 'Faol' : "Ishdan bo'shagan"}
              </span>
            </div>
          ) : (
            <div className="flex-1">
              <Skeleton className="h-6 w-48 bg-white/20" />
              <Skeleton className="mt-2 h-4 w-32 bg-white/10" />
            </div>
          )}
          <button
            type="button"
            aria-label="Chiqish"
            onClick={() => {
              h.medium();
              void logout();
            }}
            className="flex items-center gap-1.5 rounded-[9px] bg-white/10 px-3 py-2 text-[13px] font-semibold text-white/85 hover:bg-white/15"
          >
            <LogOut size={15} strokeWidth={2} />
            Chiqish
          </button>
        </div>
      </div>

      {/* Вкладки + месяц */}
      <div className="flex items-center gap-2 px-4 pt-4">
        <button type="button" className={chip(tab === 'attendance')} onClick={() => { h.light(); setTab('attendance'); }}>
          Tabel
        </button>
        <button type="button" className={chip(tab === 'salary')} onClick={() => { h.light(); setTab('salary'); }}>
          Maosh
        </button>
        <button type="button" className={chip(tab === 'purchases')} onClick={() => { h.light(); setTab('purchases'); }}>
          Xaridlar
        </button>
        <span className="ml-auto text-[13px] text-[#8a94a0]">{monthLabel}</span>
      </div>

      <div className="flex flex-col gap-2.5 px-4 py-4 pb-[calc(var(--safe-bottom,0px)+20px)]">
        {profile.error && <ErrorBox message={(profile.error as Error).message} />}

        {/* ── Мой табель ── */}
        {tab === 'attendance' && (
          attendance.error ? <ErrorBox message={(attendance.error as Error).message} />
          : !attendance.data ? <Skeleton className="h-[300px]" />
          : attendance.data.length === 0 ? <EmptyBox />
          : attendance.data.map((r) => (
              <div key={r.date} className={card}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#56616e]">{dayLabel(r.date)}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {r.onSite && (
                      <span className="rounded-full bg-[#e8f0fb] px-2.5 py-0.5 text-[12px] font-semibold text-[#1d5bbf]">
                        Ishda
                      </span>
                    )}
                    {r.lateMinutes > 0 ? (
                      <span className="rounded-full bg-[#fbeae8] px-2.5 py-0.5 text-[12px] font-semibold text-[#c8332b]">
                        Kechikdi: {lateLabel(r.lateMinutes)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#e7f5ec] px-2.5 py-0.5 text-[12px] font-semibold text-[#1b7a3d]">
                        O'z vaqtida
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-[#1a1f25]">
                  <span>Keldi: <b>{r.cameAt ?? '—'}</b></span>
                  <span>Ketdi: <b>{r.leftAt ?? (r.onSite ? 'ishda' : '—')}</b></span>
                  {r.fine > 0 && <span className="font-semibold text-[#c8332b]">Jarima: {soms(r.fine)}</span>}
                </div>
                {/* Отлучки: готовые строки RPC («10:45–12:16, 1 соат 30 дақиқа»). */}
                {r.breaks.length > 0 && (
                  <div className="mt-2 border-t border-[#f1f2f4] pt-2 text-[12.5px] text-[#8a94a0]">
                    <div className="font-semibold">Tanaffuslar:</div>
                    {r.breaks.map((b, i) => (
                      <div key={`${b.from}-${i}`} className="tabular-nums">{b.text}</div>
                    ))}
                  </div>
                )}
              </div>
            ))
        )}

        {/* ── Моя зарплата ── */}
        {tab === 'salary' && (
          salary.error ? <ErrorBox message={(salary.error as Error).message} />
          : !salary.data ? <Skeleton className="h-[300px]" />
          : salary.data.days.length === 0 ? <EmptyBox />
          : (() => {
            const s = salary.data;
            // День = ставка − опоздание − отлучки − штраф 1С (см. RPC get_my_salary).
            const lateMinTotal = s.days.reduce((acc, d) => acc + d.lateMinutes, 0);
            const lateDedTotal = s.days.reduce((acc, d) => acc + d.lateDeduction, 0);
            const breakMinTotal = s.days.reduce((acc, d) => acc + d.breakMinutes, 0);
            const breakDedTotal = s.days.reduce((acc, d) => acc + d.breakDeduction, 0);
            const fineTotal = Math.max(0, s.totalDeducted - lateDedTotal - breakDedTotal);
            return (
            <>
              {/* Итог месяца */}
              <div className={`${card} py-4`}>
                <div className="flex flex-col gap-1.5 text-[14px]">
                  <div className="flex justify-between">
                    <span className="text-[#56616e]">Ishlangan</span>
                    <b>{soms(s.totalEarned + s.totalDeducted)}</b>
                  </div>
                  <div className="flex justify-between">
                    {/* Вычет за опоздание: минуты × ставка/час (расчёт не менялся, честное имя). */}
                    <span className="text-[#56616e]">Kechikish uchun</span>
                    <b className={lateDedTotal > 0 ? 'text-[#c8332b]' : ''}>
                      {lateMinTotal > 0 ? `${lateLabel(lateMinTotal)} · ` : ''}
                      −{soms(lateDedTotal)}
                    </b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#56616e]">Tanaffuslar uchun</span>
                    <b className={breakDedTotal > 0 ? 'text-[#c8332b]' : ''}>
                      {breakMinTotal > 0 ? `${lateLabel(breakMinTotal)} · ` : ''}
                      −{soms(breakDedTotal)}
                    </b>
                  </div>
                  {fineTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#56616e]">Jarima</span>
                      <b className="text-[#c8332b]">−{soms(fineTotal)}</b>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#56616e]">Xaridlar (hisobdan)</span>
                    <b className={s.purchasesTotal > 0 ? 'text-[#c8332b]' : ''}>
                      −{soms(s.purchasesTotal)}
                    </b>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between border-t border-[#f1f2f4] pt-2.5">
                    <span className="font-semibold">Qo'lga tegadi</span>
                    <span className="text-[17px] font-bold">{soms(s.payable)}</span>
                  </div>
                </div>
              </div>
              {/* По дням: ставка − вычеты (каждый отдельно) = заработок дня. */}
              {s.days.map((d) => {
                const fine = Math.max(0, d.deduction - d.lateDeduction - d.breakDeduction);
                return (
                  <div key={d.date} className={card}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[#56616e]">{dayLabel(d.date)}</div>
                        <div className="mt-0.5 text-[12.5px] text-[#8a94a0]">
                          Stavka: {soms(d.rate)}
                          {d.lateMinutes > 0 && d.lateDeduction === 0 && ` · kechikdi ${lateLabel(d.lateMinutes)}`}
                        </div>
                        {d.lateDeduction > 0 && (
                          <div className="text-[12.5px] font-semibold text-[#c8332b]">
                            Kechikish ({lateLabel(d.lateMinutes)}): −{soms(d.lateDeduction)}
                          </div>
                        )}
                        {d.breakDeduction > 0 && (
                          <div className="text-[12.5px] font-semibold text-[#c8332b]">
                            Tanaffus ({d.breakText}): −{soms(d.breakDeduction)}
                          </div>
                        )}
                        {fine > 0 && (
                          <div className="text-[12.5px] font-semibold text-[#c8332b]">
                            Jarima: −{soms(fine)}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[15px] font-bold">{soms(d.earned)}</div>
                        {d.deduction > 0 && (
                          <div className="text-[12.5px] font-semibold text-[#c8332b]">−{soms(d.deduction)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
            );
          })()
        )}

        {/* ── Мои покупки ── */}
        {tab === 'purchases' && (
          purchases.error ? <ErrorBox message={(purchases.error as Error).message} />
          : !purchases.data ? <Skeleton className="h-[300px]" />
          : purchases.data.rows.length === 0 ? <EmptyBox />
          : (
            <>
              <div className={`${card} flex items-center justify-between py-4`}>
                <span className="text-[14px] text-[#56616e]">Jami xaridlar</span>
                <span className="text-[17px] font-bold">{soms(purchases.data.totalAmount)}</span>
              </div>
              {purchases.data.rows.map((r, i) => (
                <div key={`${r.date}-${i}`} className={`${card} flex items-center justify-between gap-3`}>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] text-[#1a1f25]">{r.productName}</div>
                    <div className="mt-0.5 text-[12.5px] text-[#8a94a0]">
                      {dayLabel(r.date)} · ×{formatDecimal(r.qty)}
                    </div>
                  </div>
                  <div className="shrink-0 text-[14px] font-semibold">{soms(r.amount)}</div>
                </div>
              ))}
            </>
          )
        )}
      </div>
    </div>
  );
}
