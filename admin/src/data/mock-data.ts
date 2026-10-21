import type { Kpi, Product } from '../types';

/**
 * Моковые товары. Временные данные — позже заменяются запросом к Supabase
 * через хук `useProducts`. Структура строго по модели `Product`.
 */
export const mockProducts: Product[] = [
  { code: '1001', name: 'Молоко «Простоквашино» 2,5%', purchase_price: 52, sale_price: 72, stock: 320 },
  { code: '1002', name: 'Хлеб «Бородинский»', purchase_price: 18, sale_price: 35, stock: 45 },
  { code: '1003', name: 'Куриное филе охл.', purchase_price: 180, sale_price: 240, stock: 88 },
  { code: '1004', name: 'Яйца С1, 10 шт', purchase_price: 62, sale_price: 90, stock: 210 },
  { code: '1005', name: 'Бананы', purchase_price: 48, sale_price: 69, stock: 12 },
  { code: '1006', name: 'Сметана 20%', purchase_price: 58, sale_price: 89, stock: 64 },
  { code: '1007', name: 'Гречка «Мистраль»', purchase_price: 70, sale_price: 95, stock: 410 },
  { code: '1008', name: 'Шпроты «Рижские»', purchase_price: 110, sale_price: 150, stock: 0 },
];

/** Моковые KPI для экрана «Обзор». */
export const overviewKpis: Kpi[] = [
  { value: '4 280 000 сум', label: 'Выручка за месяц', change: { text: '8,2%', up: true, good: true } },
  { value: '742 сум', label: 'Средний чек', change: { text: '3,1%', up: true, good: true } },
  { value: '1 248', label: 'Активных товаров', change: { text: '1,4%', up: true, good: true } },
  { value: '86', label: 'Мёртвый сток (товаров)', change: { text: '12%', up: true, good: false } },
];
