/// <reference types="react" />
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import './MapComponent.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-compass/dist/leaflet-compass.min.css';
import 'leaflet-compass';
import { toast } from 'sonner';
import {
  Coordinate,
  Pharmacy,       // Now defined and exported
  WiFiPoint,      // Now defined and exported
  BicyclePoint,   // Now defined and exported
  PointOfInterest, // Now defined and exported
  RouteResponse,   // Now defined and exported
  GeocodeResponse, // Now defined and exported
  CheckStatusResponse, // Now defined and exported
  SearchBoxRef,
  SearchBoxProps,
  GoogleGeocodeResponse // For direct Google API call
} from "../models/Models"; // Use .ts extension implicitly
import SearchBox from './SearchBox';
import MapStylesControl from './MapStylesControl';
import TransportModeSelector from './TransportModeSelector';
import TransitInfoPanel from './TransitInfoPanel';
import sourceMarkerIcon from '../assets/source-marker.svg';
import destinationMarkerIcon from '../assets/destination-marker.svg';
import pharmacyIconUrl from '../assets/eczane.svg';
import bicycleIconUrl from '../assets/bicycle.png';
import wifiIconUrl from '../assets/wifi.png';
import taxiIconUrl from '../assets/taxi.svg';
import HamburgerMenu from './HamburgerMenu';
import markerIcon from 'leaflet/dist/images/marker-icon.png';  // Import image for iconUrl
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';  // Import image for iconRetinaUrl
import markerShadow from 'leaflet/dist/images/marker-shadow.png';  // Import image for shadowUrl
import SaveFavoriteModal from './SaveFavoriteModal';
import LeftSideMenu from './LeftSideMenu';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRoute, faLocationArrow } from '@fortawesome/free-solid-svg-icons';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIconRetina,  // Use imported image URL for Retina display
  iconUrl: markerIcon,  // Use imported image URL for default icon
  shadowUrl: markerShadow,  // Use imported image URL for shadow
});

// Custom icons for source and destination
const sourceIcon = new L.Icon({
  iconUrl: sourceMarkerIcon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: markerShadow, 
  shadowSize: [41, 41]
});

const destinationIcon = new L.Icon({
  iconUrl: destinationMarkerIcon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: markerShadow, 
  shadowSize: [41, 41]
});

// Custom icons for points of interest
const pharmacyIcon = new L.Icon({
  iconUrl: pharmacyIconUrl,
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [1, -34]
});

