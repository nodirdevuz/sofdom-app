/**
 * Общая копилка ошибок загрузки — чтобы ни одна не потерялась молча.
 *
 * ЗАЧЕМ. 15.09.2026 экран «Сотрудники» висел на «Yuklanmoqda…» бесконечно.
 * Разбор показал, что дело шире одного экрана: восемь страниц админки не
 * показывают ошибку ВООБЩЕ, а четырнадцать рисуют скелетон по условию
 * `isLoading || !data` — то есть и при провале запроса, когда данных нет.
 * Человек видел вечную загрузку и не мог понять, сломалось ли что-то.
 *
 * Здесь ошибки со ВСЕХ запросов собираются в одно место, а показывает их одна
 * полоса поверх любой страницы. Правка каждой страницы по отдельности нужна
 * тоже, но она долгая; эта копилка закрывает все экраны разом и сразу.
 */
export interface QueryFailure {
  message: string;
  at: number;
}

type Listener = (f: QueryFailure | null) => void;

let current: QueryFailure | null = null;
const listeners = new Set<Listener>();

export function reportQueryFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (!message) return;
  current = { message, at: Date.now() };
  listeners.forEach((l) => l(current));
}

export function clearQueryFailure(): void {
  current = null;
  listeners.forEach((l) => l(null));
}

export function getQueryFailure(): QueryFailure | null {
  return current;
}

export function subscribeQueryFailure(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
