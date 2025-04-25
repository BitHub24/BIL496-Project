import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import './SettingsPage.css';
import HamburgerMenu from './HamburgerMenu';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import 'leaflet-defaulticon-compatibility';

interface RoadSegment {
  id: number | string;
  osm_id: number | null;
  name: string;
  road_type: string | null;
  geometry?: string | null;
  lat?: number;
  lon?: number;
  bbox?: [number, number, number, number] | null;
}

interface RoadPreference {
  id: number;
  road_segment: number;
  road_name: string;
  preference_type: 'prefer' | 'avoid';
  reason: string;
  destination_address: string;
  travel_mode: string;
  distance: number | null;
  duration: number | null;
  traveled_at: string;
  source_lat?: number;
  source_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
}

interface PreferenceProfile {
  id: number;
  name: string;
  is_default: boolean;
  description: string;
  prefer_multiplier: number;
  avoid_multiplier: number;
}

interface FavoriteLocation {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  tag?: string | null;
  created_at: string;
  updated_at: string;
}

interface UserProfileData {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  user_profile: {
    phone_number: string | null;
    profile_picture: string | null;
  }
}

interface SettingsPageProps {
  isLoggedIn: boolean;
  onLogout: () => void;
}

// Tag emojileri için map
const TAG_EMOJIS: { [key: string]: string } = {
  home: '🏠',
  work: '💼',
  school: '🎓',
  favorite: '⭐',
  shopping: '🛍️',
  restaurant: '🍽️',
  gym: '💪',
  other: '📍'
};

// İlk harfi büyük yapma fonksiyonu
const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Tag için emoji alma fonksiyonu
const getTagEmoji = (tag: string): string => {
  return TAG_EMOJIS[tag.toLowerCase()] || TAG_EMOJIS.other;
};

