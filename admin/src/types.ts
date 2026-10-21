/** Товар магазина. Поля соответствуют будущей таблице в Supabase. */
export interface Product {
  code: string;
  name: string;
  purchase_price: number;
  sale_price: number;
  stock: number;
}

/** Тон статус-бейджа (палитра из исходного дизайна). */
export type StatusTone = 'pos' | 'neu' | 'neg' | 'dark';

/** Товар + данные последнего снимка (view product_latest). */
export interface ProductLatest {
  id: string;
  code: string | null;
  name: string;
  name_clean: string;
  stock: number | null;
  purchase_price: number | null;
  sale_price: number | null;
  snapshot_date: string | null;
}

/** Член дубль-группы (строка из import_duplicates). */
export interface DuplicateMember {
  name: string;
  name_clean: string;
  row_number: number;
  stock: number;
  purchase_price: number | null;
  sale_price: number | null;
}

export type DuplicateDecision = 'same' | 'different' | 'rename';

/** KPI-карточка на экране «Пульс бизнеса». */
export interface Kpi {
  value: string;
  label: string;
  change?: {
    text: string;
    up: boolean;
    good: boolean;
  };
}
