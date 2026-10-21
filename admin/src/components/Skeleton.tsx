/** Плейсхолдер-заглушка на время загрузки (пульсация в тон карточек админки). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[10px] bg-[#ecedf0] ${className}`} />;
}
