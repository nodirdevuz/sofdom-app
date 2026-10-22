export interface Offer {
  id: string;
  source?: string;
  external_ref?: string;
  title: string;
  raw_title?: string;
  price_display: string;
  price_unit: string;
  price_val: number;
  deal_type?: 'Длительная аренда' | 'Посуточная' | string;
  rooms: string | number;
  area: number | string;
  living_area?: number | string;
  kitchen_area?: number | string;
  floor?: number | string;
  total_floors?: number | string;
  floor_str: string;
  ceiling?: string;
  bathroom?: string;
  renovation: string;
  building_type?: string;
  build_year?: number;
  parking?: string;
  deposit: string;
  address: string;
  district?: string;
  metro_name: string;
  metro_line?: string;
  metro_walk?: string;
  amenities?: string[];
  desc_short: string;
  full_desc?: string;
  photos: string[];
  photos_count: number;
  owner_name?: string;
  phone: string;
  is_owner: boolean;
  is_new?: boolean;
  is_top?: boolean;
  time_ago: string;
  status?: 'active' | 'rented' | 'archived';
  lat: number;
  lng: number;
}

export interface VipOffer {
  id: string;
  title: string;
  price: string;
  metro: string;
  photo: string;
  offer_ref?: string;
  source_ref?: string;
}

export interface FilterState {
  dealType: 'all' | 'Длительная аренда' | 'Посуточная';
  rooms: string | null;
  selectedRooms?: string[];
  ownerOnly: boolean;
  noDeposit: boolean;
  sortBy: 'new' | 'price_asc' | 'price_desc';
}

export type LayoutMode = 'list' | 'grid';
