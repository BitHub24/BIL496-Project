/// <reference types="react" />
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
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
import HamburgerMenu from './HamburgerMenu';
import markerIcon from 'leaflet/dist/images/marker-icon.png';  // Import image for iconUrl
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';  // Import image for iconRetinaUrl
import markerShadow from 'leaflet/dist/images/marker-shadow.png';  // Import image for shadowUrl

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
  const [openControl, setOpenControl] = useState<'styles' | 'menu' | null>(null);
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
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/pharmacies/check-today/`,
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

  const addPoiMarkers = (points: PointOfInterest[], icon: L.Icon, titleKey: keyof PointOfInterest = 'name') => {
    console.log('[addPoiMarkers] Function called with points:', points); 
    if (!mapRef.current) {
      console.error('[addPoiMarkers] Error: Map is not initialized.');
      return;
    }

    console.log('[addPoiMarkers] Clearing existing POI markers.');
    clearPoiMarkers(); 

    const newMarkers: L.Marker[] = [];
    points.forEach((point, index) => {
      try {
        let title: string;
        if (titleKey in point && typeof point[titleKey] === 'string') {
          title = point[titleKey] as string;
        } else {
          title = point.name || 'Location';
        }

        console.log(`[addPoiMarkers] Creating marker ${index + 1} for:`, point.name, `at [${point.lat}, ${point.lng}]`);
        const marker = L.marker([point.lat, point.lng], {
          icon: icon,
          title: title
        });

        // Popup içeriğini oluştur
        let popupContent = `<div><strong>${point.name || 'Location'}</strong>`;
        const address = point.address || ''; // Adresi al, yoksa boş string
        if (address) popupContent += `<p>${address}</p>`;
        if (point.phone) popupContent += `<p>Tel: ${point.phone}</p>`;
        if (point.distance) popupContent += `<p>Mesafe: ${point.distance.toFixed(2)} km</p>`;
        
        // --- Rota Oluştur Butonu Eklendi (WiFi/Bisiklet için) --- 
        popupContent += `<div><button 
          class="popup-directions-button" 
          style="margin-top: 5px;" /* Üstten küçük bir boşluk ekleyelim */
          data-lat="${point.lat}" 
          data-lng="${point.lng}" 
          data-address="${encodeURIComponent(address)}" // Adresi encode et (boş olabilir)
        >
          Get Directions Here
        </button></div>`;
        // ---------------------------------------------------------

        popupContent += `</div>`;

        marker.bindPopup(popupContent);
        
        // --- Yeni Event Listener Ekleme --- 
        addPopupEventListener(marker, handleSetPharmacyAsDestination); // Handler'ı dışarıdan alıyor
        // ---------------------------------

        console.log(`[addPoiMarkers] Adding marker ${index + 1} to map.`);
        marker.addTo(mapRef.current!);
        newMarkers.push(marker);
        console.log(`[addPoiMarkers] Marker ${index + 1} added successfully.`);
      } catch (error) {
        console.error(`[addPoiMarkers] Error processing point ${index}:`, point, error);
      }
    });

    poiMarkersRef.current = newMarkers; 
    console.log('[addPoiMarkers] Updated poiMarkers state with new markers:', newMarkers);

    // Fit bounds (Sadece POI'ler için, rota çizilince zaten ayarlanacak)
    if (newMarkers.length > 0 && !source) { // Eğer rota çizilmiyorsa sığdır
      try {
        const group = new L.FeatureGroup(newMarkers);
        console.log('[addPoiMarkers] Fitting map bounds to new POI markers.');
        mapRef.current!.fitBounds(group.getBounds().pad(0.1), {
          maxZoom: 16
        });
      } catch (error) {
        console.error('[addPoiMarkers] Error fitting bounds:', error);
      }
    } else if (newMarkers.length === 0) {
        console.warn('[addPoiMarkers] No valid markers were created to fit bounds.');
    }
  };

  const fetchPharmacies = async () => {
    if (!source) {
      toast.error("Current location not available to find nearby pharmacies.");
      return;
    }
    setLoadingPharmacies(true);
    const today = new Date().toISOString().split("T")[0]; // Format date as YYYY-MM-DD
    //const apiUrl = `/api/pharmacies/nearest/?lat=${source?.lat}&lng=${source?.lng}`;
    const apiUrl = `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/pharmacies/nearest/?lat=${source?.lat}&lng=${source?.lng}&date=${today}`;

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

    } catch (error: any) {
      // 404 hatası artık veri yok demek, kullanıcıya bunu söyleyebiliriz
      if (error.response && error.response.status === 404) {
          console.warn('[fetchPharmacies] No duty pharmacies found in backend for today.');
          alert('No duty pharmacies found for today. Data might be updating, please try again later.');
          clearPoiMarkers(); // Hata durumunda da markerları temizle
      } else {
          console.error('[fetchPharmacies] Error fetching pharmacies:', error.response?.data || error.message);
          alert(`Error fetching pharmacies: ${error.response?.statusText || error.message}`);
      }
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
      const token = localStorage.getItem('token');
      if (!token) {
          toast.error("Please log in to save favorites.");
          return;
      }
      const favName = prompt("Enter a name for this favorite location:", address.split(',')[0]);
      if (!favName) return;
      const favTagInput = prompt("Enter a tag (e.g., Home, Work) or leave empty:");
      const favTag = favTagInput || null;
      try {
          const response = await axios.post(
              `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/users/favorites/`,
              { name: favName, address: address, latitude: lat, longitude: lng, tag: favTag },
              { headers: { 'Authorization': `Token ${token}` } }
          );
          if (response.status === 201) {
              toast.success(`'${favName}' added to favorites!`);
              if(mapRef.current) mapRef.current.closePopup();
          } else {
              toast.error("Failed to save favorite. Unexpected response.");
          }
      } catch (error: any) {
          console.error("Error saving favorite from marker:", error);
          const errorMsg = error.response?.data?.detail ||
                          error.response?.data?.non_field_errors?.[0] ||
                          error.response?.data?.latitude?.[0] ||
                          error.response?.data?.longitude?.[0] ||
                          "Failed to save favorite.";
          toast.error(`Error: ${errorMsg}`);
      }
  };

  // --- Rota ve Bilgilerini Temizleme Fonksiyonu --- 
  const clearRoute = useCallback(() => {
    console.log('[clearRoute] Attempting to clear route...'); 
    if (mapRef.current && prevRouteLayerRef.current) {
      console.log('[clearRoute] Map and previous route layer ref exist.'); 
      if (mapRef.current.hasLayer(prevRouteLayerRef.current)) {
        console.log('[clearRoute] Map has the layer, removing...'); 
        try { 
          mapRef.current.removeLayer(prevRouteLayerRef.current);
          console.log('[clearRoute] Layer removed successfully from map.'); 
        } catch (e) {
           console.error('[clearRoute] Error removing layer:', e); 
        }
      } else {
          console.log('[clearRoute] Map does NOT have the layer according to hasLayer().'); 
      }
      prevRouteLayerRef.current = null;
      console.log('[clearRoute] Previous route layer ref set to null.'); 
    }
    // Rota bilgisini temizle
    setRouteInfo(null); 
    console.log('[clearRoute] Route info state cleared.'); 
  }, [mapRef, prevRouteLayerRef]); // setRouteInfo bağımlılıklara eklendi mi? React kendi çözer
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

  useEffect(() => {
    if (!source || !destination || !mapRef.current) return;
    console.log("[useEffect Source/Dest Change] Triggering getRoute");
    getRoute(source, destination);
  }, [source, destination, mapRef, transportMode, departureTime]);

  const getRoute = async (start: Coordinate, end: Coordinate) => {
      console.log(`[getRoute] Fetching route from ${start.lat},${start.lng} to ${end.lat},${end.lng} via ${transportMode}`);
      setLoadingRoute(true); 
      clearRoute(); // Rota ve bilgileri temizle
      const token = localStorage.getItem('token');
      // ... (token/map kontrolü)
      
      try {
          const requestData: any = { start, end, transport_mode: transportMode }; // Başlangıç modu gönderilir
          const endpoint = `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/directions/route/`;

          const response = await axios.post<RouteResponse>(
              endpoint,
              requestData,
              { headers: { 'Authorization': `Token ${token}` } }
          );

          const routeData = response.data.routes?.[0]; 
          if (routeData?.geometry && mapRef.current) { 
              console.log('[getRoute] Route data received:', routeData);
              // Yeni rota katmanını çiz
              const newRouteLayer = L.geoJSON(routeData.geometry, {
                  style: { color: transportMode === 'transit' ? '#673AB7' : '#4285F4', weight: 5 }
              }).addTo(mapRef.current);
              prevRouteLayerRef.current = newRouteLayer;
              console.log('[getRoute] Previous route layer ref updated.');
              
              // Rota bilgilerini state'e kaydet
              setRouteInfo({
                  distance: routeData.distance ?? null,
                  durations: routeData.durations_by_mode || {} // Boş gelirse {} ata
              });
              console.log('[getRoute] Route info state updated.');

              // Haritayı rotaya sığdır
              const bounds = newRouteLayer.getBounds();
              mapRef.current.fitBounds(bounds.pad(0.1), { maxZoom: 16 }); 

          } else {
              console.warn('[getRoute] No route geometry found in response.');
              clearRoute(); // Rota yoksa temizle
          }
          // ... (Transit info - bu kısım A* ile uyumsuz olabilir, kontrol edilmeli)
          if (transportMode === 'transit') { 
              // Transit verisi backend'den geliyorsa gösterilebilir
              // setTransitInfo(response.data.transit_info);
              // setShowTransitInfo(true);
              console.warn("Transit mode display not fully implemented with A* routing.")
          } else {
              setShowTransitInfo(false);
              setTransitInfo(null);
          }
      } catch (error: any) {
          console.error('Error getting route:', error.response?.data || error.message); 
          clearRoute(); // Hata durumunda temizle
          toast.error(error.response?.data?.error || 'Failed to get directions');
          setShowTransitInfo(false);
          setTransitInfo(null);
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

  // Updated addPoiMarkers to accept a ref and data
  const addMarkersToLayer = (points: PointOfInterest[], icon: L.Icon, titleKey: keyof PointOfInterest = 'name'): L.LayerGroup | null => {
    if (!mapRef.current) {
      console.error('[addMarkersToLayer] Error: Map is not initialized.');
      return null;
    }
    console.log(`[addMarkersToLayer] Adding ${points.length} markers.`);

    const markers: L.Marker[] = [];
    points.forEach((point, index) => {
      try {
        let title = (point[titleKey] as string) || point.name || 'Location';
        const marker = L.marker([point.lat, point.lng], {
          icon: icon,
          title: title
        });

        let popupContent = `<div><strong>${title}</strong>`;
        const address = point.address || '';
        if (address) popupContent += `<p>${address}</p>`;
        // Add other relevant properties to popup if needed
        
        // --- Rota Oluştur Butonu Eklendi (WiFi/Bisiklet için) --- 
        popupContent += `<div><button 
          class="popup-directions-button" 
          style="margin-top: 5px;" /* Üstten küçük bir boşluk ekleyelim */
          data-lat="${point.lat}" 
          data-lng="${point.lng}" 
          data-address="${encodeURIComponent(address)}" // Adresi encode et (boş olabilir)
        >
          Get Directions Here
        </button></div>`;
        // ---------------------------------------------------------

        popupContent += `</div>`;
        marker.bindPopup(popupContent);

        // --- Yeni Event Listener Ekleme (WiFi/Bisiklet için) --- 
        addPopupEventListener(marker, handleSetPharmacyAsDestination); // Aynı handler'ı kullanabiliriz
        // -----------------------------------------------------
        
        markers.push(marker);
      } catch (error) {
        console.error(`[addMarkersToLayer] Error processing point ${index}:`, point, error);
      }
    });

    if (markers.length > 0) {
        const layerGroup = L.layerGroup(markers);
        return layerGroup;
    }
    return null;
  };

  // Fetch functions for WiFi and Bicycle points
  const fetchWifiPoints = async () => {
    setLoadingWifi(true);
    try {
      const token = localStorage.getItem('token'); // Add token if required by backend
      const response = await axios.get<WiFiPoint[]>(`${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/wifi-points/`, {
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
      const response = await axios.get<BicyclePoint[]>(`${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/bicycle-points/`, {
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

  return (
    <div className="map-container">
      <div className="search-container">
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
        
        <div className="point-of-interest-buttons">
          <button 
            onClick={() => source && destination && getRoute(source, destination)} 
            className="route-button" 
            disabled={loadingRoute || !source || !destination} // Yüklenirken veya nokta yokken disable
          >
            {loadingRoute ? 'Calculating...' : 'Get Directions'}
          </button>
        </div>
        {/* Rota Bilgisi Gösterimi (Güncellendi) */} 
        {routeInfo && (
          <div className="route-info">
            {/* Seçili modun süresini göster */} 
            {routeInfo.durations[transportMode] !== null && (
                 <span title={`~${Math.round(routeInfo.durations[transportMode]!)} seconds`}> 
                     🕒 {formatRouteDuration(routeInfo.durations[transportMode])} 
                 </span>
            )}
            {/* Mesafeyi göster */} 
            {routeInfo.distance !== null && (
                 <span style={{ marginLeft: '10px' }}> 
                     📏 {formatRouteDistance(routeInfo.distance)}
                 </span>
            )}
            {/* Varış Zamanını Hesapla ve Göster */} 
            {routeInfo.durations[transportMode] !== null && departureTime && (
              (() => {
                try {
                  const departureDate = new Date(departureTime); // datetime-local değerini Date'e çevir
                  departureDate.setSeconds(departureDate.getSeconds() + routeInfo.durations[transportMode]!); // Süreyi ekle (saniye)
                  const arrivalTime = departureDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); // Sa:Dk formatında göster
                  return (
                    <span style={{ marginLeft: '10px' }}> 
                        🏁 Arr: {arrivalTime}
                    </span>
                  );
                } catch (e) {
                  console.error("Error calculating arrival time:", e);
                  return null; // Hata olursa gösterme
                }
              })()
            )}
          </div>
        )} 
        <div className="point-of-interest-buttons">
          <button onClick={fetchPharmacies} className="poi-button">
            <img src={pharmacyIconUrl} alt="Pharmacy" width="20" height="20"/> Duty Pharmacies
          </button>
        </div>
        
        <TransitInfoPanel 
          transitInfo={transitInfo} 
          isVisible={showTransitInfo} 
        />
      </div>
      
      <div className="bottom-right-controls">
        <HamburgerMenu 
          isLoggedIn={isLoggedIn} 
          onLogout={onLogout} 
          isOpen={openControl === 'menu'} 
          onToggle={() => setOpenControl(openControl === 'menu' ? null : 'menu')}
          openDirection="up"
        />
        <div className="vertical-controls"> 
          {map && <MapStylesControl 
                    map={map} 
                    isOpen={openControl === 'styles'} 
                    onToggle={() => setOpenControl(openControl === 'styles' ? null : 'styles')} 
                  />}
          <div className="layer-toggle-buttons">
            <button onClick={toggleWifiLayer} className={`poi-toggle-button layer-toggle-btn ${showWifi ? 'active' : ''} ${loadingWifi ? 'loading' : ''}`} title="Toggle WiFi Hotspots" disabled={loadingWifi}>
              <img src={wifiIconUrl} alt="WiFi" width="20" height="20"/>
            </button>
            <button onClick={toggleBicycleLayer} className={`poi-toggle-button layer-toggle-btn ${showBicycle ? 'active' : ''} ${loadingBicycle ? 'loading' : ''}`} title="Toggle Bicycle Stations" disabled={loadingBicycle}>
              <img src={bicycleIconUrl} alt="Bicycle" width="20" height="20"/>
            </button>
          </div>
        </div>
      </div>
      
      <div id="map" style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

export default MapComponent;
