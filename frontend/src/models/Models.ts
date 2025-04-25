export interface SearchBoxProps {
  ref: React.Ref<SearchBoxRef>;
  placeholder: string;
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  onFocus?: () => void;
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

// Basic coordinate type
export interface Coordinate {
  lat: number;
  lng: number;
}

// Pharmacy related interfaces (matches serializer)
export interface Pharmacy {
  id: number;
  name: string;
  address: string;
  phone: string;       // Assuming string based on model
  district?: string;    // Optional based on model
  extra_info?: string;  // Optional based on model
  date: string;         // Assuming string date YYYY-MM-DD
  location: Coordinate; // Nested Coordinate object
  distance?: number;    // Added by nearest view
}

// WiFi Point interface (matches model/serializer fields='__all__')
export interface WiFiPoint {
  id: number;
  name: string;
  address: string;
  category: string;
  is_active: boolean;
  latitude: number;
  longitude: number;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

// Bicycle Point interface (matches model/serializer fields='__all__')
export interface BicyclePoint {
  id: number;
  name: string;
  global_id: string;
  is_active: boolean;
  latitude: number;
  longitude: number;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

// Generic Point of Interest for map markers
// Includes common fields from Pharmacy, WiFi, Bicycle
export interface PointOfInterest {
  id: number | string; // Can be number (DB id) or string (e.g., global_id)
  name: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  distance?: number;
  district?: string;
  extra_info?: string;
  category?: string;
  // Add other fields as needed
}

// Check Status Response (from pharmacy/views.py)
export interface CheckStatusResponse {
  status: 'exists' | 'fetched' | 'failed' | 'error' | 'idle' | 'checking'; // Add frontend states too
  message?: string;
}

// --- Responses needing more precise definition based on backend --- 

// Route Response (Backend A* yanıtına göre güncellendi)
// Bu yapı backend'deki DirectionsView'da oluşturulan yanıta uymalı
interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  maneuver: 'turn-right' | 'turn-left' | 'straight' | 'arrive';
}

interface Route {
  geometry: any;
  distance: number;
  durations_by_mode: {
    [mode: string]: number | null;
  };
  steps: RouteStep[];
}

export interface RouteResponse {
  routes: Route[];
  transit_info?: any; // Transit modu için (varsa)
  // waypoints?: any[]; // Gerekirse eklenebilir
  // code?: string; // Gerekirse eklenebilir
}

// Geocode Response (Assuming a list of items with position)
// This might need adjustment based on your actual geocoding API response
export interface GeocodeResponse {
  items: Array<{
    title?: string;
    address?: { label?: string };
    position?: Coordinate;
    // Include other geocoding result properties
  }>;
  // Add other top-level fields if any
}

// Google Geocoding API specific response type
export interface GoogleGeocodeResult {
  address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
  formatted_address: string;
  geometry: {
    location: Coordinate;
    // ... other geometry fields
  };
  // ... other result fields
}

export interface GoogleGeocodeResponse {
  results: GoogleGeocodeResult[];
  status: string;
  // Add other fields like error_message if needed
}

// ... (diğer interface'ler: Coordinate, Pharmacy, PointOfInterest, RouteResponse, GeocodeResponse, AddressComponent, GoogleGeocodingResponse vb.) 

export interface NavigationStep {
  instruction: string;
  distance: number;
  duration: number;
  maneuver: 'turn-right' | 'turn-left' | 'straight' | 'arrive';
  bearing?: number; // bearing'i opsiyonel yaptık
}

export interface NavigationState {
  steps: NavigationStep[];
  currentStep: number;
  remainingDistance: number;
  remainingDuration: number;
  isActive: boolean;
  isRerouting: boolean;
} 