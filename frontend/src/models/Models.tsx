interface Location {
    lat: number;
    lng: number;
  }
  
  interface Pharmacy {
    id: number;
    name: string;
    address: string;
    phone: string;
    date: string;
    distance?: number;  // Made optional
    district?: string;  // Made optional
    extra_info?: string; // Made optional
    location: {
      lat: number;
      lng: number;
    };
  }
  
  interface PointOfInterest {
    id: number;
    name: string;
    address: string;
    phone: string;
    lat: number;
    lng: number;
    distance?: number;  // Made optional to match Pharmacy
    district?: string;  // Made optional
    extra_info?: string; // Made optional
  }
  
  interface ApiResponse {
    data: Pharmacy[];
    status: number;
    statusText: string;
    headers: any;
    config: any;
    request?: any;
  }
  
  interface WiFiPoint {
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
  
  interface BicyclePoint {
    id: number;
    name: string;
    global_id: string;
    is_active: boolean;
    latitude: number;
    longitude: number;
    created_at: string;  // ISO datetime string
    updated_at: string;  // ISO datetime string
  }
  
  
  interface Coordinate {
    lat: number;
    lng: number;
  }
  
  interface RouteResponse {
    routes: Array<{
      geometry: GeoJSON.Geometry;
    }>;
  }
  
  interface AddressComponent {
    long_name: string;
    types: string[];
  }
  
  interface GeocodeResult {
    address_components: AddressComponent[];
    formatted_address: string;
  }
  
  interface GeocodeResponse {
    status: string;
    results: GeocodeResult[];
  }