const taxiIcon = new L.DivIcon({
  className: 'custom-taxi-icon',
  html: '<div style="background-color: yellow; color: black; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-weight: bold; border: 1px solid black;">T</div>',
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

// Navigasyon için yeni tipler
interface NavigationStep {
  instruction: string;
  distance: number;
  duration: number;
  maneuver: string;
  bearing: number; // Make sure bearing is defined in the interface
}

interface NavigationState {
  isActive: boolean;
  currentStep: number;
  steps: NavigationStep[];
  remainingDistance: number;
  remainingDuration: number;
  isRerouting: boolean;
  lastRecalculationTime: number; // Add timestamp of last recalculation
  routePolyline: L.LatLng[] | null; // Add the route polyline points
  userDistanceOnRoute: number; // Track user's progress along the route
  lastUserPosition: Coordinate | null; // Track last known position
}

// Yeni Prop Arayüzü
interface MapComponentProps {
  isLoggedIn: boolean;
  onLogout: () => void;
}

const MapComponent: React.FC<MapComponentProps> = ({ isLoggedIn, onLogout }) => {
  // Helper function to format date for datetime-local input
  const getFormattedCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Adjust for timezone
    return now.toISOString().slice(0, 16);
  };

  const [showFavoriteModal, setShowFavoriteModal] = useState(false);
  const [favoriteToSave, setFavoriteToSave] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [source, setSource] = useState<Coordinate | null>(null);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [routeLayer, setRouteLayer] = useState<L.Layer | null>(null);
  const [sourceMarker, setSourceMarker] = useState<L.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<L.Marker | null>(null);
  const [poiMarkers, setPoiMarkers] = useState<L.Marker[]>([]);
  const [transportMode, setTransportMode] = useState<string>('driving');
  const [departureTime, setDepartureTime] = useState<string>(getFormattedCurrentDateTime());
  const [isToastError, setIsToastError] = useState(false);
  const [transitInfo, setTransitInfo] = useState<any>(null);
  const [showTransitInfo, setShowTransitInfo] = useState<boolean>(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [openControl, setOpenControl] = useState<'styles' | 'menu' | 'poi' | null>(null);
  const [dataCheckStatus, setDataCheckStatus] = useState<string>('idle'); // 'idle', 'checking', 'exists', 'fetched', 'failed', 'error'
  const [activeInput, setActiveInput] = useState<'source' | 'destination'>('destination');
  const [loadingPharmacies, setLoadingPharmacies] = useState<boolean>(false);
  const [loadingRoute, setLoadingRoute] = useState<boolean>(false);
  const [routeInfo, setRouteInfo] = useState<{ 
      distance: number | null; 
      durations: { [mode: string]: number | null }; 
  } | null>(null);
  const [wifiPoints, setWifiPoints] = useState<PointOfInterest[]>([]);
  const [bicyclePoints, setBicyclePoints] = useState<PointOfInterest[]>([]);
  const [showWifi, setShowWifi] = useState<boolean>(false);
  const [showBicycle, setShowBicycle] = useState<boolean>(false);
  const [loadingWifi, setLoadingWifi] = useState<boolean>(false);
  const [loadingBicycle, setLoadingBicycle] = useState<boolean>(false);
  const [taxiMarkers, setTaxiMarkers] = useState<L.Marker[]>([]);
  const [taxiStations, setTaxiStations] = useState<any[]>([]);
  const [isLoadingTaxis, setIsLoadingTaxis] = useState<boolean>(false);
  
  // İşaretçiler için useState yerine useRef kullan
  const sourceMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  
  const sourceSearchRef = useRef<SearchBoxRef>(null);
  const destinationSearchRef = useRef<SearchBoxRef>(null);

  const mapRef = useRef<L.Map | null>(null);
  const poiMarkersRef = useRef<L.Marker[]>([]);
  const routeLayerRef = useRef<L.Layer | null>(null);
  const prevRouteLayerRef = useRef<L.Layer | null>(null); // Önceki rota katmanı için de ref
  const prevSourceRef = useRef<Coordinate | null>(null); // Önceki kaynak/hedef ref'leri
  const prevDestRef = useRef<Coordinate | null>(null);
  const wifiMarkersRef = useRef<L.LayerGroup | null>(null);
  const bicycleMarkersRef = useRef<L.LayerGroup | null>(null);

  // Navigasyon için yeni state'ler
  const [navigation, setNavigation] = useState<NavigationState>({
    isActive: false,
    currentStep: 0,
    steps: [],
    remainingDistance: 0,
    remainingDuration: 0,
    isRerouting: false,
    lastRecalculationTime: 0,
    routePolyline: null,
    userDistanceOnRoute: 0,
    lastUserPosition: null
  });
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const [showNavigationUI, setShowNavigationUI] = useState(false);
  const [routeDeviation, setRouteDeviation] = useState<boolean>(false);
  const [progressToNextStep, setProgressToNextStep] = useState<number>(0);
  
  // Add refs for tracking navigation state
  const userLocationRef = useRef<Coordinate | null>(null);
  const navigationRef = useRef<NavigationState | null>(null);
  
  // Add a new state variable to track pharmacy visibility
  const [showPharmacies, setShowPharmacies] = useState<boolean>(false);

  useEffect(() => {
    const mapInstance = L.map('map', {
      center: ANKARA_CENTER,
      zoom: 12,
      maxBounds: ANKARA_BOUNDS,
      minZoom: 11,
      maxZoom: 18,
      zoomControl: false,
      attributionControl:false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance);

    // Add zoom control to bottom left
    L.control.zoom({
      position: 'bottomleft'
    }).addTo(mapInstance);

    // --- Pusula Kontrolü Güncellendi ---
    try {
      (L.control as any).compass({
        position: 'bottomleft', // Sol alta yerleştirildi
        autoActive: true,     // Cihaz yönelimini kullanmayı dene
        showMarker: false     // Konum işaretçisini gösterme
        // style: { /* Gerekirse ek stil ayarları eklenebilir */ } 
      }).addTo(mapInstance);
      console.log('[Map Init] Compass control updated (bottomleft, autoActive: true).');
      // Not: Zoom kontrolü de sol altta, çakışma olabilir.
    } catch (error) {
      console.error('[Map Init] Error updating compass control:', error);
    }
    // -----------------------------

    // Set max bounds with some padding
    mapInstance.setMaxBounds(ANKARA_BOUNDS);

    mapRef.current = mapInstance;
    setMap(mapInstance);

    // Map click listener
    mapInstance.on('click', handleMapClick);

    const clearTaxiMarkers = () => {
      if (!map) return;
      taxiMarkers.forEach(marker => map.removeLayer(marker));
      setTaxiMarkers([]);
    };

    // Clean up map instance on component unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove(); // Use Leaflet's remove method for proper cleanup
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Bağımlılıkları kontrol et, boş dizi doğru

  const checkTodayData = useCallback(async () => {
    setDataCheckStatus('checking');
    console.log('[checkTodayData] Checking for today\'s pharmacy data...');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('[checkTodayData] No token found, skipping data check.');
        setDataCheckStatus('idle'); 
        return;
      }
      
      const response = await axios.get<CheckStatusResponse>(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/pharmacies/check-today/`,
        {
          headers: {
            'Authorization': `Token ${token}`
          }
        }
      );
      console.log('[checkTodayData] Backend response:', response.data);
      setDataCheckStatus(response.data.status || 'failed');
      
      if (response.data.status === 'fetched') {
        console.info('Today\'s pharmacy data was missing and has been updated.');
      } else if (response.data.status === 'failed' || response.data.status === 'error') {
         console.error('Failed to check or fetch today\'s pharmacy data:', response.data.message);
      }

    } catch (error: any) {
      console.error('[checkTodayData] Error checking pharmacy data:', error.response?.data || error.message);
      setDataCheckStatus('failed');
    }
  }, []);

  const clearPoiMarkers = () => {
    if (!mapRef.current) return;
    poiMarkersRef.current.forEach(marker => {
      if (mapRef.current?.hasLayer(marker)) { // Check if map has the layer before removing
        mapRef.current.removeLayer(marker);
      }
    });
    poiMarkersRef.current = [];
    setPoiMarkers([]);
  };

  const findNearestAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      // Use the specific type for Google Geocoding API response
      const response = await axios.get<GoogleGeocodeResponse>('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${lat},${lng}`,
          key: localStorage.getItem('googleApiKey') // Ensure API key exists and is correct
        }
      });

      const data = response.data;
      console.log("Google Geocode Response:", data); // Log for debugging

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
          console.error('Geocoding failed or returned no results:', data.status);
          return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; // Fallback to coordinates
      }

      const result = data.results[0]; // Access the first result
      const addressComponents = result.address_components;

      // Extract street number and street name
      const streetNumber = addressComponents.find((comp: any) => comp.types.includes('street_number'))?.long_name;
      const streetName = addressComponents.find((comp: any) => comp.types.includes('route'))?.long_name;

      if (streetName && streetNumber) {
        return `${streetName} ${streetNumber}`;
      }

      // Fallback to full formatted address if street name/number not found
      return result.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (error) {
      console.error('Error finding nearest address via Google Geocoding:', error);
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; // Fallback to coordinates on error
    }
  };

  // Yeni Handler Fonksiyonu (POI popupları için)
  const handleSetPharmacyAsDestination = (lat: number, lng: number, address: string) => {
    console.log(`[handleSetPharmacyAsDestination] Setting destination to: ${address} (${lat}, ${lng})`);
    if (!mapRef.current) return;

    // Hedef state'ini güncelle
    const newDestination: Coordinate = { lat, lng };
    setDestination(newDestination);

    // Hedef arama kutusunu güncelle
    if (destinationSearchRef.current && address) {
      destinationSearchRef.current.setQuery(address);
    }

    // Hedef işaretçisini haritaya ekle (veya güncelle)
    if (destinationMarkerRef.current && mapRef.current.hasLayer(destinationMarkerRef.current)) {
        mapRef.current.removeLayer(destinationMarkerRef.current);
    }
    destinationMarkerRef.current = L.marker([lat, lng], { icon: destinationIcon }).addTo(mapRef.current);

    // --- Mevcut rotayı temizle --- 
    clearRoute(); // Önce temizle
    // ---------------------------

    // --- Eğer başlangıç noktası varsa ROTA ÇİZ --- 
    if (source) { // source state'ini kontrol et
      console.log('[handleSetPharmacyAsDestination] Source exists, calling getRoute.');
      getRoute(source, newDestination); // Rota hesaplamayı tetikle
    } else {
      console.log('[handleSetPharmacyAsDestination] Source does not exist, cannot calculate route yet.');
      // Opsiyonel: Kullanıcıya başlangıç noktası seçmesi gerektiğini belirten bir mesaj
      // toast.info("Please set a starting point first.");
    }
    // ---------------------------------------------
    
    // Açılır pencereyi kapat
    mapRef.current.closePopup();
  };

  // --- Popup Buton Event Listener Eklemek İçin Yardımcı Fonksiyon --- 
  const addPopupEventListener = (marker: L.Marker, handler: (lat: number, lng: number, address: string) => void) => {
    marker.on('popupopen', () => {
        if (!mapRef.current) return;
        const popupPane = mapRef.current.getPane('popupPane');
        if (!popupPane) return;
        // Birden fazla buton olabileceği ihtimaline karşı querySelectorAll kullanıp döngü yapabiliriz
        // Şimdilik tek buton varsayıyoruz
        const button = popupPane.querySelector('.popup-directions-button'); 
        if (button) {
            const listener = (event: Event) => {
                // Tıklanan butondan verileri al
                const target = event.currentTarget as HTMLElement;
                const btnLat = parseFloat(target.getAttribute('data-lat') || '0');
                const btnLng = parseFloat(target.getAttribute('data-lng') || '0');
                // Adresi decode etmeyi unutma (URL encoding'i kaldır)
                const btnAddr = decodeURIComponent(target.getAttribute('data-address') || '');
                if (btnLat && btnLng) {
                    console.log(`[Popup Button Click] Calling handler for ${btnAddr}`);
                    handler(btnLat, btnLng, btnAddr); 
                }
            };
            // Eski listener'ı kaldırıp yenisini ekle (önemli!)
            button.removeEventListener('click', listener);
            button.addEventListener('click', listener);
        }
    });
  };
  // ----------------------------------------------------------------

  const addMarkersToLayer = (points: PointOfInterest[], icon: L.Icon | L.DivIcon, titleKey: keyof PointOfInterest = 'name'): L.LayerGroup | null => {
    if (!mapRef.current) {
      console.error('[addMarkersToLayer] Error: Map is not initialized.');
      return null;
    }

    const markers: L.Marker[] = [];
    points.forEach((point, index) => {
      try {
        let title = (titleKey in point && typeof point[titleKey] === 'string') ? 
                   point[titleKey] as string : 
                   point.name || 'Location';

        const marker = L.marker([point.lat, point.lng], {
          icon: icon,
          title: title
        });

        let popupContent = `<div><strong>${point.name || 'Location'}</strong>`;
        const address = point.address || '';
        if (address) popupContent += `<p>${address}</p>`;
        if (point.phone) popupContent += `<p>Tel: <a href="tel:${point.phone.replace(/\s+/g, '')}" style="color: #4285F4; text-decoration: none;">${point.phone}</a></p>`;
        if (point.distance) popupContent += `<p>Distance: ${point.distance.toFixed(2)} km</p>`;
        
        // Add Go button
        popupContent += `
          <div style="margin-top: 10px;">
            <button 
              class="popup-go-button" 
              data-lat="${point.lat}" 
              data-lng="${point.lng}" 
              style="width: 100%; padding: 8px 12px; background-color: #34A853; color: white; border: none; border-radius: 4px; cursor: pointer;"
            >
              Go
            </button>
          </div>`;

        popupContent += `</div>`;
        marker.bindPopup(popupContent);

        // Add event listener for Go button
        marker.on('popupopen', () => {
          if (!mapRef.current) return;
          const popupPane = mapRef.current.getPane('popupPane');
          if (!popupPane) return;

          // Go button
          const goButton = popupPane.querySelector('.popup-go-button');
          if (goButton) {
            const goListener = (event: Event) => {
              const target = event.currentTarget as HTMLElement;
              const btnLat = parseFloat(target.getAttribute('data-lat') || '0');
              const btnLng = parseFloat(target.getAttribute('data-lng') || '0');
              if (btnLat && btnLng && source) {
                // Remove existing destination marker if it exists
                if (destinationMarkerRef.current && mapRef.current) {
                  mapRef.current.removeLayer(destinationMarkerRef.current);
                  destinationMarkerRef.current = null;
                  setDestination(null);
                  if (destinationSearchRef.current) {
                    destinationSearchRef.current.setQuery('');
                  }
                }
                // Calculate route
                getRoute(source, { lat: btnLat, lng: btnLng });
              } else {
                toast.error('Please set your starting location first');
              }
            };
            goButton.removeEventListener('click', goListener);
            goButton.addEventListener('click', goListener);
          }
        });

        markers.push(marker);
      } catch (error) {
        console.error(`[addMarkersToLayer] Error processing point ${index}:`, point, error);
      }
    });

    if (markers.length > 0) {
      return L.layerGroup(markers);
    }
    return null;
  };

  // Update addPoiMarkers to use the same pattern
  const addPoiMarkers = (points: PointOfInterest[], icon: L.Icon | L.DivIcon, titleKey: keyof PointOfInterest = 'name') => {
    if (!mapRef.current) {
      console.error('[addPoiMarkers] Error: Map is not initialized.');
      return;
    }

    clearPoiMarkers();

    const layerGroup = addMarkersToLayer(points, icon, titleKey);
    if (layerGroup && mapRef.current) {
      layerGroup.addTo(mapRef.current);
      const layers = layerGroup.getLayers() as L.Marker[];
      poiMarkersRef.current = layers;

      // Fit bounds if needed
      if (layers.length > 0 && !source) {
        const group = L.featureGroup(layers);
        mapRef.current.fitBounds(group.getBounds().pad(0.1), {
          maxZoom: 16
        });
      }
    }
  };

  const fetchPharmacies = async () => {
    // If pharmacies are already shown, just hide them and return
    if (showPharmacies) {
      clearPoiMarkers();
      clearRoute(); // Clear the route when hiding pharmacies
      setShowPharmacies(false);
      return;
    }

    if (!source) {
      toast.error("Current location not available to find nearby pharmacies.");
      return;
    }
    setLoadingPharmacies(true);
    const today = new Date().toISOString().split("T")[0]; // Format date as YYYY-MM-DD
    //const apiUrl = `/api/pharmacies/nearest/?lat=${source?.lat}&lng=${source?.lng}`;
    const apiUrl = `${import.meta.env.VITE_BACKEND_API_URL}/api/pharmacies/nearest/?lat=${source?.lat}&lng=${source?.lng}&date=${today}`;

    try {
      const token = localStorage.getItem('token');
      // Use the specific Pharmacy type for the API response
      const response = await axios.get<Pharmacy[]>(apiUrl, {
        headers: token ? { 'Authorization': `Token ${token}` } : {}
      });

      // Filter remains the same, but the type assertion might be more specific now
      const pharmaciesPOIs: PointOfInterest[] = response.data
        .filter((pharmacy): pharmacy is Pharmacy => 
            pharmacy && pharmacy.location && 
            typeof pharmacy.location.lat === 'number' && 
            typeof pharmacy.location.lng === 'number'
        )
        .map(pharmacy => ({ // Map Pharmacy to PointOfInterest
            id: pharmacy.id,
            name: pharmacy.name,
            address: pharmacy.address,
            phone: pharmacy.phone,
            lat: pharmacy.location.lat,
            lng: pharmacy.location.lng,
            distance: pharmacy.distance,
            district: pharmacy.district,
            extra_info: pharmacy.extra_info
        }));

      if (pharmaciesPOIs.length === 0) {
            console.warn('[fetchPharmacies] No valid pharmacies found in response (possibly after filtering).');
            alert('No duty pharmacies found near the selected location for today.'); 
            // POI marker'larını temizleyebiliriz?
            clearPoiMarkers();
            setShowPharmacies(false);
            return;
        }
        
        if (destinationMarkerRef.current && mapRef.current && mapRef.current.hasLayer(destinationMarkerRef.current)) {
            console.log("[fetchPharmacies] Removing existing destination marker.");
            if (mapRef.current) {
              mapRef.current.removeLayer(destinationMarkerRef.current);
            }
            destinationMarkerRef.current = null;
            setDestination(null);
            if (destinationSearchRef.current) {
                destinationSearchRef.current.setQuery('');
            }
        }

        addPoiMarkers(pharmaciesPOIs, pharmacyIcon, 'name');
        console.log('[fetchPharmacies] Called addPoiMarkers.');
        
        const closestPharmacy = pharmaciesPOIs[0]; 
        console.log('[fetchPharmacies] Closest pharmacy selected:', closestPharmacy);
        setDestination({
            lat: closestPharmacy.lat,
            lng: closestPharmacy.lng
        });
        if (destinationSearchRef.current && closestPharmacy.address) {
             destinationSearchRef.current.setQuery(closestPharmacy.address);
        }

        clearRoute(); // Sadece mevcut rotayı temizle
        setShowPharmacies(true);

    } catch (error: any) {
      // 404 hatası artık veri yok demek, kullanıcıya bunu söyleyebiliriz
      if (error.response && error.response.status === 404) {
          console.warn('[fetchPharmacies] No duty pharmacies found in backend for today.');
          alert('No duty pharmacies found for today. Data might be updating, please try again later.');
          clearPoiMarkers(); // Hata durumunda da markerları temizle
          setShowPharmacies(false);
      } else {
          console.error('[fetchPharmacies] Error fetching pharmacies:', error.response?.data || error.message);
          alert(`Error fetching pharmacies: ${error.response?.statusText || error.message}`);
      }
    } finally {
      setLoadingPharmacies(false);
    }
  };

  const askForLocation = async () => {
    if (!mapRef.current || !("geolocation" in navigator) || !navigator.permissions) {
      // Gerekli API'lar yoksa veya harita hazır değilse çık
      console.warn('[askForLocation] Geolocation or Permissions API not available, or map not ready.');
      return;
    }

    try {
      // 1. İzin durumunu kontrol et
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
      console.log(`[askForLocation] Geolocation permission status: ${permissionStatus.state}`);

      if (permissionStatus.state === 'granted') {
        // İzin zaten verilmiş, konumu al
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 5000, maximumAge: 0
          });
        });
        const { latitude, longitude } = position.coords;
        const ankaraBounds = L.latLngBounds(ANKARA_BOUNDS);
        if (ankaraBounds.contains([latitude, longitude])) {
          console.log('[askForLocation] Location granted and within bounds. Setting source.');
          await addMarker(latitude, longitude, true);
          mapRef.current!.flyTo([latitude, longitude], 15);
        } else {
          console.info('[askForLocation] Your location is outside Ankara.');
        }
      } else if (permissionStatus.state === 'prompt') {
        // İzin sorulacak, getCurrentPosition tetikleyecek
        console.log('[askForLocation] Permission state is prompt, requesting position...');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 5000, maximumAge: 0
          });
        });
        // Kullanıcı izin verdiyse burası çalışır
        const { latitude, longitude } = position.coords;
        const ankaraBounds = L.latLngBounds(ANKARA_BOUNDS);
        if (ankaraBounds.contains([latitude, longitude])) {
           console.log('[askForLocation] Permission granted via prompt. Setting source.');
          await addMarker(latitude, longitude, true);
          mapRef.current!.flyTo([latitude, longitude], 15);
        } else {
          console.info('[askForLocation] Your location is outside Ankara (after prompt).');
        }
      } else if (permissionStatus.state === 'denied') {
        // İzin daha önce reddedilmiş
        console.info('[askForLocation] Geolocation permission was previously denied. Please enable it in browser settings if you want to use this feature.');
        // Burada kullanıcıya bir uyarı gösterilebilir (opsiyonel)
      }

      // İzin durumu değiştikçe tekrar kontrol etmek için listener (opsiyonel)
      permissionStatus.onchange = () => {
        console.log(`[askForLocation] Geolocation permission state changed to: ${permissionStatus.state}`);
        // Belki state değişimine göre tekrar konum almayı deneyebiliriz?
      };

    } catch (error: any) {
      // Bu blok artık genellikle 'prompt' durumunda kullanıcı 'Block' dediğinde
      // veya getCurrentPosition'dan başka bir hata geldiğinde çalışır.
      if (error.code === error.PERMISSION_DENIED) {
          console.warn('[askForLocation] User denied geolocation prompt.');
      } else {
         console.error('[askForLocation] Error getting location:', error);
      }
      // Genel hata mesajını yine de gösterelim mi? Belki sadece prompt sonrası red için?
      // console.info('Could not access your location. Please allow location access or select manually.');
    }
  };

  useEffect(() => {
    // Check if geolocation is available
    if ("geolocation" in navigator) {
      askForLocation();
    }
  }, [mapRef]); // Only run when map is initialized

  const saveMarkerAsFavorite = async (lat: number, lng: number, address: string) => {
    setFavoriteToSave({ lat, lng, address });
    setShowFavoriteModal(true);
  };  

  const handleSaveFavorite = async (name: string, tag: string | null) => {
    if (!favoriteToSave) return;
    const { lat, lng, address } = favoriteToSave;
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error("Please log in to save favorites.");
      return;
    }
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/users/favorites/`,
        { name, address, latitude: lat, longitude: lng, tag },
        { headers: { 'Authorization': `Token ${token}` } }
      );
      if (response.status === 201) {
        toast.success(`'${name}' added to favorites!`);
        if (mapRef.current) mapRef.current.closePopup();
      } else {
        toast.error("Failed to save favorite. Unexpected response.");
      }
    } catch (error: any) {
      console.error("Error saving favorite from modal:", error);
      const errorMsg = error.response?.data?.detail ||
        error.response?.data?.non_field_errors?.[0] ||
        error.response?.data?.latitude?.[0] ||
        error.response?.data?.longitude?.[0] ||
        "Failed to save favorite.";
      toast.error(`Error: ${errorMsg}`);
    } finally {
      setFavoriteToSave(null);
    }
  };  

  // --- Rota ve Bilgilerini Temizleme Fonksiyonu --- 
  const clearRoute = () => {
    // Clear any existing route layers
    if (routeLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    // Clear route info state
    setRouteInfo(null);
    setTransitInfo(null);
    setShowTransitInfo(false);
  };
  // -----------------------------------------------

  const addMarker = async (lat: number, lng: number, isSource: boolean, address?: string) => {
    console.log(`[addMarker ENTRY] Function called. isSource: ${isSource}`);
    console.log(`[addMarker] Called for ${isSource ? 'source' : 'destination'} at ${lat}, ${lng}. Provided address:`, address);
    if (!mapRef.current) {
        console.error("[addMarker] Map not initialized!");
        return;
    }
    const mapInstance = mapRef.current;
    const markerRef = isSource ? sourceMarkerRef : destinationMarkerRef;
    const icon = isSource ? sourceIcon : destinationIcon;
    const stateSetter = isSource ? setSource : setDestination;

    // Adresi bul veya parametreden al
    console.log("[addMarker] Finding address...");
    const locationAddress = address || await findNearestAddress(lat, lng);
    console.log("[addMarker] Found/Got address:", locationAddress);

    // Arama Kutusunu Güncelle
    const searchRef = isSource ? sourceSearchRef : destinationSearchRef;
    if (searchRef.current) {
      const queryToSet = locationAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      console.log(`[addMarker] Updating ${isSource ? 'source' : 'destination'} SearchBox query to:`, queryToSet);
      searchRef.current.setQuery(queryToSet);
    } else {
      console.warn(`[addMarker] ${isSource ? 'Source' : 'Destination'} searchRef is not available!`);
    }

    // Önceki marker'ı kaldır
    if (markerRef.current && mapInstance.hasLayer(markerRef.current)) {
      console.log(`[addMarker] Removing previous ${isSource ? 'source' : 'destination'} marker.`);
      mapInstance.removeLayer(markerRef.current);
    }

    // Yeni marker ekle
    console.log(`[addMarker] Adding new ${isSource ? 'source' : 'destination'} marker.`);
    const newMarker = L.marker([lat, lng], { icon: icon, draggable: true })
      .addTo(mapInstance)
      .on('dragend', (e) => handleMarkerDragEnd(e, isSource)); // dragend handler bağlandı

    markerRef.current = newMarker;
    console.log(`[addMarker] Setting ${isSource ? 'source' : 'destination'} state.`);
    stateSetter({ lat, lng });
    const popupContent = `
      <div>
        <strong>${locationAddress || 'Selected Location'}</strong><br>
        <button class="save-marker-favorite-btn" data-lat="${lat}" data-lng="${lng}" data-address="${encodeURIComponent(locationAddress || '')}">
          ⭐ Save as Favorite
        </button>
      </div>
    `;
    newMarker.bindPopup(popupContent);
    newMarker.on('popupopen', () => {
        if (!mapInstance) return;
        const popupPane = mapInstance.getPane('popupPane');
        if (!popupPane) return;
        const button = popupPane.querySelector('.save-marker-favorite-btn');
        if (button) {
            const listener = () => {
                const btnLat = parseFloat(button.getAttribute('data-lat') || '0');
                const btnLng = parseFloat(button.getAttribute('data-lng') || '0');
                const btnAddr = decodeURIComponent(button.getAttribute('data-address') || '');
                if (btnLat && btnLng) {
                    saveMarkerAsFavorite(btnLat, btnLng, btnAddr);
                }
            };
            button.removeEventListener('click', listener);
            button.addEventListener('click', listener);
        }
    });
    mapInstance.setView([lat, lng], 16); // Focus map

    // --- Marker değiştiğinde mevcut rotayı temizle --- 
    clearRoute();
    // ---------------------------------------------------

    console.log("[addMarker] Finished.");
  };

  // Marker sürükleme olay yöneticisi
  const handleMarkerDragEnd = (e: L.DragEndEvent, isSource: boolean) => {
    const newLatLng = e.target.getLatLng();
    const stateSetter = isSource ? setSource : setDestination;
    const searchRef = isSource ? sourceSearchRef : destinationSearchRef;
    
    console.log(`[Marker dragend] ${isSource ? 'Source' : 'Destination'} dragged to:`, newLatLng);
    stateSetter({ lat: newLatLng.lat, lng: newLatLng.lng });
    
    findNearestAddress(newLatLng.lat, newLatLng.lng).then(newAddr => {
        console.log(`[Marker dragend] Found address after drag:`, newAddr);
        if (searchRef.current) {
          const queryToSetDrag = newAddr || `${newLatLng.lat.toFixed(5)}, ${newLatLng.lng.toFixed(5)}`;
          searchRef.current.setQuery(queryToSetDrag);
        }
        // --- Rota çizimi için diğer noktayı kontrol et - KALDIRILDI --- 
        /*
        const currentSource = sourceMarkerRef.current ? source : null; // source state'ini kullan
        const currentDestination = destinationMarkerRef.current ? destination : null; // destination state'ini kullan
        const startPoint = isSource ? { lat: newLatLng.lat, lng: newLatLng.lng } : currentSource;
        const endPoint = isSource ? currentDestination : { lat: newLatLng.lat, lng: newLatLng.lng };
        if (startPoint && endPoint) {
            console.log("[Marker dragend] Recalculating route...");
            getRoute(startPoint, endPoint);
        }
        */
        // --- Marker sürüklendiğinde mevcut rotayı temizle --- 
        clearRoute();
        // ---------------------------------------------------
    });
  };

  const handleMapClick = async (e: L.LeafletMouseEvent) => {
      if (!mapRef.current) return;
      const { lat, lng } = e.latlng;
      addMarker(lat, lng, activeInput === 'source'); // Add marker without specific address
  };

  useEffect(() => {
    if (!mapRef.current) return;
    const mapInstance = mapRef.current;
    mapInstance.on('click', handleMapClick);
    return () => {
      if (mapInstance) { // Check if instance exists before removing listener
        mapInstance.off('click', handleMapClick);
      }
    };
  }, [mapRef, activeInput]); // Add activeInput dependency if needed for map click logic

  const getRoute = async (start: Coordinate, end: Coordinate) => {
    if (!mapRef.current) {
      console.error('[getRoute] Map not initialized');
      return;
    }
    
    console.log(`[getRoute] Getting route from ${start.lat},${start.lng} to ${end.lat},${end.lng}`);
    setLoadingRoute(true);
    
    // Always clear existing route first
    clearRoute();
    
    try {
      const token = localStorage.getItem('token');
      const requestData = { start, end, transport_mode: transportMode }; 
      const endpoint = `${import.meta.env.VITE_BACKEND_API_URL}/api/directions/route/`;

      const response = await axios.post<RouteResponse>(
        endpoint,
        requestData,
        { headers: { 'Authorization': `Token ${token}` } }
      );

      const routeData = response.data.routes?.[0]; 

      if (routeData?.geometry && mapRef.current) { 
        // Create outline layer for better visibility
        const routeOutline = L.geoJSON(routeData.geometry, {
          style: {
            color: '#ffffff',
            weight: 5,
            opacity: 0.4,
            lineJoin: 'round',
            lineCap: 'round'
          }
        }).addTo(mapRef.current);
        
        // Create main route layer with mode-specific styling
        const newRouteLayer = L.geoJSON(routeData.geometry, {
          style: {
            color: transportMode === 'transit' ? '#673AB7' : 
                  transportMode === 'walking' ? '#34A853' :
                  transportMode === 'cycling' ? '#EA4335' : '#4285F4',
            weight: 3,
            opacity: 0.8,
            lineJoin: 'round',
            lineCap: 'round',
            dashArray: transportMode === 'transit' ? '5, 5' : undefined
          }
        }).addTo(mapRef.current);
        
        // Extract polyline points from the GeoJSON
        let routePolyline: L.LatLng[] = [];
        if (routeData.geometry.type === 'LineString') {
          // Handle LineString
          routePolyline = routeData.geometry.coordinates.map(
            (coord: [number, number]) => new L.LatLng(coord[1], coord[0])
          );
        } else if (routeData.geometry.type === 'MultiLineString') {
          // Handle MultiLineString
          routeData.geometry.coordinates.forEach((line: [number, number][]) => {
            const linePoints = line.map(
              (coord: [number, number]) => new L.LatLng(coord[1], coord[0])
            );
            routePolyline = [...routePolyline, ...linePoints];
          });
        }
        
        // Group both layers together
        routeLayerRef.current = L.layerGroup([routeOutline, newRouteLayer]).addTo(mapRef.current);

        // Update route info state
        setRouteInfo({
          distance: routeData.distance ?? null,
          durations: routeData.durations_by_mode || {}
        });

        // Process navigation steps
        if (routeData.steps && Array.isArray(routeData.steps) && routeData.steps.length > 0) {
          const navigationSteps = routeData.steps.map(step => ({
            instruction: step.instruction || 'Continue straight',
            distance: step.distance || 0,
            duration: step.duration || 0,
            maneuver: step.maneuver || 'straight',
            bearing: (step as any).bearing || 0 // Use type assertion to avoid the error
          }));

          navigationSteps.push({
            instruction: 'You have arrived at your destination',
            distance: 0,
            duration: 0,
            maneuver: 'arrive',
            bearing: 0
          });
          
          // Save current navigation state values for transition
          const isActive = navigationRef.current?.isActive || false;
          const lastUserPosition = userLocation || navigationRef.current?.lastUserPosition || null;
          
          // Create new navigation state
          const newNavigationState = {
            isActive: isActive,
            steps: navigationSteps,
            currentStep: 0,
            remainingDistance: routeData.distance || 0,
            remainingDuration: routeData.durations_by_mode[transportMode] || 0,
            isRerouting: false,
            lastRecalculationTime: Date.now(),
            routePolyline: routePolyline,
            userDistanceOnRoute: 0,
            lastUserPosition: lastUserPosition
          };
          
          console.log('[getRoute] Updating navigation state with new route data', 
            `steps: ${navigationSteps.length}, distance: ${routeData.distance}m, duration: ${routeData.durations_by_mode[transportMode]}s`);
          
          setNavigation(newNavigationState);
          navigationRef.current = newNavigationState;
        }

        // Reset deviation state when a new route is calculated
        setRouteDeviation(false);
        setProgressToNextStep(0);

        // Fit map to route bounds if not in active navigation
        const bounds = newRouteLayer.getBounds();
        if (!navigation.isActive) {
          mapRef.current.fitBounds(bounds.pad(0.1), { maxZoom: 16 }); 
        }
        
        console.log('[getRoute] Route calculation successful');
      } else {
        console.error('[getRoute] Route data missing or invalid', routeData);
        toast.error('Could not display route on map');
      }
    } catch (error: unknown) {
      const err = error as Error | AxiosError;
      console.error('[getRoute] Error:', err);
      if (axios.isAxiosError(err)) {
        console.error('[getRoute] Response data:', err.response?.data);
      }
      toast.error('Failed to get directions');
      
      // Reset all states on error
      clearRoute();
      setNavigation({
        isActive: false,
        steps: [],
        currentStep: 0,
        remainingDistance: 0,
        remainingDuration: 0,
        isRerouting: false,
        lastRecalculationTime: 0,
        routePolyline: null,
        userDistanceOnRoute: 0,
        lastUserPosition: null
      });
      setShowNavigationUI(false);
    } finally {
      setLoadingRoute(false); 
    }
  };

  // Handle transport mode change
  const handleTransportModeChange = (mode: string) => {
    console.log(`[Mode Change] Mode changed to: ${mode}`);
    setTransportMode(mode);
    // Rota bilgisini temizlemeye gerek yok, sadece gösterilen süre değişecek
    // clearRoute(); // KALDIRILDI

    // Reset transit info if not transit mode
    if (mode !== 'transit') {
      setShowTransitInfo(false);
      setTransitInfo(null);
    }
  };

  // Handle departure time change
  const handleDepartureTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDepartureTime(e.target.value);
  };

  // Yeni toggle fonksiyonu
  const toggleModeMenu = () => {
    setIsModeMenuOpen(!isModeMenuOpen);
  };

  // İkonları burada tanımlama yerine render içinde seç
  const getModeIcon = (mode: string): React.ReactNode => {
    switch (mode) {
      case 'driving':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
          </svg>
        );
      case 'transit':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
            <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6h-5V6h5v5z"/>
          </svg>
        );
      case 'walking':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
            <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
          </svg>
        );
      case 'cycling':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
            <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  // onLocationSelect için wrapper fonksiyonlar (tipler olmadan, çünkü prop opsiyonel)
  const handleSourceSelect = (lat: number, lng: number, address?: string) => {
    addMarker(lat, lng, true, address);
  };

  const handleDestinationSelect = (lat: number, lng: number, address?: string) => {
    addMarker(lat, lng, false, address);
  };

  // Updated clearMarkers function to accept a ref
  const clearMarkers = (markerRef: React.MutableRefObject<L.LayerGroup | null>) => {
    if (markerRef.current && mapRef.current) {
        mapRef.current.removeLayer(markerRef.current); 
        markerRef.current = null;
    }
  };

  // Fetch functions for WiFi and Bicycle points
  const fetchWifiPoints = async () => {
    setLoadingWifi(true);
    try {
      const token = localStorage.getItem('token'); // Add token if required by backend
      const response = await axios.get<WiFiPoint[]>(`${import.meta.env.VITE_BACKEND_API_URL}/api/wifi-points/`, {
        headers: token ? { 'Authorization': `Token ${token}` } : {}
      });
      // Map backend data to PointOfInterest structure
      const points = response.data.map(item => ({
          id: item.id,
          name: item.name,
          lat: item.latitude,
          lng: item.longitude,
          // address: `Station ID: ${item.global_id}`, // KALDIRILDI
          // Sadece PointOfInterest interface'indeki alanları kullan
      }));
      setWifiPoints(points);
      const layerGroup = addMarkersToLayer(points, wifiIcon, 'name'); // addMarkersToLayer çağrısı güncellendi
      if (layerGroup && mapRef.current) {
        wifiMarkersRef.current = layerGroup.addTo(mapRef.current);
      }
    } catch (error) {
      console.error("Error fetching WiFi points:", error);
      toast.error("Failed to load WiFi points.");
    } finally {
      setLoadingWifi(false);
    }
  };

  const fetchBicycleStations = async () => {
    setLoadingBicycle(true);
    try {
      const token = localStorage.getItem('token'); // Add token if required by backend
      const response = await axios.get<BicyclePoint[]>(`${import.meta.env.VITE_BACKEND_API_URL}/api/bicycle-points/`, {
        headers: token ? { 'Authorization': `Token ${token}` } : {}
      });
      // Map backend data to PointOfInterest structure
      const points = response.data.map(item => ({
          id: item.id,
          name: item.name,
          lat: item.latitude,
          lng: item.longitude,
          // address: `Station ID: ${item.global_id}`, // KALDIRILDI
          // Sadece PointOfInterest interface'indeki alanları kullan
      }));
      setBicyclePoints(points);
      const layerGroup = addMarkersToLayer(points, bicycleIcon, 'name'); // addMarkersToLayer çağrısı güncellendi
      if (layerGroup && mapRef.current) {
        bicycleMarkersRef.current = layerGroup.addTo(mapRef.current);
      }
    } catch (error) {
      console.error("Error fetching Bicycle stations:", error);
      toast.error("Failed to load Bicycle stations.");
    } finally {
      setLoadingBicycle(false);
    }
  };

  // Toggle functions for layers
  const toggleWifiLayer = () => {
    const newState = !showWifi;
    setShowWifi(newState);
    if (newState) {
      if (wifiPoints.length === 0 && !loadingWifi) {
        fetchWifiPoints();
      } else if (wifiPoints.length > 0 && !wifiMarkersRef.current && mapRef.current) {
        // Data exists but layer not on map, add it
        const layerGroup = addMarkersToLayer(wifiPoints, wifiIcon, 'name');
        if (layerGroup) {
             wifiMarkersRef.current = layerGroup.addTo(mapRef.current);
        }
      }
    } else {
      clearMarkers(wifiMarkersRef);
    }
  };

  const toggleBicycleLayer = () => {
    const newState = !showBicycle;
    setShowBicycle(newState);
    if (newState) {
      if (bicyclePoints.length === 0 && !loadingBicycle) {
        fetchBicycleStations();
      } else if (bicyclePoints.length > 0 && !bicycleMarkersRef.current && mapRef.current) {
        // Data exists but layer not on map, add it
        const layerGroup = addMarkersToLayer(bicyclePoints, bicycleIcon, 'name');
        if (layerGroup) {
            bicycleMarkersRef.current = layerGroup.addTo(mapRef.current);
        }
      }
    } else {
      clearMarkers(bicycleMarkersRef);
    }
  };

  // --- Rota Süresini Formatlama Fonksiyonu --- 
  const formatRouteDuration = (seconds: number | null): string => {
    if (seconds === null || seconds <= 0) return ''; // 0 saniye veya null ise boş dön
    const minutes = Math.round(seconds / 60);
    if (minutes === 0) return '< 1 min'; // Çok kısa süreler için
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours}h`;
      } else {
         return `${hours}h ${remainingMinutes}min`;
      }
    }
  };
  // -----------------------------------------

   // --- Rota Mesafesini Formatlama Fonksiyonu --- 
   const formatRouteDistance = (meters: number | null): string => {
    if (meters === null || meters < 0) return '';
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      const kilometers = meters / 1000;
      return `${kilometers.toFixed(1)} km`; // Virgülden sonra 1 basamak
    }
  };
  // -----------------------------------------

  const fetchTaxiStations = async () => {
    try {
      if (!map) return;
      
      // Eğer konum seçilmemişse uyarı göster
      if (!source) {
        setIsToastError(true);
        toast.error('Please select a location first');
        setTimeout(() => setIsToastError(false), 1000);
        return;
      }
      
      // Yükleme başladı
      setIsLoadingTaxis(true);
      
      // Kullanıcının konumunu kullanarak API'ye istek at
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/taxi-stations/`,
        {
          params: {
            location: `${source.lat},${source.lng}`,
            radius: 5000
          }
        }
      );

      // Yanıtı kontrol et
      if (!response.data || response.data.error) {
        toast.error('Could not fetch taxi stations: ' + (response.data?.error || 'Unknown error'));
        setIsLoadingTaxis(false);
        return;
      }

      // Backend'den gelen verileri sakla
      setTaxiStations(response.data);
      console.log('Taxi stations:', response.data);

      // PointOfInterest listesine çevirerek haritada gösterebiliriz
      const taxiPOIs: PointOfInterest[] = response.data.map((station: any) => ({
        id: Math.random(), // Geçici ID
        name: station.name,
        address: '', // Bu bilgi yok
        phone: station.phoneNumber || 'No phone information',
        lat: station.location.lat,
        lng: station.location.lng,
        extra_info: `Rating: ${station.rating || 'N/A'}`
      }));

      // Taksi marker'larını temizle
      clearPoiMarkers();
      
      // Taksi POIs'leri ekle
      addPoiMarkers(taxiPOIs, taxiIcon as L.Icon | L.DivIcon);
      
      // Yükleme bitti
      setIsLoadingTaxis(false);

    } catch (error) {
      console.error('Error fetching taxi stations:', error);
      toast.error('Error fetching taxi stations');
      setIsLoadingTaxis(false);
    }
  };

  const startNavigation = () => {
    if (!source || !destination) {
      toast.error("Please select both source and destination first!");
      return;
    }
    
    // Reset navigation state
    setRouteDeviation(false);
    setProgressToNextStep(0);
    
    // Recalculate route from current location if available
    if (userLocation) {
      getRoute(userLocation, destination);
    }

    // Start location tracking with high accuracy and high frequency
    if ("geolocation" in navigator) {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation: Coordinate = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          // Calculate distance moved since last position
          const hasMovedSignificantly = navigation.lastUserPosition ? 
            calculateDistance(
              newLocation.lat, 
              newLocation.lng, 
              navigation.lastUserPosition.lat, 
              navigation.lastUserPosition.lng
            ) > 5 : true; // 5 meters threshold for "significant" movement
          
          // Update refs for other functions to access
          userLocationRef.current = newLocation;
          
          // Update state
          setUserLocation(newLocation);
          
          // Get heading if available
          if (position.coords.heading !== null) {
            setUserHeading(position.coords.heading);
          }

          // Always update position on route and check for significant changes
          if (navigationRef.current && navigationRef.current.isActive) {
            // Update the navigation state with new position
            setNavigation(prev => ({
              ...prev,
              lastUserPosition: newLocation
            }));
            
            // Always check deviation to update position
            checkRouteDeviation(newLocation, hasMovedSignificantly);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
      setWatchId(id);
    }

    // Update UI states
    setIsNavigationMode(true);
    setShowNavigationUI(true);
    
    // Update navigation state
    setNavigation(prev => {
      const newState = { 
        ...prev, 
        isActive: true,
        lastUserPosition: userLocation
      };
      navigationRef.current = newState;
      return newState;
    });
    
    // If map exists, adjust settings for navigation
    if (mapRef.current) {
      // Set appropriate zoom level
      mapRef.current.setZoom(18);
      
      // Enable rotate to follow heading if available
      if (userHeading !== null) {
        // Check if setBearing exists (from a plugin)
        if (typeof (mapRef.current as any).setBearing === 'function') {
          (mapRef.current as any).setBearing(userHeading);
        }
      }
    }
    
    toast.success("Navigation started. Follow the blue route.");
  };

  const stopNavigation = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsNavigationMode(false);
    setShowNavigationUI(false);
    setNavigation(prev => ({ ...prev, isActive: false }));
    setUserLocation(null);
    setUserHeading(null);
  };

  // Add a function to calculate distance between a point and a line segment (for route deviation detection)
  const pointToSegmentDistance = (
    point: L.LatLng,
    lineStart: L.LatLng,
    lineEnd: L.LatLng
  ): number => {
    const x = point.lat;
    const y = point.lng;
    const x1 = lineStart.lat;
    const y1 = lineStart.lng;
    const x2 = lineEnd.lat;
    const y2 = lineEnd.lng;
    
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    
    if (len_sq !== 0) {
      param = dot / len_sq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = x - xx;
    const dy = y - yy;
    
    // Calculate the actual distance in meters using the haversine formula
    return mapRef.current?.distance(point, new L.LatLng(xx, yy)) || 0;
  };
  
  // Find the closest point on the route to the user's current position
  const findClosestPointOnRoute = (
    userLocation: L.LatLng,
    routePoints: L.LatLng[]
  ): { distance: number; segmentIndex: number; pointOnRoute: L.LatLng } => {
    if (!routePoints || routePoints.length < 2) {
      return { distance: Infinity, segmentIndex: 0, pointOnRoute: userLocation };
    }
    
    let minDistance = Infinity;
    let closestSegmentIndex = 0;
    let closestPoint = userLocation;
    
    for (let i = 0; i < routePoints.length - 1; i++) {
      const distance = pointToSegmentDistance(userLocation, routePoints[i], routePoints[i + 1]);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestSegmentIndex = i;
        
        // Calculate the actual closest point on the segment
        const segStart = routePoints[i];
        const segEnd = routePoints[i + 1];
        
        // Find parameter t for parametric equation of the line
        const dx = segEnd.lat - segStart.lat;
        const dy = segEnd.lng - segStart.lng;
        const dot = (userLocation.lat - segStart.lat) * dx + (userLocation.lng - segStart.lng) * dy;
        const len_sq = dx * dx + dy * dy;
        let t = Math.max(0, Math.min(1, dot / len_sq));
        
        // Calculate the closest point
        closestPoint = new L.LatLng(
          segStart.lat + t * dx,
          segStart.lng + t * dy
        );
      }
    }
    
    return { distance: minDistance, segmentIndex: closestSegmentIndex, pointOnRoute: closestPoint };
  };
  
  // Add the route deviation check function
  const checkRouteDeviation = (currentLocation: Coordinate, forceRecalculation: boolean = false) => {
    if (!navigationRef.current?.routePolyline || navigationRef.current.routePolyline.length < 2) {
      console.log('[Navigation] No route polyline available, skipping deviation check');
      return;
    }
    
    // Convert currentLocation to L.LatLng
    const userLatLng = new L.LatLng(currentLocation.lat, currentLocation.lng);
    
    // Find the closest point on the route
    const { distance, segmentIndex, pointOnRoute } = findClosestPointOnRoute(
      userLatLng,
      navigationRef.current.routePolyline
    );
    
    // Define threshold for deviation (in meters)
    const DEVIATION_THRESHOLD = 30; // meters
    
    // Check if user has deviated from route
    const hasDeviated = distance > DEVIATION_THRESHOLD;
    
    // Log position data for debugging
    console.log(`[Navigation] Position update - Distance from route: ${distance.toFixed(2)}m, Deviation: ${hasDeviated}`);
    
    // Update position on route regardless of deviation
    updateNavigationProgress(segmentIndex, userLatLng);
    
    // Check if recalculation is needed
    const shouldRecalculate = hasDeviated || forceRecalculation;
    
    if (shouldRecalculate) {
      // Check time since last recalculation
      const timeSinceLastRecalculation = Date.now() - navigationRef.current.lastRecalculationTime;
      
      // Make the recalculation interval shorter for better responsiveness
      const MIN_RECALCULATION_INTERVAL = hasDeviated ? 5000 : 15000; // 5 seconds if deviated, 15 if just a regular update
      
      // Recalculate if it's been long enough or we're forcing recalculation
      if (timeSinceLastRecalculation > MIN_RECALCULATION_INTERVAL || forceRecalculation) {
        // Set rerouting flag
        setNavigation(prev => ({ ...prev, isRerouting: true }));
        navigationRef.current = { ...navigationRef.current, isRerouting: true };
        
        // Visual indication of rerouting
        if (hasDeviated) {
          setRouteDeviation(true);
        }
        
        // Recalculate route
        if (destination && !loadingRoute) {
          // Use current location as new source
          const newSource = { lat: currentLocation.lat, lng: currentLocation.lng };
          console.log('[Navigation] Recalculating route', hasDeviated ? 'due to deviation' : 'due to position update');
          
          // Update source state before getting route
          setSource(newSource);
          
          // Get new route from current position to destination
          getRoute(newSource, destination);
          
          // Update source marker
          if (sourceMarkerRef.current && mapRef.current) {
            mapRef.current.removeLayer(sourceMarkerRef.current);
            sourceMarkerRef.current = L.marker([newSource.lat, newSource.lng], { icon: sourceIcon }).addTo(mapRef.current);
          }
          
          // Find nearest address and update search box
          findNearestAddress(newSource.lat, newSource.lng).then(address => {
            if (sourceSearchRef.current) {
              sourceSearchRef.current.setQuery(address);
            }
          });
        }
      } else {
        console.log(`[Navigation] Skipping recalculation, last recalculation was ${(timeSinceLastRecalculation/1000).toFixed(1)}s ago`);
      }
    } else if (hasDeviated !== routeDeviation) {
      // Update deviation status if changed
      setRouteDeviation(hasDeviated);
    }
  };
  
  // Function to update progress and detect step completion
  const updateNavigationProgress = (segmentIndex: number, userLocation: L.LatLng) => {
    if (!navigationRef.current?.routePolyline || !navigationRef.current.steps.length) {
      return;
    }
    
    const currentStepIndex = navigationRef.current.currentStep;
    const totalSteps = navigationRef.current.steps.length;
    
    if (currentStepIndex >= totalSteps - 1) {
      // Already at last step (arrival), check if we've reached destination
      if (destination) {
        const distanceToDest = mapRef.current?.distance(
          userLocation,
          new L.LatLng(destination.lat, destination.lng)
        ) || 0;
        
        // If within 20 meters of destination, consider arrived
        if (distanceToDest < 20) {
          toast.success("You have arrived at your destination!");
          stopNavigation();
        }
      }
      return;
    }
    
    // Calculate how far we are through the current step
    const routePoints = navigationRef.current.routePolyline;
    const stepsCount = navigationRef.current.steps.length;
    const pointsPerStep = Math.floor(routePoints.length / stepsCount);
    
    // Approximate step boundaries in the polyline
    const currentStepStartIdx = currentStepIndex * pointsPerStep;
    const nextStepStartIdx = (currentStepIndex + 1) * pointsPerStep;
    
    // If we're past the next step's starting point
    if (segmentIndex >= nextStepStartIdx) {
      // Move to next step
      console.log(`[Navigation] Advancing to step ${currentStepIndex + 1}`);
      
      const currentStep = navigationRef.current.steps[currentStepIndex];
      const nextStep = navigationRef.current.steps[currentStepIndex + 1];
      
      // Calculate remaining distance and duration
      const remainingDistance = navigationRef.current.remainingDistance - currentStep.distance;
      const remainingDuration = navigationRef.current.remainingDuration - currentStep.duration;
      
      // Update navigation state
      const newNavState = {
        ...navigationRef.current,
        currentStep: currentStepIndex + 1,
        remainingDistance: Math.max(0, remainingDistance),
        remainingDuration: Math.max(0, remainingDuration)
      };
      
      setNavigation(newNavState);
      navigationRef.current = newNavState;
      
      // Play sound or vibrate for step change
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(200);
      }
      
      // Announce new instruction
      const speechEnabled = false; // Set to true to enable voice guidance
      if (speechEnabled && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(nextStep.instruction);
        window.speechSynthesis.speak(utterance);
      }
      
      setProgressToNextStep(0);
    } else {
      // Update progress within current step
      const stepProgress = (segmentIndex - currentStepStartIdx) / (nextStepStartIdx - currentStepStartIdx);
      setProgressToNextStep(Math.min(Math.max(0, stepProgress * 100), 100));
    }
  };

  // Also update userLocation effect to reposition map during navigation
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    // Create or update user location marker
    const userMarker = L.marker([userLocation.lat, userLocation.lng], {
      icon: L.divIcon({
        className: 'user-location-marker',
        html: `<div class="user-location-dot" style="transform: rotate(${userHeading || 0}deg);">
                <div class="dot"></div>
                <div class="arrow"></div>
              </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(mapRef.current);

    // In navigation mode, keep the map centered on user location and rotate map if heading available
    if (isNavigationMode) {
      // Center map on user location
      mapRef.current.setView([userLocation.lat, userLocation.lng], mapRef.current.getZoom());
      
      // If heading is available and navigation is active, rotate map to match heading
      if (userHeading !== null && navigation.isActive) {
        // Check if map has setBearing method (implemented in some Leaflet plugins)
        if (typeof (mapRef.current as any).setBearing === 'function') {
          (mapRef.current as any).setBearing(userHeading);
        }
      }
    }

    return () => {
      if (mapRef.current && mapRef.current.hasLayer(userMarker)) {
        mapRef.current.removeLayer(userMarker);
      }
    };
  }, [userLocation, userHeading, isNavigationMode, navigation.isActive]);

  // Add helper function for distance calculation
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (!mapRef.current) return 0;
    
    // Use Leaflet's built-in distance calculation (Haversine formula)
    const point1 = new L.LatLng(lat1, lon1);
    const point2 = new L.LatLng(lat2, lon2);
    return mapRef.current.distance(point1, point2);
  };

  return (
    <div className="map-container">
      <div className={`search-container ${isNavigationMode ? 'navigation-active' : ''}`}>
        <div className={`search-box-wrapper ${activeInput === 'source' ? 'active' : ''}`} onClick={() => setActiveInput('source')}>
          <div className="search-box-with-button">
            <SearchBox
              ref={sourceSearchRef}
              placeholder="Enter start location"
              onLocationSelect={handleSourceSelect}
              onFocus={() => setActiveInput('source')}
            >
              <button
                onClick={(e) => { 
                    e.stopPropagation(); // Wrapper'ın onClick'ini tetiklememesi için
                    askForLocation(); 
                }}
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
        </div>
        <div className={`search-box-wrapper ${activeInput === 'destination' ? 'active' : ''}`} onClick={() => setActiveInput('destination')}>
          <SearchBox
            ref={destinationSearchRef}
            placeholder="Enter destination"
            onLocationSelect={handleDestinationSelect}
            onFocus={() => setActiveInput('destination')}
          />
        </div>
        
        <div className="mode-menu-toggle-wrapper">
          <button onClick={toggleModeMenu} className="mode-menu-toggle-button">
            <span className="mode-icon-name">
              {getModeIcon(transportMode)} 
              <span className="mode-name">{transportMode.charAt(0).toUpperCase() + transportMode.slice(1)}</span>
            </span>
            <span>{isModeMenuOpen ? '▲' : '▼'}</span>
          </button>
          <div className="point-of-interest-buttons">
            <button 
              onClick={() => source && destination && getRoute(source, destination)} 
              className="route-button" 
              disabled={loadingRoute || !source || !destination}
            >
              <FontAwesomeIcon icon={faRoute} /> {loadingRoute ? 'Calculating...' : 'Get Directions'}
            </button>
        </div>
        </div>

        {isModeMenuOpen && (
          <div className="mode-menu-content">
            <TransportModeSelector 
              selectedMode={transportMode} 
              onModeChange={handleTransportModeChange} 
              onToggle={toggleModeMenu}
            />
            <div className="departure-time-container">
              <label htmlFor="departure-time">Departure Time:</label>
              <input
                type="datetime-local"
                id="departure-time"
                value={departureTime}
                onChange={handleDepartureTimeChange}
                className="departure-time-input"
              />
            </div>
          </div>
        )}
        
        
        <TransitInfoPanel 
          transitInfo={transitInfo} 
          isVisible={showTransitInfo} 
        />
      </div>
      
      {/* Floating bottom navigation section */}
      {routeInfo && (
        <div className="bottom-navigation-section">
          <div className="route-info">
            {routeInfo.durations[transportMode] !== null && (
              <span title={`~${Math.round(routeInfo.durations[transportMode]!)} seconds`}> 
                🕒 {formatRouteDuration(routeInfo.durations[transportMode])} 
              </span>
            )}
            {routeInfo.distance !== null && (
              <span> 
                📏 {formatRouteDistance(routeInfo.distance)}
              </span>
            )}
            {routeInfo.durations[transportMode] !== null && departureTime && (
              <span> 
                🏁 Arr: {(() => {
                  try {
                    const departureDate = new Date(departureTime);
                    departureDate.setSeconds(departureDate.getSeconds() + routeInfo.durations[transportMode]!);
                    return departureDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                  } catch (e) {
                    console.error("Error calculating arrival time:", e);
                    return '--:--';
                  }
                })()}
              </span>
            )}
          </div>
          {!isNavigationMode && (
            <button onClick={startNavigation} className="navigation-button">
              <FontAwesomeIcon icon={faLocationArrow} /> Start Navigation
            </button>
          )}
        </div>
      )}

      {/* Left-side menu */}
      <LeftSideMenu
        className={isNavigationMode ? 'navigation-active' : ''}
        isLoadingTaxis={isLoadingTaxis}
        showWifi={showWifi}
        loadingWifi={loadingWifi}
        showBicycle={showBicycle}
        loadingBicycle={loadingBicycle}
        loadingPharmacies={loadingPharmacies}
        showPharmacies={showPharmacies}
        onTaxiClick={fetchTaxiStations}
        onWifiClick={toggleWifiLayer}
        onBicycleClick={toggleBicycleLayer}
        onPharmacyClick={fetchPharmacies}
        isTransportExpanded={isModeMenuOpen}
      />

      <div id="map" style={{ height: '100%', width: '100%' }} />

      {/* Bottom right controls */}
      <div className="bottom-right-controls">
        <HamburgerMenu 
          isLoggedIn={isLoggedIn} 
          onLogout={onLogout} 
          isOpen={openControl === 'menu'} 
          onToggle={() => setOpenControl(openControl === 'menu' ? null : 'menu')}
          openDirection="up"
        />
        {map && <MapStylesControl 
          map={map} 
          isOpen={openControl === 'styles'} 
          onToggle={() => setOpenControl(openControl === 'styles' ? null : 'styles')} 
        />}
      </div>

      {/* Navigasyon UI */}
      {showNavigationUI && (
        <div className="navigation-panel">
          {/* Add rerouting indicator */}
          {navigation.isRerouting && (
            <div className="rerouting-banner" style={{
              backgroundColor: '#FFEB3B',
              color: '#333',
              padding: '10px',
              textAlign: 'center',
              fontWeight: 'bold',
              marginBottom: '10px'
            }}>
              Rerouting... Finding best path to your destination
            </div>
          )}
          
          {/* Add route deviation warning */}
          {routeDeviation && !navigation.isRerouting && (
            <div className="deviation-warning" style={{
              backgroundColor: '#FF5722',
              color: 'white',
              padding: '10px',
              textAlign: 'center',
              fontWeight: 'bold',
              marginBottom: '10px'
            }}>
              You've strayed from the route. Recalculating...
            </div>
          )}
          
          <div className="navigation-header" style={{
            borderBottom: '1px solid #eee',
            paddingBottom: '10px',
            marginBottom: '10px'
          }}>
            {/* Aktif adım - büyük gösterim */}
            <div className="current-step" style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '15px'
            }}>
              <div className="maneuver-icon" style={{
                fontSize: '24px',
                marginRight: '15px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f5f5f5',
                borderRadius: '50%'
              }}>
                {navigation.steps[navigation.currentStep]?.maneuver === 'turn-right' && '➡️'}
                {navigation.steps[navigation.currentStep]?.maneuver === 'turn-left' && '⬅️'}
                {navigation.steps[navigation.currentStep]?.maneuver === 'straight' && '⬆️'}
                {navigation.steps[navigation.currentStep]?.maneuver === 'arrive' && '🏁'}
              </div>
              <div className="step-info" style={{ flex: 1 }}>
                <div className="instruction" style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginBottom: '5px'
                }}>
                  {navigation.steps[navigation.currentStep]?.instruction || 'Calculating route...'}
                </div>
                <div className="step-distance" style={{
                  fontSize: '14px',
                  color: '#666'
                }}>
                  {formatRouteDistance(navigation.steps[navigation.currentStep]?.distance)}
                </div>
                
                {/* Add progress indicator for current step */}
                {navigation.currentStep < navigation.steps.length - 1 && (
                  <div className="step-progress-container" style={{
                    height: '4px',
                    backgroundColor: '#e0e0e0',
                    borderRadius: '2px',
                    marginTop: '5px',
                    overflow: 'hidden'
                  }}>
                    <div className="step-progress-bar" style={{
                      height: '100%',
                      width: `${progressToNextStep}%`,
                      backgroundColor: '#4285F4',
                      transition: 'width 0.3s ease-in-out'
                    }} />
                  </div>
                )}
              </div>
            </div>

            {/* Özet bilgiler ve Sonlandır butonu */}
            <div className="navigation-summary" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div className="remaining-info" style={{
                fontSize: '14px',
                color: '#666'
              }}>
                <span>🕒 {formatRouteDuration(navigation.remainingDuration)}</span>
                <span style={{ marginLeft: '10px' }}>
                  📏 {formatRouteDistance(navigation.remainingDistance)}
                </span>
              </div>
              <button 
                onClick={stopNavigation} 
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                End Navigation
              </button>
            </div>
          </div>
          
          {/* Adım adım talimatlar listesi */}
          <div className="navigation-steps" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {navigation.steps.map((step, index) => (
              <div 
                key={index} 
                className={index === navigation.currentStep ? 'active-step' : 'step-item'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px',
                  backgroundColor: index === navigation.currentStep ? '#f0f0f0' : 'transparent',
                  borderRadius: '4px',
                  transition: 'background-color 0.3s'
                }}
              >
                <div style={{
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: index === navigation.currentStep ? '#4285f4' : '#f5f5f5',
                  borderRadius: '50%',
                  marginRight: '10px'
                }}>
                  {step.maneuver === 'turn-right' && '➡️'}
                  {step.maneuver === 'turn-left' && '⬅️'}
                  {step.maneuver === 'straight' && '⬆️'}
                  {step.maneuver === 'arrive' && '🏁'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '14px',
                    color: index === navigation.currentStep ? '#000' : '#666'
                  }}>
                    {step.instruction}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#888',
                    marginTop: '2px'
                  }}>
                    {formatRouteDistance(step.distance)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add custom CSS for navigation marker */}
      <style>
        {`
          .user-location-marker {
            background: transparent !important;
          }
          .user-location-dot {
            position: relative;
            width: 20px;
            height: 20px;
            transition: transform 0.3s ease-in-out;
          }
          .user-location-dot .dot {
            position: absolute;
            width: 16px;
            height: 16px;
            background-color: #4285F4;
            border: 2px solid white;
            border-radius: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 8px rgba(0, 0, 0, 0.4);
          }
          .user-location-dot .arrow {
            position: absolute;
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-bottom: 16px solid #4285F4;
            top: 0;
            left: 50%;
            transform: translate(-50%, -13px) rotate(180deg);
            display: ${userHeading !== null ? 'block' : 'none'};
          }
        `}
      </style>

      <SaveFavoriteModal
        isOpen={showFavoriteModal}
        onClose={() => setShowFavoriteModal(false)}
        onSave={handleSaveFavorite}
        defaultName={favoriteToSave?.address.split(',')[0] || 'Favorite'}
      />
    </div>
  );
};

export default MapComponent;
