import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearQueryFailure,
  getQueryFailure,
  reportQueryFailure,
  subscribeQueryFailure,
} from './queryErrors';

/**
 * Копилка ошибок загрузки.
 *
 * ЗАЧЕМ. 15.09.2026 «Сотрудники» висели на «Yuklanmoqda…» вечно: сервер отвечал
 * 200 и отдавал 31 строку, а экран молчал. Разбор показал, что восемь страниц
 * админки не показывают ошибку вообще. Эта копилка — то место, из которого
 * полоса поверх страницы берёт текст; если она потеряет ошибку, человек снова
 * останется наедине с вечной загрузкой.
 */
describe('копилка ошибок загрузки', () => {
  beforeEach(() => clearQueryFailure());

  it('запоминает текст ошибки', () => {
    reportQueryFailure(new Error('Сервер не ответил за 10 с'));
    expect(getQueryFailure()?.message).toBe('Сервер не ответил за 10 с');
  });

  it('будит подписчика — иначе полоса не появится', () => {
    const seen: (string | null)[] = [];
    const off = subscribeQueryFailure((f) => seen.push(f ? f.message : null));
    reportQueryFailure(new Error('нет связи'));
    clearQueryFailure();
    off();
    expect(seen).toEqual(['нет связи', null]);
  });

  it('пустую ошибку не показывает — пустая полоса хуже её отсутствия', () => {
    reportQueryFailure(new Error(''));
    expect(getQueryFailure()).toBeNull();
    reportQueryFailure(null);
    expect(getQueryFailure()).toBeNull();
  });

  it('не падает на том, что не Error', () => {
    reportQueryFailure('строкой');
    expect(getQueryFailure()?.message).toBe('строкой');
  });

  it('отписка работает: ушли с экрана — больше не будим', () => {
    const seen: unknown[] = [];
    const off = subscribeQueryFailure((f) => seen.push(f));
    off();
    reportQueryFailure(new Error('после отписки'));
    expect(seen).toHaveLength(0);
  });
});
