export interface Coordinate {
  lat: number;
  lng: number;
}

// Pharmacy related interfaces
export interface PharmacyLocation {
  lat: number;
  lng: number;
}

export interface Pharmacy {
  id: number;
  name: string;
  address: string;
  phone: string;
  date: string;
  distance?: number;
  district?: string;
  extra_info?: string;
  location: PharmacyLocation;
}

// Points of Interest
export interface PointOfInterest {
  id: number;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  distance?: number;
  district?: string;
  extra_info?: string;
}

// API Response types
export interface ApiResponse<T = Pharmacy[]> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
  config: any;
  request?: any;
}

// WiFi Point
export interface WiFiPoint {
  id: number;
  name: string;
  address: string;
  category: string;
  is_active: boolean;
  latitude: number;
  longitude: number;
  created_at: string;  // ISO datetime string
  updated_at: string;  // ISO datetime string
}

// Bicycle Point
export interface BicyclePoint {
  id: number;
  name: string;
  global_id: string;
  is_active: boolean;
  latitude: number;
  longitude: number;
  created_at: string;  // ISO datetime string
  updated_at: string;  // ISO datetime string
}

// Routing and Geocoding
export interface RouteResponse {
  routes: Array<{
    geometry: GeoJSON.Geometry;
  }>;
  traffic_info?: any;
  transit_info?: any;
}

export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GeocodeResult {
  address_components: AddressComponent[];
  formatted_address: string;
  geometry?: {
    location: Location;
  };
}

export interface GeocodeResponse {
  status: string;
  results: GeocodeResult[];
}

export interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

export interface GoogleGeocodingResponse {
  results: {
    address_components: AddressComponent[];
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }[];
  status: string;
}

export interface SearchBoxProps {
  ref: React.Ref<SearchBoxRef>;
  placeholder: string;
  onLocationSelect: (lat: number, lng: number) => void;
  children?: React.ReactNode;
}

export interface SearchBoxRef {
  setQuery: (query: string) => void;
}