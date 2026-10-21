/**
 * SofDom Admin Navigation Configuration
 */

export const OVERVIEW_PATH = '/overview';
export const LISTINGS_PATH = '/listings';
export const ANALYTICS_PATH = '/analytics';
export const USERS_PATH = '/users';
export const SCRAPERS_PATH = '/scrapers';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  badge?: string;
}

export const navItems: NavItem[] = [
  {
    id: 'overview',
    label: 'Пульс базы и метрики',
    path: OVERVIEW_PATH,
    icon: 'grid',
  },
  {
    id: 'listings',
    label: 'Объявления Томска',
    path: LISTINGS_PATH,
    icon: 'home',
    badge: '162',
  },
  {
    id: 'analytics',
    label: 'Аналитика и датчики',
    path: ANALYTICS_PATH,
    icon: 'activity',
    badge: 'Live',
  },
  {
    id: 'users',
    label: 'Пользователи и подписки',
    path: USERS_PATH,
    icon: 'users',
  },
  {
    id: 'scrapers',
    label: 'Сборщики и Модерация',
    path: SCRAPERS_PATH,
    icon: 'cpu',
  },
];
