import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import './MapComponent.css';
import SearchBox, { SearchBoxRef } from './SearchBox';
import sourceMarkerIcon from '../assets/source-marker.svg';
import destinationMarkerIcon from '../assets/destination-marker.svg';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom icons for source and destination
const sourceIcon = new L.Icon({
  iconUrl: sourceMarkerIcon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
  shadowSize: [41, 41]
});

const destinationIcon = new L.Icon({
  iconUrl: destinationMarkerIcon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
  shadowSize: [41, 41]
});

// Ankara coordinates and bounds
const ANKARA_CENTER: L.LatLngTuple = [39.9334, 32.8597];
const ANKARA_BOUNDS: L.LatLngBoundsLiteral = [
  [39.7, 32.5], // Southwest coordinates
  [40.1, 33.2]  // Northeast coordinates
];

interface Marker {
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

const MapComponent: React.FC = () => {
  const [map, setMap] = useState<L.Map | null>(null);
  const [source, setSource] = useState<Marker | null>(null);
  const [destination, setDestination] = useState<Marker | null>(null);
  const [routeLayer, setRouteLayer] = useState<L.Layer | null>(null);
  const [sourceMarker, setSourceMarker] = useState<L.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<L.Marker | null>(null);
  
  const sourceSearchRef = useRef<SearchBoxRef>(null);
  const destinationSearchRef = useRef<SearchBoxRef>(null);

  useEffect(() => {
    const mapInstance = L.map('map', {
      center: ANKARA_CENTER,
      zoom: 12,
      maxBounds: ANKARA_BOUNDS,
      minZoom: 11,
      maxZoom: 18,
      zoomControl: false
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance);

    // Set max bounds with some padding
    mapInstance.setMaxBounds(ANKARA_BOUNDS);

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, []);

  /*const clearMarkers = () => {
    if (!map) return;
    if (sourceMarker) map.removeLayer(sourceMarker);
    if (destinationMarker) map.removeLayer(destinationMarker);
    setSourceMarker(null);
    setDestinationMarker(null);
  };*/

  const findNearestAddress = async (lat: number, lng: number): Promise<string> => {
    const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    
    try {
      if (!API_KEY) {
        throw new Error('Google Maps API key is missing. Set REACT_APP_GOOGLE_MAPS_API_KEY in your .env file.');
      }
  
      const response = await axios.get<GeocodeResponse>('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${lat},${lng}`,
          key: API_KEY
        }
      });
  
      const data = response.data;
      console.log(data);
      
      if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
        console.warn('No address found for the given coordinates or response structure is invalid.');
        return '';
      }
  
      const result = data.results[0];
      const addressComponents = result.address_components;
  
      // Extract street number and street name
      const streetNumber = addressComponents.find((comp) => comp.types.includes('street_number'))?.long_name;
      const streetName = addressComponents.find((comp) => comp.types.includes('route'))?.long_name;
  
      if (streetName && streetNumber) {
        return `${streetName} ${streetNumber}`;
      }
  
      // Fallback to full formatted address
      return result.formatted_address || '';
    } catch (error) {
      console.error('Error finding nearest address:', error);
      return '';
    }
  };
  

  const addMarker = async (lat: number, lng: number, isSource: boolean) => {
    if (!map) return;

    const marker = L.marker([lat, lng], {
      icon: isSource ? sourceIcon : destinationIcon
    }).addTo(map);

    if (isSource) {
      if (sourceMarker) map.removeLayer(sourceMarker);
      setSourceMarker(marker);
      setSource({ lat, lng });
      
      // Find and set the nearest address
      const address = await findNearestAddress(lat, lng);
      if (sourceSearchRef.current) {
        sourceSearchRef.current.setQuery(address);
      }
    } else {
      if (destinationMarker) map.removeLayer(destinationMarker);
      setDestinationMarker(marker);
      setDestination({ lat, lng });
      
      // Find and set the nearest address
      const address = await findNearestAddress(lat, lng);
      if (destinationSearchRef.current) {
        destinationSearchRef.current.setQuery(address);
      }
    }
  };

  const handleMapClick = async (e: L.LeafletMouseEvent) => {
    const clickLatLng = e.latlng;
    const bounds = L.latLngBounds(ANKARA_BOUNDS);
    
    if (!bounds.contains(clickLatLng)) {
      alert('Please select a location within Ankara city limits');
      return;
    }

    // Left click for source, right click for destination
    const isSource = e.originalEvent.button === 0;
    await addMarker(clickLatLng.lat, clickLatLng.lng, isSource);
  };

  const handleContextMenu = (e: L.LeafletMouseEvent) => {
    e.originalEvent.preventDefault();
    handleMapClick(e);
  };

  useEffect(() => {
    if (!map) return;
    
    map.on('click', handleMapClick);
    map.on('contextmenu', handleContextMenu);
    
    return () => {
      map.off('click', handleMapClick);
      map.off('contextmenu', handleContextMenu);
    };
  });

  useEffect(() => {
    if (source && destination) {
      getRoute(source, destination);
    }
  });

  const getRoute = async (start: Marker, end: Marker) => {
    try {
      console.log(process.env.REACT_APP_BACKEND_API_URL);
      const response = await axios.post<RouteResponse>(`${process.env.REACT_APP_BACKEND_API_URL}/api/route/`, {
        start,
        end
      });
      
      
      if (routeLayer && map) {
        map.removeLayer(routeLayer);
      }
      const route = response.data.routes[0].geometry;
      const newRouteLayer = L.geoJSON(route).addTo(map!);
      setRouteLayer(newRouteLayer);

      // Fit the map to show the entire route, but respect the max bounds
      const bounds = L.geoJSON(route).getBounds();
      map?.fitBounds(bounds.intersects(ANKARA_BOUNDS) ? bounds : ANKARA_BOUNDS, { 
        padding: [50, 50],
        maxZoom: 16
      });

    } catch (error) {
      console.error('Error getting route:', error);
    }
  };

  return (
    <div className="map-container">
      <div className="search-container">
        <SearchBox
          ref={sourceSearchRef}
          placeholder="Enter start location"
          onLocationSelect={(lat, lng) => addMarker(lat, lng, true)}
        />
        <SearchBox
          ref={destinationSearchRef}
          placeholder="Enter destination"
          onLocationSelect={(lat, lng) => addMarker(lat, lng, false)}
        />
      </div>
      <div id="map" style={{ height: '500px', width: '100%' }} />
    </div>
  );
};

export default MapComponent; 