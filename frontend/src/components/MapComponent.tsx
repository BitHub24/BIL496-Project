import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import './MapComponent.css';
import {
  Coordinate, Pharmacy, PointOfInterest, RouteResponse, GeocodeResponse, SearchBoxRef, FavoriteLocation
} from '../models/Models';
import SearchBox from './SearchBox';
import FavoritesBox from './FavoritesBox';
import AddFavoriteModal from './AddFavoriteModal';
import sourceMarkerIcon from '../assets/source-marker.svg';
import destinationMarkerIcon from '../assets/destination-marker.svg';
import pharmacyIconUrl from '../assets/eczane.svg';
import taxiIconUrl from '../assets/taxi.svg';
import markerIcon from 'leaflet/dist/images/marker-icon.png';  // Import image for iconUrl
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';  // Import image for iconRetinaUrl
import markerShadow from 'leaflet/dist/images/marker-shadow.png';  // Import image for shadowUrl

/*
import bicycleIconUrl from '../assets/bicycle.png'
import wifiIconUrl from '../assets/wifi.png'
*/
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

const taxiIcon = new L.Icon({
  iconUrl: taxiIconUrl,
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [1, -34]
});
/*
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
*/
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
  //const [routeLayer, setRouteLayer] = useState<L.Layer | null>(null);
  const [sourceMarker, setSourceMarker] = useState<L.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<L.Marker | null>(null);
  
  // Her POI türü için ayrı marker state'leri
  const [pharmacyMarkers, setPharmacyMarkers] = useState<L.Marker[]>([]);
  const [taxiMarkers, setTaxiMarkers] = useState<L.Marker[]>([]);
  
  const [taxiStations, setTaxiStations] = useState<any[]>([]);
  const [isLoadingTaxis, setIsLoadingTaxis] = useState<boolean>(false);
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState<boolean>(false);
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);

  const sourceSearchRef = useRef<SearchBoxRef>(null);
  const destinationSearchRef = useRef<SearchBoxRef>(null);
  const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;
  const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<PointOfInterest | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToken, setUserToken] = useState<string | null>(null);

  // Kullanıcı tokenını localStorage'dan al ve daha güçlü bir tokeni kontrol et
  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('Token var mı:', token ? 'VAR' : 'YOK');
    setUserToken(token);

    // Tokenı useEffect dependency array'e ekledik, o yüzden burada manual çağrı yapmaya gerek yok
  }, []);

  // API'den favorileri çekme fonksiyonu oluşturuyorum
  const fetchFavoritesFromApi = async (token: string) => {
    if (!token) return;
    
    try {
      console.log('🔄 API isteği: /api/users/favorites/');
      const response = await axios.get(
        `${BACKEND_API_URL}/api/users/favorites/`,
        {
          headers: {
            'Authorization': `Token ${token}`
          }
        }
      );
      
      // Konsola favorileri yazdıralım
      console.log('✅ API yanıtı:', response.data.length, 'adet favori alındı');
      
      // Backend'den gelen verileri formatla
      const backendFavorites = response.data.map((item: any) => ({
        id: item.id.toString(),
        name: item.name,
        address: item.address || '',
        lat: item.latitude,
        lng: item.longitude
      }));
      
      // Favorileri state'e kaydet
      setFavorites(backendFavorites);
      console.log('✅ Favoriler state\'e kaydedildi');
    } catch (error: any) {
      console.error('❌ API hatası:', error.message);
      
      // Token geçersiz olmuş olabilir, bu durumda kullanıcıyı yeniden giriş yapmaya yönlendir
      if (error.response?.status === 401) {
        console.error('❌ Token geçersiz, oturum süresi dolmuş!');
        localStorage.removeItem('token'); // Geçersiz token'ı sil
        setUserToken(null); // Uygulama state'ini güncelle
        toast.error('Oturum süreniz dolmuş. Lütfen yeniden giriş yapın.');
      } else {
        toast.error('Favorileriniz yüklenirken bir hata oluştu');
      }
    }
  };

  // Load favorites from API when component mounts OR from localStorage if user is not logged in
  useEffect(() => {
    console.log('useEffect: Token durumu:', userToken ? 'TOKEN VAR' : 'TOKEN YOK');
    
    if (userToken) {
      // Token varsa, API'den favorileri al
      console.log('💾 Favorileri API\'den yüklüyorum...');
      fetchFavoritesFromApi(userToken);
    } else {
      // Token yoksa localStorage'dan al
      console.log('💾 Favorileri localStorage\'dan yüklüyorum...');
      const savedFavorites = localStorage.getItem('favorites');
      if (savedFavorites) {
        try {
          setFavorites(JSON.parse(savedFavorites));
        } catch (error) {
          console.error('Error parsing favorites from localStorage:', error);
          localStorage.removeItem('favorites');
        }
      }
    }
  }, [userToken]); // BACKEND_API_URL zaten değişmiyor, sadece userToken değişince bu effect çalışacak

  // Yeni favori ekleme fonksiyonu - Direkt API'ye gönderip sonucu state'e yaz
  const handleAddFavorite = async (favorite: FavoriteLocation) => {
    console.log('⭐ Favori ekleniyor:', favorite.name);

    try {
      // Kullanıcı giriş yapmışsa API'ye kaydet
      if (userToken) {
        console.log('🔄 API\'ye favori ekliyorum...');
        try {
          const response = await axios.post(
            `${BACKEND_API_URL}/api/users/favorites/`,
            {
              name: favorite.name,
              address: favorite.address,
              latitude: favorite.lat,
              longitude: favorite.lng
            },
            {
              headers: {
                Authorization: `Token ${userToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log('✅ Favori API\'ye kaydedildi:', response.data.id);

          // API'den dönen veriyi state'e ekle
          const newFavorite: FavoriteLocation = {
            id: response.data.id.toString(), // ID'yi string'e çevir
            name: response.data.name,
            address: response.data.address,
            lat: response.data.latitude,
            lng: response.data.longitude
          };

          setFavorites(prevFavorites => [...prevFavorites, newFavorite]);
          toast.success('Favori konumunuz başarıyla kaydedildi!');
        } catch (error: any) {
          console.error('❌ Favori ekleme hatası:', error.message);
          
          // Token geçersiz olmuş olabilir
          if (error.response?.status === 401) {
            localStorage.removeItem('token');
            setUserToken(null);
            toast.error('Oturum süreniz dolmuş. Lütfen yeniden giriş yapın.');
            return;
          }
          
          if (error.response?.status === 400 && error.response?.data?.name?.[0]?.includes('already exists')) {
            toast.error('Bu isimde bir favori zaten var!');
          } else {
            toast.error(`Favori eklenemedi: ${error.response?.data?.detail || error.message || 'Bilinmeyen hata'}`);
          }
          return;
        }
      } else {
        console.log('💾 LocalStorage\'a favori kaydediyorum...');
        // Kullanıcı giriş yapmamışsa localStorage'a kaydet
        
        // Mevcut favorileri kontrol et, aynı isimde favori varsa hata ver
        const nameExists = favorites.some(fav => fav.name.toLowerCase() === favorite.name.toLowerCase());
        if (nameExists) {
          toast.error('Bu isimde bir favori zaten var!');
          return;
        }
        
        // ID oluştur
        favorite.id = Date.now().toString();
        
        const updatedFavorites = [...favorites, favorite];
        setFavorites(updatedFavorites);

        try {
          localStorage.setItem('favorites', JSON.stringify(updatedFavorites));
          console.log('✅ Favori localStorage\'a kaydedildi');
          toast.success('Favori konumunuz kaydedildi!');
        } catch (error) {
          console.error('❌ localStorage kayıt hatası');
          toast.error('Favori kaydedilemedi!');
        }
      }
    } catch (error) {
      console.error('❌ Beklenmeyen hata!', error);
      toast.error('Favori kaydedilemedi!');
    }
  };

  // Favori silme fonksiyonu
  const handleRemoveFavorite = async (id: string) => {
    try {
      if (userToken) {
        console.log(`🔄 API'den favori siliyorum, ID: ${id}`);
        try {
          await axios.delete(`${BACKEND_API_URL}/api/users/favorites/${id}/`, {
            headers: {
              Authorization: `Token ${userToken}`,
            },
          });
          
          console.log('✅ Favori API\'den silindi');
        } catch (error: any) {
          console.error('❌ API favori silme hatası:', error.message);
          
          // Token geçersiz olmuş olabilir
          if (error.response?.status === 401) {
            localStorage.removeItem('token');
            setUserToken(null);
            toast.error('Oturum süreniz dolmuş. Lütfen yeniden giriş yapın.');
            return;
          }
          
          if (error.response?.status === 404) {
            // Favori zaten silinmiş, sorun yok devam et
            console.log('ℹ️ Favori zaten silinmiş, işleme devam ediliyor');
          } else {
            console.error('❌ Detaylı hata:', error.response?.data);
            toast.error(`Favori silinemedi: ${error.response?.data?.detail || error.message || 'Bilinmeyen hata'}`);
            return;
          }
        }
      } else {
        console.log(`💾 LocalStorage'dan favori siliyorum, ID: ${id}`);
      }

      // Her durumda state'den sil
      setFavorites((prevFavorites) => prevFavorites.filter((fav) => fav.id !== id));
      
      // Kullanıcı giriş yapmamışsa localStorage'ı güncelle
      if (!userToken) {
        const updatedFavorites = favorites.filter((fav) => fav.id !== id);
        localStorage.setItem('favorites', JSON.stringify(updatedFavorites));
        console.log('✅ Favori localStorage\'dan silindi');
      }
      
      toast.success('Favori silindi!');
    } catch (error) {
      console.error('❌ Beklenmeyen hata!', error);
      toast.error('Favori silinemedi!');
    }
  };

  useEffect(() => {
    // API key kontrolü
    if (!GOOGLE_API_KEY) {
      setApiKeyMissing(true);
      toast.error('Google API key is missing. Some features may not work correctly. Please add VITE_GOOGLE_API_KEY to your .env file.', {
        duration: 6000,
      });
    }
    
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

  // Farklı POI türleri için temizleme fonksiyonları
  const clearPharmacyMarkers = () => {
    if (!map) return;
    pharmacyMarkers.forEach(marker => map.removeLayer(marker));
    setPharmacyMarkers([]);
  };

  const clearTaxiMarkers = () => {
    if (!map) return;
    taxiMarkers.forEach(marker => map.removeLayer(marker));
    setTaxiMarkers([]);
  };

  // Tüm POI marker'larını temizleme (artık kullanılmıyor)
  const clearAllMarkers = () => {
    clearPharmacyMarkers();
    clearTaxiMarkers();
  };

  const findNearestAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      if (!GOOGLE_API_KEY) {
        console.error('Google API key is missing. Add VITE_GOOGLE_API_KEY to your .env file.');
        return ''; // Return empty if API key is missing
      }
      
      const response = await axios.get<GeocodeResponse>('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${lat},${lng}`,
          key: GOOGLE_API_KEY
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

  // POI marker'larını ekleme fonksiyonu (POI türüne göre marker listesini seçer)
  const addPoiMarkers = (points: PointOfInterest[], icon: L.Icon, titleKey: keyof PointOfInterest = 'name', poiType: 'pharmacy' | 'taxi' = 'pharmacy') => {
    if (!map) return;

    // POI türüne göre marker state'ini ve setter'ını seçme
    const markerSetter = poiType === 'pharmacy' ? setPharmacyMarkers : setTaxiMarkers;
    const currentMarkers = poiType === 'pharmacy' ? pharmacyMarkers : taxiMarkers;

    // Yeni marker'ları oluştur
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
      
      // Eğer extra_info içinde rating varsa, onu da ekle
      if (point.extra_info && point.extra_info.includes('Rating:')) {
        const ratingMatch = point.extra_info.match(/Rating: ([\d.]+|N\/A)/);
        if (ratingMatch && ratingMatch[1]) {
          const rating = ratingMatch[1];
          // Yıldız simgeleri ile puanı göster
          if (rating !== 'N/A') {
            const numRating = parseFloat(rating);
            const fullStars = Math.floor(numRating);
            const halfStar = numRating % 1 >= 0.5;
            let stars = '';
            
            // Dolu yıldızları ekle
            for (let i = 0; i < fullStars; i++) {
              stars += '★';
            }
            
            // Yarım yıldız varsa ekle
            if (halfStar) {
              stars += '⯨';
            }
            
            // Boş yıldızları ekle
            const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
            for (let i = 0; i < emptyStars; i++) {
              stars += '☆';
            }
            
            popupContent += `<p>Google Rating: ${rating} ${stars}</p>`;
          } else {
            popupContent += `<p>Google Rating: No rating</p>`;
          }
        }
      }

      // Favoriye ekle butonu ekle
      popupContent += `<button class="add-favorite-button" data-id="${point.id}">Favorilere Ekle</button>`;

      popupContent += `</div>`;

      const popup = L.popup().setContent(popupContent);
      
      marker.bindPopup(popup);
      
      // Popup açıldığında butonları işlevsel hale getir
      marker.on('popupopen', () => {
        const favButton = document.querySelector(`.add-favorite-button[data-id="${point.id}"]`);
        if (favButton) {
          favButton.addEventListener('click', () => {
            setSelectedPoint(point);
            setIsModalOpen(true);
          });
        }
      });
      
      marker.addTo(map);
      return marker;
    });

    // Marker state'ini güncelle
    markerSetter(newMarkers);

    // Fit bounds to show all POIs if there are any
    if (points.length > 0) {
      const group = new L.FeatureGroup(newMarkers);
      map.fitBounds(group.getBounds().pad(0.1), {
        maxZoom: 16
      });
    }
  };

  const [isToastError, setIsToastError] = useState(false);

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
        `${BACKEND_API_URL}/api/taxi-stations/`,
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

      // Sadece taksi marker'larını temizle, eczanelere dokunma
      clearTaxiMarkers();
      
      // Taksi POIs'leri ekle, taxi tipinde
      addPoiMarkers(taxiPOIs, taxiIcon, 'name', 'taxi');
      
      // Yükleme bitti
      setIsLoadingTaxis(false);

    } catch (error) {
      console.error('Error fetching taxi stations:', error);
      toast.error('Error fetching taxi stations');
      setIsLoadingTaxis(false);
    }
  };

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

      // Yükleniyor durumunu başlat
      setIsLoadingPharmacies(true);

      // Bugünün tarihini YYYY-MM-DD formatında al
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0];

      try {
        const response = await axios.get<Pharmacy[]>(
          `${BACKEND_API_URL}/api/pharmacies/nearest`,
          {
            params: {
              lat: source.lat,
              lng: source.lng,
              date: formattedDate
            }
          }
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
          toast.error('No duty pharmacies found for today');
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

        // Sadece eczane marker'larını temizle, taksilere dokunma
        clearPharmacyMarkers();
        
        // Eczane POIs'leri ekle, pharmacy tipinde
        addPoiMarkers(pharmacies, pharmacyIcon, 'name', 'pharmacy');
      } catch (error) {
        console.error('Error fetching pharmacies:', error);
        toast.error('Error fetching pharmacies');
      } finally {
        // Her durumda yükleniyor durumunu kapat
        setIsLoadingPharmacies(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setIsLoadingPharmacies(false);
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
        `${BACKEND_API_URL}/api/directions/route/`,
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

  // Handler for favorite location select - DESTINATION olarak değiştiriyoruz
  const handleFavoriteSelect = (favorite: FavoriteLocation) => {
    if (map) {
      map.setView([favorite.lat, favorite.lng], 15);
      // Favori konumu artık destination (varış noktası) olarak ayarla
      addMarker(favorite.lat, favorite.lng, false);
      toast.success(`${favorite.name} varış noktası olarak ayarlandı!`);
    }
  };

  return (
    <div className="map-container">
      <div className="map-controls">
        <div className="search-container">
          <div className="search-box-container">
            <div className="search-row">
              <SearchBox
                ref={sourceSearchRef}
                placeholder="Start location"
                onLocationSelect={(lat, lng) => addMarker(lat, lng, true)}
              />
              <button
                className="location-button"
                onClick={() => askForLocation()}
                title="Use your current location"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
                </svg>
              </button>
            </div>
            
            <div className="search-row">
              <SearchBox
                ref={destinationSearchRef}
                placeholder="Destination"
                onLocationSelect={(lat, lng) => addMarker(lat, lng, false)}
              />
            </div>
          </div>
          
          <div className="point-of-interest-buttons">
            <button 
              onClick={() => getRoute(source!, destination!)} 
              className="route-button"
              disabled={!source || !destination}
            >
              Get Directions
            </button>
          </div>

          <div className="point-of-interest-buttons">
            <button 
              onClick={fetchPharmacies} 
              className="poi-button"
              disabled={isLoadingPharmacies || !source}
            >
              {isLoadingPharmacies ? (
                <>
                  <span className="loading-spinner"></span>
                  Loading Pharmacies...
                </>
              ) : (
                'Show Duty Pharmacies'
              )}
            </button>
          </div>

          <div className="point-of-interest-buttons">
            <button 
              onClick={fetchTaxiStations} 
              className="taxi-button"
              disabled={isLoadingTaxis || !source}
            >
              {isLoadingTaxis ? (
                <>
                  <span className="loading-spinner"></span>
                  Loading Taxi Stations...
                </>
              ) : (
                'Show Taxi Stations'
              )}
            </button>
          </div>
        </div>
        
        {/* Favorites Box as a separate container */}
        <div className="favorites-section">
          <FavoritesBox 
            favorites={favorites}
            onSelectFavorite={handleFavoriteSelect}
            onRemoveFavorite={handleRemoveFavorite}
          />
        </div>
      </div>
      
      <div id="map"></div>
      
      {/* Favori ekleme modalına token'ı geçiyoruz */}
      <AddFavoriteModal 
        point={selectedPoint}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddFavorite}
        token={userToken || undefined}
      />
    </div>
  );
};

export default MapComponent;