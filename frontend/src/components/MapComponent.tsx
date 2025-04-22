/// <reference types="react" />
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './MapComponent.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import {
  Coordinate, Pharmacy, PointOfInterest, RouteResponse, GeocodeResponse, SearchBoxRef, SearchBoxProps
} from '../models/Models';
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

// Yeni eklenen interface
interface CheckStatusResponse {
  status: 'exists' | 'fetched' | 'failed' | 'error'; // Olası durumlar
  message: string;
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

    // Add zoom control to bottom left (Konum değiştirildi)
    L.control.zoom({
      position: 'bottomleft'
    }).addTo(mapInstance);

    // Set max bounds with some padding
    mapInstance.setMaxBounds(ANKARA_BOUNDS);

    mapRef.current = mapInstance;
    setMap(mapInstance);

    // Map click listener
    mapInstance.on('click', handleMapClick);

    // Clean up map instance on component unmount
    return () => {
      mapInstance.off('click', handleMapClick);
      mapInstance.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const checkTodayData = async () => {
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
          `${process.env.REACT_APP_BACKEND_API_URL}/api/pharmacies/check-today/`,
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
    };

    checkTodayData();
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

  // Yeni Handler Fonksiyonu
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
    // Önce eski hedef işaretçisini kaldır (ref üzerinden)
    if (destinationMarkerRef.current && mapRef.current.hasLayer(destinationMarkerRef.current)) {
        mapRef.current.removeLayer(destinationMarkerRef.current);
    }
    // Yeni işaretçiyi ekle ve ref'i güncelle
    destinationMarkerRef.current = L.marker([lat, lng], { icon: destinationIcon }).addTo(mapRef.current);

    // Eğer başlangıç noktası varsa rota çiz
    if (source) {
      console.log('[handleSetPharmacyAsDestination] Source exists, calling getRoute.');
      getRoute(source, newDestination);
    }
    
    // Açılır pencereyi kapat
    mapRef.current.closePopup();
  };

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
        
        // --- Rota Oluştur Butonu Eklendi ---
        popupContent += `<button 
          class="popup-directions-button" 
          data-lat="${point.lat}" 
          data-lng="${point.lng}" 
          data-address="${address}"
        >
          Buraya Rota Oluştur
        </button>`;
        // ------------------------------------

        popupContent += `</div>`;

