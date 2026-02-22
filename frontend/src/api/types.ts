export interface Group {
  id: string;
  name: string | null;
  description: string | null;
  created_at: string | null;
}

export interface Member {
  id: string;
  group_id: string | null;
  name: string;
  city: string | null;
  phone: string | null;
  status: string | null;
}

export interface Festival {
  id: string;
  group_id: string | null;
  name: string;
  location: string | null;
  dates_start: string | null;
  dates_end: string | null;
  ticket_price: number | null;
  on_sale_date: string | null;
  status: string | null;
  artists?: Artist[];
}

export interface Artist {
  id: string;
  festival_id: string | null;
  name: string;
  priority: string | null;
}

export interface FestivalCatalogEntry {
  id: string;
  name: string;
  location: string | null;
  dates_start: string | null;
  dates_end: string | null;
  ticket_price: number | null;
  on_sale_date: string | null;
  latitude: number | null;
  longitude: number | null;
}
