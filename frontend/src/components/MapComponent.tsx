import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import './MapComponent.css';
import {
  Coordinate, Pharmacy, PointOfInterest, RouteResponse, GeocodeResponse, SearchBoxRef
} from '../models/Models';
import SearchBox from './SearchBox';
import sourceMarkerIcon from '../assets/source-marker.svg';
import destinationMarkerIcon from '../assets/destination-marker.svg';
import pharmacyIconUrl from '../assets/eczane.svg'
import bicycleIconUrl from '../assets/bicycle.png'
import wifiIconUrl from '../assets/wifi.png'
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

// Custom icons for points of interest
const pharmacyIcon = new L.Icon({
  iconUrl: pharmacyIconUrl,
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [1, -34]
});

const bicycleIcon = new L.Icon({
  iconUrl: bicycleIconUrl,
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [1, -34]
});

const wifiIcon = new L.Icon({
  iconUrl: wifiIconUrl,
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [1, -34]
});

// Ankara coordinates and bounds
const ANKARA_CENTER: L.LatLngTuple = [39.9334, 32.8597];
const ANKARA_BOUNDS: L.LatLngBoundsLiteral = [
  [39.7, 32.5], // Southwest coordinates
  [40.1, 33.2]  // Northeast coordinates
];


const MapComponent: React.FC = () => {
  const [map, setMap] = useState<L.Map | null>(null);
  const [source, setSource] = useState<Coordinate | null>(null);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [routeLayer, setRouteLayer] = useState<L.Layer | null>(null);
  const [sourceMarker, setSourceMarker] = useState<L.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<L.Marker | null>(null);
  const [poiMarkers, setPoiMarkers] = useState<L.Marker[]>([]);

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

  const clearPoiMarkers = () => {
    if (!map) return;
    poiMarkers.forEach(marker => map.removeLayer(marker));
    setPoiMarkers([]);
  };

  const findNearestAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await axios.get<GeocodeResponse>('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${lat},${lng}`,
          key: localStorage.getItem('googleApiKey')
        }
      });

      const data = response.data;
      console.log(data);

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

  const addPoiMarkers = (points: PointOfInterest[], icon: L.Icon, titleKey: keyof PointOfInterest = 'name') => {
    if (!map) return;

    clearPoiMarkers(); // Clear any existing POI markers

    const newMarkers = points.map(point => {
      // Safely get the title
      let title: string;

      // Check if the titleKey exists and is a string
      if (titleKey in point && typeof point[titleKey] === 'string') {
        title = point[titleKey] as string;
      } else {
        title = point.name || 'Location';
      }

      const marker = L.marker([point.lat, point.lng], {
        icon: icon,
        title: title
      });

      // Create popup content based on available properties
      let popupContent = `<div><strong>${point.name || 'Location'}</strong>`;

      if (point.address) popupContent += `<p>${point.address}</p>`;
      if (point.phone) popupContent += `<p>Phone: ${point.phone}</p>`;
      if (point.distance) popupContent += `<p>Distance: ${point.distance.toFixed(2)} km</p>`;

      popupContent += `</div>`;

      marker.bindPopup(popupContent);
      marker.addTo(map);
      return marker;
    });

    setPoiMarkers(newMarkers);

    // Fit bounds to show all POIs if there are any
    if (points.length > 0) {
      const group = new L.FeatureGroup(newMarkers);
      map.fitBounds(group.getBounds().pad(0.1), {
        maxZoom: 16
      });
    }
  };

  const [isToastError, setIsToastError] = useState(false);

  const fetchPharmacies = async () => {
    try {
      if (!source) {
        setIsToastError(true); // Trigger error UI
        toast.error('Please select a location first');
        setTimeout(() => setIsToastError(false), 1000);
        return;
      }
      if (!map) {
        return
      }


      const response = await axios.get<Pharmacy[]>(
        `${process.env.REACT_APP_BACKEND_API_URL}/api/pharmacies/nearest?lat=${source?.lat}&lng=${source?.lng}&date=2025-03-20`
      );

      // Process the data with proper type safety
      const pharmacies: PointOfInterest[] = response.data
        .filter((pharmacy): pharmacy is Pharmacy =>
          pharmacy.location &&
          typeof pharmacy.location.lat === 'number' &&
          typeof pharmacy.location.lng === 'number'
        )
        .map(pharmacy => ({
          id: pharmacy.id,
          name: pharmacy.name,
          address: pharmacy.address,
          phone: pharmacy.phone,
          lat: pharmacy.location.lat,
          lng: pharmacy.location.lng,
          ...(pharmacy.distance && { distance: pharmacy.distance }),
          ...(pharmacy.district && { district: pharmacy.district }),
          ...(pharmacy.extra_info && { extra_info: pharmacy.extra_info })
        }));

      console.log('Processed pharmacies:', pharmacies);
      if (destinationMarker) {
        console.log("dest marker deleted");
        setDestinationMarker(null);
        setDestination(null);
        map.removeLayer(destinationMarker)
      }
      if (pharmacies.length === 0) {
        console.warn('No valid pharmacies found');
        return;
      }
      const closestPharmacy = pharmacies[0];
      setDestination({
        lat: closestPharmacy.lat,
        lng: closestPharmacy.lng
      });
      if (destinationSearchRef.current && closestPharmacy.address) {
        destinationSearchRef.current.setQuery(closestPharmacy.address);
      }
      if (source && closestPharmacy) {
        await getRoute(
          { lat: source.lat, lng: source.lng },
          { lat: closestPharmacy.lat, lng: closestPharmacy.lng }
        );
      }

      addPoiMarkers(pharmacies, pharmacyIcon, 'name');
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
    }
  };
  const askForLocation = async () => {
    try {
      if (!map) return;

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      const userLocation: Coordinate = { lat: latitude, lng: longitude };

      // Check if the location is within Ankara bounds
      const ankaraBounds = L.latLngBounds(ANKARA_BOUNDS);
      if (ankaraBounds.contains([latitude, longitude])) {
        await addMarker(latitude, longitude, true);
        map.flyTo([latitude, longitude], 15);
      } else {
        toast.info('Your location is outside Ankara. Please select a location within the city.');
      }
    } catch (error) {
      console.log('Location permission denied or error:', error);
      toast.error('Could not access your location. Please allow location access or select manually.');
    }
  };
  useEffect(() => {

    // Check if geolocation is available
    if ("geolocation" in navigator) {
      askForLocation();
    }
  }, [map]); // Only run when map is initialized
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

  // Initialize refs with proper types
  const prevRouteLayerRef = useRef<L.GeoJSON | null>(null); // Track previous route layer
  const prevSourceRef = useRef<Coordinate | null>(null);
  const prevDestRef = useRef<Coordinate | null>(null);
  /*
  useEffect(() => {
    if (!source || !destination || !map) return;
  
    const sourceChanged = !prevSourceRef.current || 
                        source.lat !== prevSourceRef.current.lat || 
                        source.lng !== prevSourceRef.current.lng;
                      
    const destChanged = !prevDestRef.current || 
                      destination.lat !== prevDestRef.current.lat || 
                      destination.lng !== prevDestRef.current.lng;
  
    if (sourceChanged || destChanged) {
      // Clear previous route before fetching new one
      if (prevRouteLayerRef.current) {
        map.removeLayer(prevRouteLayerRef.current);
        prevRouteLayerRef.current = null;
      }
  
      getRoute(source, destination);
      prevSourceRef.current = source;
      prevDestRef.current = destination;
    }
  }, [source, destination, map]);
  */
  useEffect(() => {
    if (!source || !destination || !map) return;


    // Clear previous route before fetching new one
    if (prevRouteLayerRef.current) {
      map.removeLayer(prevRouteLayerRef.current);
      prevRouteLayerRef.current = null;
    }
    prevSourceRef.current = source;
    prevDestRef.current = destination;

  }, [source, destination, map]);
  const getRoute = async (start: Coordinate, end: Coordinate) => {
    try {
      if (!source) {
        setIsToastError(true); // Trigger error UI
        toast.error('Please select a source first');
        setTimeout(() => setIsToastError(false), 1000);
        return;
      }
      if (!end) {
        setIsToastError(true); // Trigger error UI
        toast.error('Please select a destination first');
        setTimeout(() => setIsToastError(false), 1000);
        return;
      }
      const response = await axios.post<RouteResponse>(
        `${process.env.REACT_APP_BACKEND_API_URL}/api/directions/route/`,
        { start, end }
      );

      // Clear any existing route (defensive programming)
      if (prevRouteLayerRef.current) {
        map?.removeLayer(prevRouteLayerRef.current);
      }

      const route = response.data.routes[0].geometry;
      const newRouteLayer = L.geoJSON(route, {
        style: { color: '#4285F4', weight: 5 }
      }).addTo(map!);

      // Update the ref with the new layer
      prevRouteLayerRef.current = newRouteLayer;

      // Handle bounds
      const bounds = newRouteLayer.getBounds();
      map?.fitBounds(bounds.intersects(ANKARA_BOUNDS) ? bounds : ANKARA_BOUNDS, {
        padding: [50, 50],
        maxZoom: 16
      });

    } catch (error) {
      console.error('Error getting route:', error);
      // Consider adding user feedback here
    }
  };

  return (
    <div className="map-container">
      <div className="search-container">
        <div className="search-box-with-button">
          <SearchBox
            ref={sourceSearchRef}
            placeholder="Enter start location"
            onLocationSelect={(lat, lng) => addMarker(lat, lng, true)}
          >
            <button
              onClick={askForLocation}
              className="location-button"
              title="Use my current location"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
              </svg>
            </button>
          </SearchBox>
        </div>
        <SearchBox
          ref={destinationSearchRef}
          placeholder="Enter destination"
          onLocationSelect={(lat, lng) => addMarker(lat, lng, false)}
        />
                <div className="point-of-interest-buttons">
          <button 
            onClick={() => getRoute(source!, destination!)} 
            className="route-button"
          >
            Get Directions
          </button>
        </div>
        <div className="point-of-interest-buttons">
          <button onClick={fetchPharmacies} className="poi-button">
            Show Duty Pharmacies
          </button>
        </div>

      </div>
      <div id="map" style={{ height: '500px', width: '100%' }} />
    </div>
  );
};

export default MapComponent;