// YENİ: Alan Tercihi Veri Arayüzü
interface UserAreaPreferenceData {
  id: number;
  preference_type: 'prefer' | 'avoid';
  preference_type_display: string;
  min_lat: string; // DecimalField string olarak dönebilir
  min_lon: string;
  max_lat: string;
  max_lon: string;
  reason?: string | null;
  created_at: string;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ isLoggedIn, onLogout }) => {
  // User profile state (address kaldırıldı)
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  // Şifre state'leri
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // Road preferences state
  const [preferredRoads, setPreferredRoads] = useState<RoadPreference[]>([]);
  const [avoidedRoads, setAvoidedRoads] = useState<RoadPreference[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<RoadSegment[]>([]);
  const [selectedResult, setSelectedResult] = useState<RoadSegment | null>(null);
  const [preferenceReason, setPreferenceReason] = useState<string>('');

  // Preference profiles state
  const [profiles, setProfiles] = useState<PreferenceProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PreferenceProfile | null>(null);
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [newProfileDescription, setNewProfileDescription] = useState<string>('');
  const [preferMultiplier, setPreferMultiplier] = useState<number>(0.75);
  const [avoidMultiplier, setAvoidMultiplier] = useState<number>(3.0);

  // Saved locations state (SavedLocation -> FavoriteLocation)
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);

  // Active tab state
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);

  // --- YENİ HARİTA STATE ve REF'LERİ ---
  const mapRef = useRef<L.Map | null>(null);
  const resultMarkerRef = useRef<L.Marker | null>(null); // Arama sonucu için
  const geometryLayerRef = useRef<L.GeoJSON | null>(null); // Yol geometrisi için
  
  // --- YENİ ALAN SEÇİMİ STATE ve REF'LERİ ---
  const [selectingArea, setSelectingArea] = useState(false); // Alan seçimi modunda mıyız?
  const [pointA, setPointA] = useState<L.LatLng | null>(null);
  const [pointB, setPointB] = useState<L.LatLng | null>(null);
  const markerARef = useRef<L.Marker | null>(null);
  const markerBRef = useRef<L.Marker | null>(null);
  const rectangleLayerRef = useRef<L.Rectangle | null>(null); // Dikdörtgen katmanı için ref
  // --- BİTTİ: YENİ ALAN SEÇİMİ STATE ve REF'LERİ ---

  // --- YENİ ALAN TERCİHLERİ STATE'İ ---
  const [areaPreferences, setAreaPreferences] = useState<UserAreaPreferenceData[]>([]);
  // --- BİTTİ: YENİ ALAN TERCİHLERİ STATE'İ ---

  // Fetch user data (address state update kaldırıldı)
  const fetchUserProfile = useCallback(async () => {
    console.log('[fetchUserProfile] Function called.');
    const token = localStorage.getItem("token");
    console.log('[fetchUserProfile] Token from localStorage:', token);
    
    if (!token) {
        console.warn('[fetchUserProfile] No token found. Aborting fetch.');
        toast.error('Authentication required. Please log in.');
        setUsername('');
        setEmail('');
        setFirstName('');
        setLastName('');
        setPhoneNumber('');
        return;
    }

    try {
      console.log('[fetchUserProfile] Attempting to fetch profile data...');
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/users/profile/`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );
      console.log('[API Response] User Data:', response.data);
      console.log('[API Response] Status Code:', response.status);
      
      if (response.data) {
        const userData = response.data;
        setUsername(userData.username);
        setEmail(userData.email);
        setFirstName(userData.first_name || '');
        setLastName(userData.last_name || '');
        setPhoneNumber(userData.user_profile?.phone_number || '');
        console.log('[State Update] Profile data set.');
      } else {
        console.error('API response format is incorrect or missing data');
        toast.error('Failed to parse user profile data');
      }
    } catch (error: any) {
      console.error('Error fetching user data:', error);
      if (error.response) {
        console.error('[fetchUserProfile Error] Response Status:', error.response.status);
        console.error('[fetchUserProfile Error] Response Data:', error.response.data);
        console.error('[fetchUserProfile Error] Response Headers:', error.response.headers);
      } else if (error.request) {
        console.error('[fetchUserProfile Error] No response received:', error.request);
      } else {
        console.error('[fetchUserProfile Error] Request setup error:', error.message);
      }
      toast.error('Failed to load user profile');
    }
  }, []);

  // Fetch road preferences
  const fetchPreferences = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const preferredResponse = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/preferences/preferred/`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );
      setPreferredRoads(preferredResponse.data as RoadPreference[]);

      const avoidedResponse = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/preferences/avoided/`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );
      setAvoidedRoads(avoidedResponse.data as RoadPreference[]);
    } catch (error) {
      console.error('Error fetching road preferences:', error);
      toast.error('Failed to load road preferences');
    }
  }, []);

  // Fetch preference profiles
  const fetchProfiles = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      setProfiles(response.data as PreferenceProfile[]);

      // Get default profile
      const defaultResponse = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/default/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      const defaultProfile = defaultResponse.data as PreferenceProfile | null;
      setSelectedProfile(defaultProfile);
      if (defaultProfile) {
        setPreferMultiplier(defaultProfile.prefer_multiplier);
        setAvoidMultiplier(defaultProfile.avoid_multiplier);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast.error('Failed to load preference profiles');
    }
  }, []);

  // Fetch saved locations
  const fetchFavorites = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/users/favorites/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      setFavoriteLocations(response.data as FavoriteLocation[]);
    } catch (error) {
      console.error('Error fetching favorite locations:', error);
      toast.error('Failed to load favorite locations');
    }
  }, []);

  // YENİ: Alan Tercihlerini Çekme Fonksiyonu
  const fetchAreaPreferences = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return; // Token yoksa işlem yapma
    try {
      console.log("Fetching area preferences...");
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/area-preferences/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      setAreaPreferences(response.data as UserAreaPreferenceData[]);
      console.log("Area preferences fetched:", response.data);
    } catch (error) {
      console.error('Error fetching area preferences:', error);
      toast.error('Failed to load area preferences');
    }
  }, []);

  // Component mount edildiğinde verileri çek (fetchAreaPreferences eklendi)
  useEffect(() => {
    console.log('[useEffect Mount] Fetching initial data...');
    fetchUserProfile();
    fetchPreferences();
    fetchProfiles();
    fetchFavorites();
    fetchAreaPreferences(); // Yeni fonksiyonu çağır
  }, [fetchUserProfile, fetchPreferences, fetchProfiles, fetchFavorites, fetchAreaPreferences]); // Bağımlılıklara ekle

  // --- GÜNCELLENMİŞ HARİTA INITIALIZATION (Geolocation ve Zoom eklendi) ---
  useEffect(() => {
    let mapInstance: L.Map | null = null; // Instance'ı dışarıda tanımla
    
    if (activeTab === 'road-preferences' && !mapRef.current) {
      console.log("Initializing map...");
      mapInstance = L.map('settings-map-container');
      mapRef.current = mapInstance; // Ref'i hemen ata

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstance);

      // --- BAŞLANGIÇ KONUMU ve ZOOM --- 
      const setDefaultView = () => {
          console.log("Setting default view (Ankara center)");
          mapInstance?.setView([39.9334, 32.8597], 11);
      };
      
      if (navigator.geolocation) {
          console.log("Requesting user location...");
          navigator.geolocation.getCurrentPosition(
              (position) => {
                  const userLatLng: L.LatLngTuple = [position.coords.latitude, position.coords.longitude];
                  console.log("User location obtained:", userLatLng);
                  mapInstance?.setView(userLatLng, 14); // Kullanıcı konumuna daha yakın zoom yap
              },
              (error) => {
                  console.warn(`Geolocation error: ${error.message}. Falling back to default view.`);
                  setDefaultView();
              },
              { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
      } else {
          console.warn("Geolocation not supported by browser. Falling back to default view.");
          setDefaultView();
      }
      // --- BİTTİ: BAŞLANGIÇ KONUMU ve ZOOM --- 

      // Harita Tıklama Listener'ı (Zoom eklendi)
      const handleMapClick = (e: L.LeafletMouseEvent) => {
        if (selectingArea && mapRef.current) { // mapRef.current kontrolü eklendi
          const clickedLatLng = e.latlng;
          const currentZoom = mapRef.current.getZoom();
          const targetZoom = Math.max(currentZoom, 15); // En az 15 zoom yap

          if (!pointA) {
            setPointA(clickedLatLng);
            if (markerARef.current) mapRef.current.removeLayer(markerARef.current);
            console.log("Adding marker A");
            markerARef.current = L.marker(clickedLatLng, {draggable: true})
              .addTo(mapRef.current) // mapRef.current kullanıldı
              .bindPopup("Alan Başlangıç Noktası A")
              .on('dragend', (event) => setPointA(event.target.getLatLng()));
            mapRef.current.flyTo(clickedLatLng, targetZoom); // Noktaya zoom yap
            toast.info("Alan bitiş noktasını (B) seçin.");
          } 
          else if (!pointB) {
            setPointB(clickedLatLng);
            if (markerBRef.current) mapRef.current.removeLayer(markerBRef.current);
             console.log("Adding marker B");
            markerBRef.current = L.marker(clickedLatLng, {draggable: true})
              .addTo(mapRef.current) // mapRef.current kullanıldı
              .bindPopup("Alan Bitiş Noktası B")
              .on('dragend', (event) => setPointB(event.target.getLatLng()));
            mapRef.current.flyTo(clickedLatLng, targetZoom); // Noktaya zoom yap
            setSelectingArea(false); 
            toast.success("Alan seçimi tamamlandı. Aşağıdan tercihinizi belirtebilirsiniz.");
          } 
        }
      };
      mapInstance.on('click', handleMapClick);
      
      return () => {
        console.log("Cleaning up map...");
        if (mapRef.current) {
          mapRef.current.off('click', handleMapClick);
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } else if (activeTab !== 'road-preferences' && mapRef.current) {
      // Sekme değiştiğinde haritayı kaldır (opsiyonel, performansa göre)
      // mapRef.current.remove();
      // mapRef.current = null;
    }
  }, [activeTab, selectingArea, pointA, pointB]); // Bağımlılıklar korundu
  // --- BİTTİ: GÜNCELLENMİŞ HARİTA INITIALIZATION ---

  // Seçilen alanı gösteren dikdörtgeni çizen fonksiyon
  const drawSelectionRectangle = useCallback(() => {
    if (!pointA || !pointB || !mapRef.current) return;

    // Önceki dikdörtgeni temizle
    if (rectangleLayerRef.current) {
      mapRef.current.removeLayer(rectangleLayerRef.current);
      rectangleLayerRef.current = null;
    }

    // Yeni dikdörtgeni çiz
    const bounds = L.latLngBounds(pointA, pointB);
    rectangleLayerRef.current = L.rectangle(bounds, { color: "#ff7800", weight: 1, fillOpacity: 0.1 }).addTo(mapRef.current);
    console.log("Selection rectangle drawn with bounds:", bounds);
  }, [pointA, pointB]);

  // Seçilen alan işaretçilerini ve dikdörtgeni temizleyen fonksiyon
  const clearAreaSelectionVisuals = useCallback(() => {
    setPointA(null);
    setPointB(null);
    setSelectingArea(false);
    if (markerARef.current) mapRef.current?.removeLayer(markerARef.current);
    if (markerBRef.current) mapRef.current?.removeLayer(markerBRef.current);
    if (rectangleLayerRef.current) mapRef.current?.removeLayer(rectangleLayerRef.current);
    markerARef.current = null;
    markerBRef.current = null;
    rectangleLayerRef.current = null;
    console.log("Area selection visuals cleared.");
  }, [mapRef]); // mapRef'e bağımlı

  // Harita initialize useEffect'i (içerik aynı kalır)
  useEffect(() => {
    // ... (içerik aynı)
  }, [activeTab, selectingArea, pointA, pointB]);

  // --- YENİ useEffect: Noktalar değiştiğinde veya seçim modu bittiğinde dikdörtgeni çiz/kaldır ---
  useEffect(() => {
    if (pointA && pointB && !selectingArea) {
      drawSelectionRectangle();
    } else {
      // Eğer noktalar eksikse veya hala seçim modundaysak, dikdörtgeni kaldır
      if (rectangleLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(rectangleLayerRef.current);
        rectangleLayerRef.current = null;
      }
    }
  }, [pointA, pointB, selectingArea, drawSelectionRectangle]);
  // --- BİTTİ: YENİ useEffect ---

  // Update password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };

    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_API_URL}/api/users/change-password/`, 
        {
          current_password: currentPassword,
          new_password: newPassword
        },
        { headers }
      );
      
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
    }
  };

  // Search for roads
  const handleSearchChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    if (query.length > 2) {
      try {
        console.log('Searching with query:', query);
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/geocoding/search/`,
          {
            params: { q: query },
          }
        );
        console.log('Search response:', response.data);
        if (Array.isArray(response.data)) {
          setSearchResults(response.data as RoadSegment[]);
        } else {
          console.error('Unexpected response format:', response.data);
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Error searching locations:', error);
        toast.error('Failed to search for locations');
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
    }
  };

  // Separate function for button click
  const handleSearchClick = async () => {
    if (searchQuery.length < 3) {
      toast.error('Please enter at least 3 characters');
      return;
    }
    try {
      console.log('Search button clicked with query:', searchQuery);
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/geocoding/search/`,
        {
          params: { q: searchQuery },
        }
      );
      console.log('Search button response:', response.data);
      if (Array.isArray(response.data)) {
        setSearchResults(response.data as RoadSegment[]);
        if (response.data.length === 0) {
          toast.info('No results found');
        }
      } else {
        console.error('Unexpected response format:', response.data);
        setSearchResults([]);
        toast.error('API response is not in expected format');
      }
    } catch (error) {
      console.error('Error searching locations:', error);
      toast.error('Failed to search for locations');
      setSearchResults([]);
    }
  };

  // --- GÜNCELLENMİŞ HARİTA FONKSİYONLARI ---
  const clearMapLayers = useCallback(() => {
    if (!mapRef.current) return;
    if (resultMarkerRef.current) {
      mapRef.current.removeLayer(resultMarkerRef.current);
      resultMarkerRef.current = null;
    }
    if (geometryLayerRef.current) {
        mapRef.current.removeLayer(geometryLayerRef.current);
        geometryLayerRef.current = null;
    }
    if (rectangleLayerRef.current) { // Dikdörtgeni de temizle
        mapRef.current.removeLayer(rectangleLayerRef.current);
        rectangleLayerRef.current = null;
    }
  }, []);

  // Sadece marker ve bbox gösteren fonksiyon (fallback)
  const displaySelectedResultMarker = useCallback((result: RoadSegment) => {
    if (!mapRef.current || !result.lat || !result.lon) return;
    clearMapLayers(); 
    const position: L.LatLngTuple = [result.lat, result.lon];
    console.log('[displaySelectedResultMarker] Setting marker at:', position);
    resultMarkerRef.current = L.marker(position)
      .addTo(mapRef.current)
      .bindPopup(result.name)
      .openPopup();
    if (result.bbox) {
      const bounds = L.latLngBounds([result.bbox[0], result.bbox[2]], [result.bbox[1], result.bbox[3]]);
      console.log('[displaySelectedResultMarker] Fitting bounds:', bounds);
      const mapContainer = mapRef.current.getContainer();
      if (mapContainer.offsetParent !== null) {
        mapRef.current.flyToBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } else {
        mapRef.current.setView(position, 15);
      }
    } else {
      console.log('[displaySelectedResultMarker] Flying to position (no bbox):', position);
      mapRef.current.flyTo(position, 15);
    }
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 100);
  }, [clearMapLayers]);

  // YENİ: GeoJSON geometrisini haritada çizen fonksiyon
  const displaySegmentGeometry = useCallback((geometryData: any, name: string) => {
      if (!mapRef.current) return;
      clearMapLayers();
      console.log('[displaySegmentGeometry] Displaying GeoJSON:', geometryData);
      
      try {
          // L.geoJSON GeoJSON nesnesini alır
          geometryLayerRef.current = L.geoJSON(geometryData, {
              style: {
                  color: "#ff7800", // Çizgi rengi
                  weight: 5,
                  opacity: 0.8
              }
          }).addTo(mapRef.current);
          
          // Haritayı çizilen geometriye sığdır
          const bounds = geometryLayerRef.current.getBounds();
          if (bounds.isValid()) {
              mapRef.current.flyToBounds(bounds, { padding: [50, 50] });
          }
          
          // Opsiyonel: Geometrinin ortasına popup ekle
          // geometryLayerRef.current.bindPopup(name).openPopup(); 

      } catch (error) {
          console.error("Error displaying GeoJSON geometry:", error);
          toast.error("Failed to display road geometry.");
          // Hata durumunda marker göstermeye geri dönülebilir
      }
      
      setTimeout(() => {
        if (mapRef.current) {
            mapRef.current.invalidateSize();
        }
      }, 100);
  }, [clearMapLayers]);

  // --- GÜNCELLENMİŞ: handleResultClick --- 
  const handleResultClick = async (result: RoadSegment) => {
    console.log('[handleResultClick] Result clicked:', result);
    setSelectedResult(result);
    clearMapLayers(); // Önce haritayı temizle

    if (result.osm_id) {
        console.log(`[handleResultClick] Found osm_id: ${result.osm_id}. Fetching geometry...`);
        try {
            const geometryResponse = await axios.get(
                `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/road-segments/geometry/${result.osm_id}/`
            );
            
            if (geometryResponse.data && geometryResponse.data.type) { // GeoJSON verisi döndü mü?
                console.log('[handleResultClick] Geometry fetched successfully:', geometryResponse.data);
                displaySegmentGeometry(geometryResponse.data, result.name); // Geometriyi çiz
            } else {
                console.warn('[handleResultClick] Geometry endpoint returned invalid data. Falling back to marker.');
                displaySelectedResultMarker(result); // Geometri yoksa marker göster
            }
        } catch (error: any) {
            if (error.response && error.response.status === 404) {
                console.warn(`[handleResultClick] Geometry not found in DB for osm_id: ${result.osm_id}. Falling back to marker.`);
            } else {
                console.error('[handleResultClick] Error fetching geometry:', error);
                toast.error('Failed to fetch road geometry.');
            }
            displaySelectedResultMarker(result); // Hata durumunda marker göster
        }
    } else {
        console.warn('[handleResultClick] No osm_id found in result. Displaying marker.');
        displaySelectedResultMarker(result); // osm_id yoksa marker göster
    }
  };
  // --- BİTTİ: GÜNCELLENMİŞ: handleResultClick --- 

  // --- handleAddPreference ve handleDeletePreference fonksiyonları geri eklendi ---
  const handleAddPreference = async (roadSegmentId: number | string, type: "preferred" | "avoided") => {
      if (typeof roadSegmentId !== 'number') {
          toast.error("Cannot add preference for a geocoding result.");
          return;
      }
      const token = localStorage.getItem("token");
      if (!token) return;
      const headers = { Authorization: `Token ${token}` };
  
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/preferences/`,
          {
            road_segment: roadSegmentId,
            preference_type: type,
            reason: preferenceReason
          },
          { headers }
        );
  
        if (type === 'preferred') {
          setPreferredRoads([...preferredRoads, response.data as RoadPreference]);
        } else {
          setAvoidedRoads([...avoidedRoads, response.data as RoadPreference]);
        }
  
        setPreferenceReason("");
        setSelectedResult(null); 
        setSearchResults([]); 
        clearMapLayers(); 
        
        toast.success(`Road added to ${type} list`);
      } catch (error) {
        console.error('Error adding preference:', error);
        toast.error('Failed to add road preference');
      }
    };

  const handleDeletePreference = async (preferenceId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };
    try {
      await axios.delete(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/preferences/${preferenceId}/`,
        { headers }
      );

      const updatedPreferredRoads = preferredRoads.filter(road => road.id !== preferenceId);
      const updatedAvoidedRoads = avoidedRoads.filter(road => road.id !== preferenceId);
      setPreferredRoads(updatedPreferredRoads);
      setAvoidedRoads(updatedAvoidedRoads);
      
      toast.success('Road preference removed');
    } catch (error) {
      console.error('Error removing preference:', error);
      toast.error('Failed to remove road preference');
    }
  };
  // --- BİTTİ: handleAddPreference ve handleDeletePreference fonksiyonları geri eklendi ---

  // --- YENİ: Alan tercih işlemleri için GÜNCELLENMİŞ fonksiyonlar ---
  const handlePreferArea = async () => {
    if (!pointA || !pointB) return;
    const token = localStorage.getItem("token");
    if (!token) {
        toast.error("Authentication required.");
        return;
    }

    const bounds = L.latLngBounds(pointA, pointB);
    const areaData = {
        preference_type: 'prefer',
        min_lat: bounds.getSouthWest().lat.toFixed(7),
        min_lon: bounds.getSouthWest().lng.toFixed(7),
        max_lat: bounds.getNorthEast().lat.toFixed(7),
        max_lon: bounds.getNorthEast().lng.toFixed(7),
    };

    console.log("Sending Prefer Area request (coords as string):", areaData);

    try {
      const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/area-preferences/`,
          areaData,
          { headers: { Authorization: `Token ${token}` } }
      );
      console.log("Prefer area response:", response.data);
      toast.success("Area marked as preferred!");
      clearAreaSelectionVisuals(); // Seçimi temizle
      // TODO: Kayıtlı alanlar listesini güncelle (fetchAreaPreferences gibi bir fonksiyon eklenebilir)
    } catch (error) {
        console.error("Error preferring area:", error);
        toast.error("Failed to mark area as preferred.");
    }
  };

  const handleAvoidArea = async () => {
    if (!pointA || !pointB) return;
    const token = localStorage.getItem("token");
    if (!token) {
        toast.error("Authentication required.");
        return;
    }

    const bounds = L.latLngBounds(pointA, pointB);
    const areaData = {
        preference_type: 'avoid', 
        min_lat: bounds.getSouthWest().lat.toFixed(7),
        min_lon: bounds.getSouthWest().lng.toFixed(7),
        max_lat: bounds.getNorthEast().lat.toFixed(7),
        max_lon: bounds.getNorthEast().lng.toFixed(7),
    };

    console.log("Sending Avoid Area request (coords as string):", areaData);
    
    try {
        const response = await axios.post(
            `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/area-preferences/`,
            areaData,
            { headers: { Authorization: `Token ${token}` } }
        );
        console.log("Avoid area response:", response.data);
        toast.success("Area marked as avoided!");
        clearAreaSelectionVisuals(); // Seçimi temizle
        // TODO: Kayıtlı alanlar listesini güncelle
      } catch (error) {
          console.error("Error avoiding area:", error);
          toast.error("Failed to mark area as avoided.");
      }
  };
  // --- BİTTİ: Alan tercih işlemleri için GÜNCELLENMİŞ fonksiyonlar ---

  // YENİ: Alan Tercihini Silme Fonksiyonu
  const handleDeleteAreaPreference = async (preferenceId: number) => {
    const token = localStorage.getItem("token");
    if (!token) {
        toast.error("Authentication required.");
        return;
    }
    console.log(`Attempting to delete area preference with ID: ${preferenceId}`);
    try {
        await axios.delete(
            `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/area-preferences/${preferenceId}/`,
            { headers: { Authorization: `Token ${token}` } }
        );
        // State'i güncelle: Silinen tercihi listeden çıkar
        setAreaPreferences(prevPrefs => prevPrefs.filter(pref => pref.id !== preferenceId));
        toast.success("Area preference deleted successfully!");
    } catch (error) {
        console.error("Error deleting area preference:", error);
        toast.error("Failed to delete area preference.");
    }
  };

  // Create new profile
  const handleSaveProfile = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/`,
        {
          name: newProfileName,
          description: newProfileDescription,
          prefer_multiplier: preferMultiplier,
          avoid_multiplier: avoidMultiplier,
          is_default: profiles.length === 0
        },
        { headers }
      );

      // Update local state
      setProfiles([...profiles, response.data as PreferenceProfile]);
      setSelectedProfile(response.data as PreferenceProfile);

      // Clear form
      setNewProfileName('');
      setNewProfileDescription('');
      
      toast.success('Profile created successfully');
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile');
    }
  };

  // Set profile as default
  const handleSetDefaultProfile = async (profileId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/${profileId}/set_default/`,
        {},
        { headers }
      );

      // Update local state
      const updatedProfiles = profiles.map(profile => ({
        ...profile,
        is_default: profile.id === profileId
      }));
      setProfiles(updatedProfiles);
      setSelectedProfile(response.data as PreferenceProfile);
      
      toast.success('Default profile updated');
    } catch (error) {
      console.error('Error setting default profile:', error);
      toast.error('Failed to update default profile');
    }
  };

  // Update profile multipliers
  const handleUpdateProfileMultipliers = async () => {
    if (!selectedProfile) {
      toast.error('Please select a profile first');
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };

    try {
      const response = await axios.patch(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/${selectedProfile.id}/`,
        {
          prefer_multiplier: preferMultiplier,
          avoid_multiplier: avoidMultiplier
        },
        { headers }
      );

      // Update local state
      const updatedProfiles = profiles.map(profile => 
        profile.id === selectedProfile.id ? response.data as PreferenceProfile : profile
      );
      setProfiles(updatedProfiles);
      setSelectedProfile(response.data as PreferenceProfile);
      
      toast.success('Profile multipliers updated');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile multipliers');
    }
  };

  // Delete saved location
  const handleDeleteFavorite = async (locationId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };

    try {
      await axios.delete(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/users/favorites/${locationId}/`,
        { headers }
      );
      setFavoriteLocations(favoriteLocations.filter(loc => loc.id !== locationId));
      toast.success('Favorite location deleted successfully!');
    } catch (error) {
      console.error('Error deleting favorite location:', error);
      toast.error('Failed to delete favorite location');
    }
  };

  // Format duration from seconds to readable format
  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return 'Unknown';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Render öncesi loglama
  console.log('[Render Check] Username:', username, 'Email:', email);

  // Yeni toggle fonksiyonu
  const toggleHamburgerMenu = () => {
    setIsHamburgerOpen(!isHamburgerOpen);
  };

  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error('Authentication error. Please log in.');
        return;
      }
      const headers = { Authorization: `Token ${token}` };
      const profileData = {
        first_name: firstName,
        last_name: lastName,
        user_profile: {
          phone_number: phoneNumber || null,
        },
      };

      const userData: { [key: string]: any } = {};

      const response = await axios.patch(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/users/user/`,
        { ...userData, user_profile: profileData.user_profile, first_name: firstName, last_name: lastName },
        { headers }
      );

      console.log('[API Response] Profile Update:', response.data);
      toast.success('Profile updated successfully!');

    } catch (error: any) {
      console.error('Error updating profile:', error);
      const errorMsg = error.response?.data?.detail || error.response?.data?.error || 'Failed to update profile';
      toast.error(`Profile update failed: ${errorMsg}`);
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-top-right">
        <HamburgerMenu 
          isLoggedIn={isLoggedIn} 
          onLogout={onLogout} 
          isOpen={isHamburgerOpen} 
          onToggle={toggleHamburgerMenu} 
          openDirection="down"
        />
      </div>
      
      <h1>Settings</h1>
      
      <div className="settings-tabs">
        <button 
          className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button 
          className={`tab-button ${activeTab === 'road-preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('road-preferences')}
        >
          Road Preferences
        </button>
        <button 
          className={`tab-button ${activeTab === 'saved-locations' ? 'active' : ''}`}
          onClick={() => setActiveTab('saved-locations')}
        >
          Favorite Locations
        </button>
      </div>
      
      <div className="settings-content">
        {activeTab === 'profile' && (
          <div className="settings-section">
            <h2>User Profile</h2>
            
            {/* Profil Bilgileri Formu */}
            <form onSubmit={handleProfileUpdate} className="profile-form">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  readOnly
                  className="readonly-input"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              
              <button type="submit" className="save-profile-button">
                Save Profile
              </button>
            </form>
            
            {/* Şifre Değiştirme Bölümü Ayrı */}
            <div className="password-section">
              <h3>Change Password</h3>
              <form onSubmit={handleUpdatePassword} className="password-form">
                <div className="form-group">
                  <label htmlFor="current-password">Current Password</label>
                  <input
                    type="password"
                    id="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="new-password">New Password</label>
                  <input
                    type="password"
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                
                <button type="submit" className="update-password-button">
                  Update Password
                </button>
              </form>
            </div>
          </div>
        )}
        
        {activeTab === 'road-preferences' && (
          <div className="settings-section">
            <h2>Road Preferences & Location Search</h2>
            
            <div className="search-and-map-container">
                <div className="search-controls">
                    <h3>Search for Location</h3>
                    <div className="search-box">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={handleSearchChange}
                          placeholder="Enter place name, address... (min 3)"
                          className="search-input"
                        />
                        <button 
                          onClick={handleSearchClick}
                          disabled={searchQuery.length < 3}
                          className="search-button"
                        >
                          Search
                        </button>
                    </div>
                  
                    {searchResults.length > 0 && (
                      <div className="search-results">
                        <h4>Search Results</h4>
                        <ul className="results-list">
                          {searchResults.map(road => (
                            <li 
                              key={road.id} 
                              className={selectedResult?.id === road.id ? 'selected' : ''}
                              onClick={() => handleResultClick(road)}
                            >
                              <span className="road-name">{road.name}</span>
                              {road.road_type && <span className="road-type">({road.road_type})</span>} 
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {selectedResult && (
                         <div className="selected-result-info">
                             <h4>Selected: {selectedResult.name}</h4>
                             <p>Coordinates: {selectedResult.lat?.toFixed(6)}, {selectedResult.lon?.toFixed(6)}</p>
                         </div>
                    )}
                </div>
                
                <div className="map-display-area">
                     {/* Alan Seçimi Başlatma Butonu */} 
                     <div className="area-selection-controls">
                         <button 
                             onClick={() => {
                                 setSelectingArea(true);
                                 // Önceki seçimleri ve markerları temizle
                                 setPointA(null);
                                 setPointB(null);
                                 if (markerARef.current) mapRef.current?.removeLayer(markerARef.current);
                                 if (markerBRef.current) mapRef.current?.removeLayer(markerBRef.current);
                                 markerARef.current = null;
                                 markerBRef.current = null;
                                 clearMapLayers(); // Arama sonucu veya geometriyi de temizle
                                 toast.info("Haritada alan başlangıç noktasını (A) seçin.");
                             }}
                             disabled={selectingArea} // Seçim modundayken disable
                             className="select-area-button"
                         >
                             {selectingArea ? "Selecting... (Click map for Point A)" : "Select Area on Map"}
                         </button>
                         {/* Seçim iptal butonu (opsiyonel) */} 
                         {selectingArea && (
                            <button onClick={() => setSelectingArea(false)}>Cancel Selection</button>
                         )}
                     </div>
                     
                     <div id="settings-map-container" style={{ height: '400px', width: '100%' }}></div>
                     
                     {/* Alan Tercih Butonları (A ve B seçildiğinde görünür) */} 
                     {pointA && pointB && !selectingArea && (
                         <div className="area-preference-buttons">
                             <h4>Selected Area Preferences</h4>
                             <p>Define preference for the area between Point A and Point B.</p>
                             <button 
                                 onClick={handlePreferArea}
                                 className="prefer-area-button"
                             >
                                 Prefer This Area
                             </button>
                             <button 
                                 onClick={handleAvoidArea}
                                 className="avoid-area-button"
                             >
                                 Avoid This Area
                             </button>
                             {/* Temizleme butonu (yeni fonksiyonu kullanacak) */} 
                             <button 
                                 onClick={clearAreaSelectionVisuals}
                                 className="clear-selection-button"
                              >
                                  Clear Area Selection
                              </button>
                         </div>
                     )}
                </div>
            </div>

            <div className="current-preferences">
              <div className="preferred-roads">
                <h3>Preferred Roads</h3>
                {preferredRoads.length === 0 ? (
                  <p>No preferred roads set</p>
                ) : (
                  <ul className="preference-list">
                    {preferredRoads.map(pref => (
                      <li key={pref.id}>
                        <div className="preference-info">
                          <span className="road-name">{pref.road_name}</span>
                          {pref.reason && <span className="reason">{pref.reason}</span>}
                        </div>
                        <button 
                          onClick={() => handleDeletePreference(pref.id)}
                          className="remove-button"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div className="avoided-roads">
                <h3>Avoided Roads</h3>
                {avoidedRoads.length === 0 ? (
                  <p>No avoided roads set</p>
                ) : (
                  <ul className="preference-list">
                    {avoidedRoads.map(pref => (
                      <li key={pref.id}>
                        <div className="preference-info">
                          <span className="road-name">{pref.road_name}</span>
                          {pref.reason && <span className="reason">{pref.reason}</span>}
                        </div>
                        <button 
                          onClick={() => handleDeletePreference(pref.id)}
                          className="remove-button"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            
            <div className="area-preferences-section settings-section">
                <h2>Preferred/Avoided Areas</h2>
                {areaPreferences.length === 0 ? (
                    <p>You haven't defined any preferred or avoided areas yet.</p>
                ) : (
                    <ul className="area-preference-list preference-list">
                        {areaPreferences.map(areaPref => (
                            <li key={areaPref.id} className={`area-pref-${areaPref.preference_type}`}> 
                                <div className="preference-info"> 
                                    <span className="area-type"> 
                                        {areaPref.preference_type_display}
                                    </span>
                                    <span className="area-coords">
                                        Bounds: ({parseFloat(areaPref.min_lat).toFixed(4)}, {parseFloat(areaPref.min_lon).toFixed(4)}) to 
                                        ({parseFloat(areaPref.max_lat).toFixed(4)}, {parseFloat(areaPref.max_lon).toFixed(4)})
                                    </span>
                                    {areaPref.reason && <span className="reason">{areaPref.reason}</span>}
                                    <span className="created-at">Saved: {formatDate(areaPref.created_at)}</span>
                                </div>
                                <button 
                                    onClick={() => handleDeleteAreaPreference(areaPref.id)}
                                    className="remove-button"
                                >
                                    Delete Area
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            
            <div className="preference-profiles">
              <h3>Preference Profiles</h3>
              
              <div className="profiles-list">
                <h4>Your Profiles</h4>
                {profiles.length === 0 ? (
                  <p>No profiles created yet</p>
                ) : (
                  <ul>
                    {profiles.map(profile => (
                      <li 
                        key={profile.id}
                        className={`profile-item ${profile.is_default ? 'default' : ''} ${selectedProfile?.id === profile.id ? 'selected' : ''}`}
                        onClick={() => setSelectedProfile(profile)}
                      >
                        <div className="profile-info">
                          <span className="profile-name">{profile.name}</span>
                          {profile.is_default && <span className="default-badge">Default</span>}
                          {profile.description && <p className="profile-description">{profile.description}</p>}
                        </div>
                        {!profile.is_default && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDefaultProfile(profile.id);
                            }}
                            className="default-button"
                          >
                            Set as Default
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div className="profile-settings">
                <h4>Profile Settings</h4>
                {selectedProfile ? (
                  <div className="multiplier-settings">
                    <h5>{selectedProfile.name}</h5>
                    <div className="multiplier-control">
                      <label>Preferred Road Multiplier:</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={preferMultiplier}
                        onChange={(e) => setPreferMultiplier(parseFloat(e.target.value))}
                      />
                      <span>{preferMultiplier.toFixed(2)}x</span>
                      <p className="multiplier-description">
                        Lower values make preferred roads more attractive (faster).
                      </p>
                    </div>
                    
                    <div className="multiplier-control">
                      <label>Avoided Road Multiplier:</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={avoidMultiplier}
                        onChange={(e) => setAvoidMultiplier(parseFloat(e.target.value))}
                      />
                      <span>{avoidMultiplier.toFixed(2)}x</span>
                      <p className="multiplier-description">
                        Higher values make avoided roads less attractive (slower).
                      </p>
                    </div>
                    
                    <button 
                      onClick={handleUpdateProfileMultipliers}
                      className="update-button"
                    >
                      Update Multipliers
                    </button>
                  </div>
                ) : (
                  <p>Select a profile to adjust settings</p>
                )}
              </div>
              
              <div className="new-profile">
                <h4>Create New Profile</h4>
                <div className="profile-form">
                  <input
                    type="text"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="Profile Name"
                  />
                  <textarea
                    value={newProfileDescription}
                    onChange={(e) => setNewProfileDescription(e.target.value)}
                    placeholder="Profile Description (optional)"
                  />
                  
                  <div className="multiplier-control">
                    <label>Preferred Road Multiplier:</label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={preferMultiplier}
                      onChange={(e) => setPreferMultiplier(parseFloat(e.target.value))}
                    />
                    <span>{preferMultiplier.toFixed(2)}x</span>
                    <p className="multiplier-description">
                      Lower values make preferred roads more attractive (faster).
                    </p>
                  </div>
                  
                  <div className="multiplier-control">
                    <label>Avoided Road Multiplier:</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={avoidMultiplier}
                      onChange={(e) => setAvoidMultiplier(parseFloat(e.target.value))}
                    />
                    <span>{avoidMultiplier.toFixed(2)}x</span>
                    <p className="multiplier-description">
                      Higher values make avoided roads less attractive (slower).
                    </p>
                  </div>
                  
                  <button onClick={handleSaveProfile}>
                    Create Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'saved-locations' && (
          <div className="settings-section">
            <h2>Favorite Locations</h2>
            
            {favoriteLocations.length === 0 ? (
              <p>You don't have any favorite locations yet.</p>
            ) : (
              <ul className="locations-list">
                {favoriteLocations.map(location => (
                  <li key={location.id} className={`location-item ${location.tag}`}>
                    <div className="location-info">
                      <h3>{location.name}</h3>
                      <p className="location-address">{location.address}</p>
                      <p className="location-tag">
                        {location.tag ? `${getTagEmoji(location.tag)} ${capitalizeFirstLetter(location.tag)}` : 'No tag'}
                      </p>
                    </div>
                    <div className="location-actions">
                      <button 
                        onClick={() => {
                          window.location.href = `/map?lat=${location.latitude}&lng=${location.longitude}&name=${encodeURIComponent(location.name)}`;
                        }}
                        className="use-location-btn"
                      >
                        Use
                      </button>
                      <button 
                        onClick={() => handleDeleteFavorite(location.id)}
                        className="delete-location-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
