export interface SearchBoxProps {
  placeholder: string;
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  children?: React.ReactNode;
}

export interface SearchBoxRef {
  setQuery: (query: string) => void;
}

// SettingsPage'den taşınan FavoriteLocation interface'i
export interface FavoriteLocation {
  id: number;
  user?: number | string; // Kullanıcı ID'si veya username (serializer'a göre)
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  tag?: string | null;
  created_at?: string; // Opsiyonel
  updated_at?: string; // Opsiyonel
}

// ... (diğer interface'ler: Coordinate, Pharmacy, PointOfInterest, RouteResponse, GeocodeResponse, AddressComponent, GoogleGeocodingResponse vb.) 