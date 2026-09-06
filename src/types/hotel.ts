export interface HotelOffer {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
}

export interface HotelResult {
  name: string;
  price: number;
  supplier: string;
  commissionPct: number;
}

export interface AggregatedHotelResult {
  name: string;
  price: number;
  supplier: string;
  commissionPct: number;
  originalId: string;
  city: string;
}

export interface HotelWorkflowInput {
  city: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface HotelWorkflowResult {
  hotels: HotelResult[];
}