        marker.bindPopup(popupContent);
        
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
    console.log('[fetchPharmacies] Function called.');
    try {
      if (!source) {
        console.error('[fetchPharmacies] Error: Source location is not set.');
        return;
      }
      if (!mapRef.current) {
        console.error('[fetchPharmacies] Error: Map is not initialized.');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      // URL sonunda '/' olduğundan emin olalım
      const apiUrl = `${process.env.REACT_APP_BACKEND_API_URL}/api/pharmacies/nearest/?lat=${source?.lat}&lng=${source?.lng}&date=${today}`;
      console.log('[fetchPharmacies] Fetching from API URL:', apiUrl);

      const response = await axios.get<Pharmacy[]>( // GET isteği olduğunu varsayıyorum, nearest için mantıklı
        apiUrl,
        {
          headers: {
            'Authorization': `Token ${localStorage.getItem('token')}`
          }
        }
      );
      console.log('[fetchPharmacies] Raw API response:', response.data);

      const pharmacies: PointOfInterest[] = response.data
        .filter((pharmacy): pharmacy is Pharmacy => 
            pharmacy && pharmacy.location && 
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

       if (pharmacies.length === 0) {
            console.warn('[fetchPharmacies] No valid pharmacies found in response (possibly after filtering).');
            alert('No duty pharmacies found near the selected location for today.'); 
            // POI marker'larını temizleyebiliriz?
            clearPoiMarkers();
            return;
        }
        
        if (destinationMarkerRef.current && mapRef.current.hasLayer(destinationMarkerRef.current)) {
            console.log("[fetchPharmacies] Removing existing destination marker.");
            mapRef.current.removeLayer(destinationMarkerRef.current);
            destinationMarkerRef.current = null;
            setDestination(null);
            if (destinationSearchRef.current) {
                destinationSearchRef.current.setQuery('');
            }
        }

        addPoiMarkers(pharmacies, pharmacyIcon, 'name');
        console.log('[fetchPharmacies] Called addPoiMarkers.');
        
        const closestPharmacy = pharmacies[0]; 
        console.log('[fetchPharmacies] Closest pharmacy selected:', closestPharmacy);
        setDestination({
            lat: closestPharmacy.lat,
            lng: closestPharmacy.lng
        });
        if (destinationSearchRef.current && closestPharmacy.address) {
             destinationSearchRef.current.setQuery(closestPharmacy.address);
        }

        if (source && closestPharmacy) {
            console.log('[fetchPharmacies] Calling getRoute for the closest pharmacy.');
            await getRoute(
              { lat: source.lat, lng: source.lng },
              { lat: closestPharmacy.lat, lng: closestPharmacy.lng }
            );
          }


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
              `${process.env.REACT_APP_BACKEND_API_URL}/api/users/favorites/`,
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
      .on('dragend', (e) => {
          const newLatLng = e.target.getLatLng();
          console.log(`[addMarker dragend] ${isSource ? 'Source' : 'Destination'} dragged to:`, newLatLng);
          stateSetter({ lat: newLatLng.lat, lng: newLatLng.lng });
          findNearestAddress(newLatLng.lat, newLatLng.lng).then(newAddr => {
              console.log(`[addMarker dragend] Found address after drag:`, newAddr);
              if (searchRef.current) {
                const queryToSetDrag = newAddr || `${newLatLng.lat.toFixed(5)}, ${newLatLng.lng.toFixed(5)}`;
                console.log(`[addMarker dragend] Updating ${isSource ? 'source' : 'destination'} SearchBox query after drag to:`, queryToSetDrag);
                searchRef.current.setQuery(queryToSetDrag);
              }
              // Rota çizimi için diğer noktayı kontrol et
              const currentSource = sourceMarkerRef.current ? source : null;
              const currentDestination = destinationMarkerRef.current ? destination : null;
              const startPoint = isSource ? { lat: newLatLng.lat, lng: newLatLng.lng } : currentSource;
              const endPoint = isSource ? currentDestination : { lat: newLatLng.lat, lng: newLatLng.lng };
              if (startPoint && endPoint) {
                  console.log("[addMarker dragend] Recalculating route...");
                  getRoute(startPoint, endPoint);
              }
          });
      });

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
    console.log("[addMarker] Setting map view.");
    mapInstance.setView([lat, lng], 16); // Focus map

    // Rota çizimini kontrol et
    const currentSource = isSource ? { lat, lng } : source;
    const currentDestination = !isSource ? { lat, lng } : destination;
    if (currentSource && currentDestination) {
      console.log("[addMarker] Both points exist, calling getRoute.");
      getRoute(currentSource, currentDestination);
    }
    console.log("[addMarker] Finished.");
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
    const mapInstance = mapRef.current;

    if (prevRouteLayerRef.current && mapInstance.hasLayer(prevRouteLayerRef.current)) {
      mapInstance.removeLayer(prevRouteLayerRef.current);
    }
    prevSourceRef.current = source;
    prevDestRef.current = destination;

    getRoute(source, destination);

  }, [source, destination, mapRef, transportMode, departureTime]); // dependencies

  const getRoute = async (start: Coordinate, end: Coordinate) => {
      console.log(`[getRoute] Fetching route from ${start.lat},${start.lng} to ${end.lat},${end.lng} via ${transportMode}`);
      const token = localStorage.getItem('token');
      if (!token || !mapRef.current) {
          console.error("[getRoute] Token or Map not available.");
          return;
      }
      const mapInstance = mapRef.current;
      if (prevRouteLayerRef.current && mapInstance.hasLayer(prevRouteLayerRef.current)) {
          mapInstance.removeLayer(prevRouteLayerRef.current);
          prevRouteLayerRef.current = null;
      }
      try {
          const requestData: any = { start, end, transport_mode: transportMode };
          if (departureTime) {
              requestData.departure_time = departureTime;
          }
          const endpoint = transportMode === 'transit'
              ? `${process.env.REACT_APP_BACKEND_API_URL}/api/directions/transit/`
              : `${process.env.REACT_APP_BACKEND_API_URL}/api/directions/route/`;

          const response = await axios.post<RouteResponse>(
              endpoint,
              requestData,
              { headers: { 'Authorization': `Token ${token}` } }
          );

          const route = response.data.routes?.[0]?.geometry;
          if (route && mapInstance) {
              const newRouteLayer = L.geoJSON(route, {
                  style: { color: transportMode === 'transit' ? '#673AB7' : '#4285F4', weight: 5 }
              }).addTo(mapInstance);
              prevRouteLayerRef.current = newRouteLayer;
              const bounds = newRouteLayer.getBounds();
              // fitBounds Ankara kontrolü olmadan daha basit hale getirildi
              mapInstance.fitBounds(bounds.pad(0.1), { maxZoom: 16 }); 
          } else {
              console.warn('[getRoute] No route geometry found in response.');
          }
          if (transportMode === 'transit' && response.data.transit_info) {
              setTransitInfo(response.data.transit_info);
              setShowTransitInfo(true);
          } else {
              setShowTransitInfo(false);
              setTransitInfo(null);
          }
      } catch (error: any) {
          console.error('Error getting route:', error.response?.data || error.message);
          toast.error('Failed to get directions');
          setShowTransitInfo(false);
          setTransitInfo(null);
      }
  };

  // Handle transport mode change
  const handleTransportModeChange = (mode: string) => {
    setTransportMode(mode);
    
    // Reset transit info when changing modes
    if (mode !== 'transit') {
      setShowTransitInfo(false);
      setTransitInfo(null);
    }
    
    // If we already have source and destination, update the route
    if (source && destination) {
      getRoute(source, destination);
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
          >
            Get Directions
          </button>
        </div>
        <div className="point-of-interest-buttons">
          <button onClick={fetchPharmacies} className="poi-button">
            Show Duty Pharmacies
          </button>
        </div>
        
        <TransitInfoPanel 
          transitInfo={transitInfo} 
          isVisible={showTransitInfo} 
        />
      </div>
      
      <div className="bottom-right-controls">
        {map && <MapStylesControl 
                  map={map} 
                  isOpen={openControl === 'styles'} 
                  onToggle={() => setOpenControl(openControl === 'styles' ? null : 'styles')} 
                />}
        <HamburgerMenu 
          isLoggedIn={isLoggedIn} 
          onLogout={onLogout} 
          isOpen={openControl === 'menu'} 
          onToggle={() => setOpenControl(openControl === 'menu' ? null : 'menu')}
          openDirection="up"
        />
      </div>
      
      <div id="map" style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

export default MapComponent;
