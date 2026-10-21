export type Lang = 'ru' | 'uz' | 'en';

export interface Translations {
  langName: string;
  flag: string;
  logoSub: string;
  nav: {
    main: string;
    map: string;
    add: string;
    filters: string;
    profile: string;
  };
  map: {
    locateMe: string;
    locating: string;
    nearYou: string;
    variants: (count: number) => string;
    loading: string;
    viewDetails: string;
    details: string;
    earlyAccess: string;
    noDeposit: string;
    perMonth: string;
    allDistricts: string;
    close: string;
    ownerDirect: string;
    noCommission: string;
  };
  toolbar: {
    rent: string;
    buy: string;
    daily: string;
    commercial: string;
    all: string;
    studio: string;
    rooms1: string;
    rooms2: string;
    rooms3: string;
    ownerOnly: string;
    noDeposit: string;
    sortNew: string;
    sortPriceAsc: string;
    sortPriceDesc: string;
  };
  feed: {
    vipTitle: string;
    vipBadge: string;
    foundOffers: (count: number) => string;
    loadMore: string;
    showList: string;
    showMap: string;
  };
}

export const I18N: Record<Lang, Translations> = {
  ru: {
    langName: 'Русский',
    flag: '🇷🇺',
    logoSub: 'БЕЗ ПОСРЕДНИКОВ',
    nav: {
      main: 'Главная',
      map: 'Карта',
      add: 'Добавить',
      filters: 'Фильтры',
      profile: 'Профиль',
    },
    map: {
      locateMe: 'Где я стою',
      locating: 'Поиск...',
      nearYou: 'Вы находитесь здесь',
      variants: (c) => `📍 ${c} ${c === 1 ? 'вариант' : c < 5 ? 'варианта' : 'вариантов'}`,
      loading: 'Загрузка карты...',
      viewDetails: 'Смотреть объявление',
      details: 'Подробнее',
      earlyAccess: '🔥 Ранний доступ',
      noDeposit: 'Без залога',
      perMonth: '/ месяц',
      allDistricts: 'Все районы',
      close: 'Закрыть',
      ownerDirect: 'От собственника',
      noCommission: 'Без комиссии',
    },
    toolbar: {
      rent: 'Снять',
      buy: 'Купить',
      daily: 'Посуточно',
      commercial: 'Коммерческая',
      all: 'Все',
      studio: 'Студия',
      rooms1: '1-комн',
      rooms2: '2-комн',
      rooms3: '3+',
      ownerOnly: 'Только собственники',
      noDeposit: 'Без залога',
      sortNew: 'Сначала новые',
      sortPriceAsc: 'Сначала дешевле',
      sortPriceDesc: 'Сначала дороже',
    },
    feed: {
      vipTitle: 'Свежие предложения от хозяев',
      vipBadge: 'ТОП',
      foundOffers: (c) => `Найдено ${c} объявлений`,
      loadMore: 'Показать еще',
      showList: 'Показать списком',
      showMap: 'На карте',
    },
  },
  uz: {
    langName: 'Oʻzbekcha',
    flag: '🇺🇿',
    logoSub: 'VOSITACHILARSIZ',
    nav: {
      main: 'Asosiy',
      map: 'Xarita',
      add: 'Qoʻshish',
      filters: 'Filtrlar',
      profile: 'Profil',
    },
    map: {
      locateMe: 'Mening joyim',
      locating: 'Qidirilmoqda...',
      nearYou: 'Siz bu yerdasiz',
      variants: (c) => `📍 ${c} ta variant`,
      loading: 'Xarita yuklanmoqda...',
      viewDetails: 'Eʼlonni koʻrish',
      details: 'Batafsil',
      earlyAccess: '🔥 Erta kirish',
      noDeposit: 'Garovsiz',
      perMonth: '/ oyiga',
      allDistricts: 'Barcha tumanlar',
      close: 'Yopish',
      ownerDirect: 'Egasidan',
      noCommission: 'Komissiyasiz',
    },
    toolbar: {
      rent: 'Ijaraga',
      buy: 'Sotib olish',
      daily: 'Kunlik',
      commercial: 'Tijorat',
      all: 'Barchasi',
      studio: 'Studiya',
      rooms1: '1 xonali',
      rooms2: '2 xonali',
      rooms3: '3+',
      ownerOnly: 'Faqat egalaridan',
      noDeposit: 'Garovsiz',
      sortNew: 'Avval yangilari',
      sortPriceAsc: 'Avval arzonlari',
      sortPriceDesc: 'Avval qimmatlari',
    },
    feed: {
      vipTitle: 'Egalaridan yangi takliflar',
      vipBadge: 'TOP',
      foundOffers: (c) => `${c} ta eʼlon topildi`,
      loadMore: 'Yana koʻrsatish',
      showList: 'Roʻyxatda koʻrish',
      showMap: 'Xaritada',
    },
  },
  en: {
    langName: 'English',
    flag: '🇬🇧',
    logoSub: 'NO COMMISSIONS',
    nav: {
      main: 'Feed',
      map: 'Map',
      add: 'Post',
      filters: 'Filters',
      profile: 'Profile',
    },
    map: {
      locateMe: 'Near me',
      locating: 'Locating...',
      nearYou: 'You are here',
      variants: (c) => `📍 ${c} ${c === 1 ? 'listing' : 'listings'}`,
      loading: 'Loading map...',
      viewDetails: 'View Listing',
      details: 'Details',
      earlyAccess: '🔥 Early Access',
      noDeposit: 'No deposit',
      perMonth: '/ mo',
      allDistricts: 'All districts',
      close: 'Close',
      ownerDirect: 'Direct from owner',
      noCommission: '0% commission',
    },
    toolbar: {
      rent: 'Rent',
      buy: 'Buy',
      daily: 'Daily',
      commercial: 'Commercial',
      all: 'All',
      studio: 'Studio',
      rooms1: '1-bed',
      rooms2: '2-bed',
      rooms3: '3+',
      ownerOnly: 'Owner only',
      noDeposit: 'No deposit',
      sortNew: 'Newest first',
      sortPriceAsc: 'Lowest price',
      sortPriceDesc: 'Highest price',
    },
    feed: {
      vipTitle: 'Direct Owner Apartments',
      vipBadge: 'TOP',
      foundOffers: (c) => `Found ${c} listings`,
      loadMore: 'Load more',
      showList: 'Show as list',
      showMap: 'View on map',
    },
  },
};
