import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './RoadPreferencesComponent.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RoadSegment {
  id: number | string; // ID string olabilir (place_id)
  osm_id: number | null;
  name: string; // Nominatim'den gelen adres/isim
  road_type: string | null; // Nominatim'den gelen tip
  geometry: string | null; // Bu artık kullanılmayacak ama uyumluluk için kalabilir
  lat?: number; // Eklenen alan: Latitude
  lon?: number; // Eklenen alan: Longitude
  bbox?: [number, number, number, number] | null; // Eklenen alan: Bounding Box [güney_lat, kuzey_lat, batı_lon, doğu_lon]
}

interface UserPreference {
  id: number;
  road_segment: number;
  road_name: string;
  preference_type: 'prefer' | 'avoid';
  reason: string;
}

interface PreferenceProfile {
  id: number;
  name: string;
  is_default: boolean;
  description: string;
  prefer_multiplier: number;
  avoid_multiplier: number;
}

interface Coordinate {
  lat: number;
  lng: number;
}

const RoadPreferencesComponent: React.FC = () => {
  // State for road search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RoadSegment[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // State for user preferences
  const [preferredRoads, setPreferredRoads] = useState<UserPreference[]>([]);
  const [avoidedRoads, setAvoidedRoads] = useState<UserPreference[]>([]);
  const [selectedResult, setSelectedResult] = useState<RoadSegment | null>(null);
  const [preferenceReason, setPreferenceReason] = useState('');
  
  // State for preference profiles
  const [profiles, setProfiles] = useState<PreferenceProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PreferenceProfile | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [preferMultiplier, setPreferMultiplier] = useState(0.75);
  const [avoidMultiplier, setAvoidMultiplier] = useState(3.0);
  
  // New state for map and coordinates
  const mapRef = useRef<L.Map | null>(null);
  const segmentLayerRef = useRef<L.LayerGroup | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const [startPoint, setStartPoint] = useState<Coordinate | null>(null);
  const [endPoint, setEndPoint] = useState<Coordinate | null>(null);
  const [showCoordinateInfo, setShowCoordinateInfo] = useState(false);
  const resultMarkerRef = useRef<L.Marker | null>(null);
  
  // Initialize map
  useEffect(() => {
    // Create map instance
    const mapInstance = L.map('road-preferences-map', {
      center: [39.9334, 32.8597], // Ankara center
      zoom: 12
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance);

    // Store map reference
    mapRef.current = mapInstance;
    
    // Add click handler for map
    mapInstance.on('click', (e) => {
      // Optional: Handle map clicks
    });

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);
  
  // Fetch user preferences on component mount
  useEffect(() => {
    fetchUserPreferences();
    fetchProfiles();
  }, []);
  
  // Fetch user's preferred and avoided roads
  const fetchUserPreferences = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const preferredResponse = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/preferences/preferred/`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );
      setPreferredRoads(preferredResponse.data as UserPreference[]);
      
      const avoidedResponse = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/preferences/avoided/`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );
      setAvoidedRoads(avoidedResponse.data as UserPreference[]);
    } catch (error) {
      console.error('Error fetching user preferences:', error);
    }
  }, []);
  
  // Fetch user's preference profiles
  const fetchProfiles = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(`${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/`,
       { headers: { Authorization: `Token ${token}` },
      });
      setProfiles(response.data as PreferenceProfile[]);
      
      // Get default profile
      const defaultResponse = await axios.get(`${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/default/`,
       { headers: { Authorization: `Token ${token}` },
      });
      const defaultProfile = defaultResponse.data as PreferenceProfile | null;
      setSelectedProfile(defaultProfile);
      if (defaultProfile) {
        setPreferMultiplier(defaultProfile.prefer_multiplier);
        setAvoidMultiplier(defaultProfile.avoid_multiplier);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  }, []);
  
  // Search for locations using Geocoding API
  const searchRoads = async () => {
    if (searchQuery.length < 3) return;

    setIsSearching(true);
    setSelectedResult(null); // Yeni arama yaparken önceki seçimi temizle
    setSearchResults([]); // Önceki sonuçları temizle
    clearMapLayers(); // Haritayı temizle

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/geocoding/search/`, // YENİ ENDPOINT
        { params: { q: searchQuery } }
      );
      const results = response.data as RoadSegment[]; // Gelen veri RoadSegment formatına uygun olmalı
      setSearchResults(results);

      // Sonuç yoksa mesaj gösterilebilir
      if (results.length === 0) {
        console.log("No geocoding results found.");
        // İsteğe bağlı olarak kullanıcıya mesaj gösterilebilir
      }

    } catch (error) {
      console.error('Error searching locations:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Harita katmanlarını temizleme fonksiyonu
  const clearMapLayers = () => {
    if (!mapRef.current) return;
    if (resultMarkerRef.current) {
      mapRef.current.removeLayer(resultMarkerRef.current);
      resultMarkerRef.current = null;
    }
    if (segmentLayerRef.current) { // Eski segment katmanını da temizleyelim
        mapRef.current.removeLayer(segmentLayerRef.current);
        segmentLayerRef.current = null;
    }
    // Başlangıç/bitiş noktası gösterimini de temizleyelim
    if (startMarkerRef.current) mapRef.current.removeLayer(startMarkerRef.current);
    if (endMarkerRef.current) mapRef.current.removeLayer(endMarkerRef.current);
    setShowCoordinateInfo(false);
  };

  // Display selected geocoding result on map
  const displaySelectedResult = (result: RoadSegment) => {
    if (!mapRef.current || !result.lat || !result.lon) return;

    clearMapLayers(); // Önceki işaretçileri temizle

    const position: L.LatLngTuple = [result.lat, result.lon];

    // Create marker
    resultMarkerRef.current = L.marker(position)
      .addTo(mapRef.current)
      .bindPopup(result.name)
      .openPopup();

    // Fit map to bounding box if available, otherwise just center on the point
    if (result.bbox) {
        // bbox: [güney_lat, kuzey_lat, batı_lon, doğu_lon]
        const bounds = L.latLngBounds(
            [result.bbox[0], result.bbox[2]], // Güney-Batı köşesi
            [result.bbox[1], result.bbox[3]]  // Kuzey-Doğu köşesi
        );
        mapRef.current.flyToBounds(bounds, { padding: [50, 50] });
    } else {
        mapRef.current.flyTo(position, 15); // Zoom seviyesi ayarlanabilir
    }
  };

  // Handle clicking on a search result
  const handleResultClick = (result: RoadSegment) => {
    setSelectedResult(result);
    displaySelectedResult(result);
  };

  // Add road preference
  const addPreference = async (preferenceType: 'prefer' | 'avoid') => {
    // Geocoding sonucu seçiliyse tercih eklenemez
    // Ancak, bu fonksiyonun teorik olarak sadece DB'den gelen tercihler için 
    // çağrılması gerektiğini varsayarsak, selectedResult yerine 
    // doğrudan bir UserPreference nesnesi üzerinden işlem yapılabilir.
    // Şimdilik bu fonksiyonu devre dışı bırakmak daha güvenli olabilir veya
    // sadece UserPreference listesinden bir öğe seçildiğinde aktif hale getirilebilir.
    console.warn("addPreference function called, but it might not work correctly with geocoding results.");
    // if (!selectedResult) return; // Bu kontrol anlamsız

    // TODO: Bu fonksiyonun mantığını gözden geçir. Muhtemelen sadece 
    // 'Current Preferences' bölümünden çağrılmalı ve UserPreference ID'si almalı.

    /* Önceki kod:
    const token = localStorage.getItem("token");
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/preferences/`,
        {
          road_segment: selectedResult.id, // Bu ID geocoding ID'si, DB ID'si değil!
          preference_type: preferenceType,
          reason: preferenceReason
        },
        { headers: { Authorization: `Token ${token}` } }
      );
      
      // Update local state
      if (preferenceType === 'prefer') {
        setPreferredRoads([...preferredRoads, response.data as UserPreference]);
      } else {
        setAvoidedRoads([...avoidedRoads, response.data as UserPreference]);
      }
      
      // Clear selection
      setSelectedResult(null);
      setPreferenceReason('');
      
      // Update selected result display (marker color won't change here)
      if (selectedResult) { 
        displaySelectedResult(selectedResult);
      }
    } catch (error) {
      console.error('Error adding preference:', error);
    }
    */
  };
  
  // Remove road preference
  const removePreference = async (preferenceId: number, preferenceType: 'prefer' | 'avoid') => {
    const token = localStorage.getItem("token");
    try {
      await axios.delete(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/preferences/${preferenceId}/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      
      // Update local state
      if (preferenceType === 'prefer') {
        setPreferredRoads(preferredRoads.filter(road => road.id !== preferenceId));
      } else {
        setAvoidedRoads(avoidedRoads.filter(road => road.id !== preferenceId));
      }
      
      // Update map if a result related to the removed preference was selected?
      // This connection is lost with geocoding. We can just clear the map.
      // clearMapLayers(); 
      // Veya seçili sonucu tekrar göstermeyi deneyebiliriz, ama rengi değişmez.
      // if (selectedResult) {
      //   displaySelectedResult(selectedResult);
      // }
    } catch (error) {
      console.error('Error removing preference:', error);
    }
  };
  
  // Create new profile
  const createProfile = async () => {
    if (!newProfileName) return;
    
    const token = localStorage.getItem("token");
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/`,
        {
          name: newProfileName,
          description: newProfileDescription,
          prefer_multiplier: preferMultiplier,
          avoid_multiplier: avoidMultiplier,
          is_default: profiles.length === 0 // Make default if first profile
        },
        { headers: { Authorization: `Token ${token}` } }
      );
      
      // Update local state
      setProfiles([...profiles, response.data as PreferenceProfile]);
      setSelectedProfile(response.data as PreferenceProfile);
      
      // Clear form
      setNewProfileName('');
      setNewProfileDescription('');
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };
  
  // Set profile as default
  const setAsDefault = async (profileId: number) => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/${profileId}/set_default/`,
        {},
        { headers: { Authorization: `Token ${token}` } }
      );
      
      // Update local state
      const updatedProfiles = profiles.map(profile => ({
        ...profile,
        is_default: profile.id === profileId
      }));
      setProfiles(updatedProfiles);
      setSelectedProfile(response.data as PreferenceProfile);
    } catch (error) {
      console.error('Error setting default profile:', error);
    }
  };
  
  // Update profile multipliers
  const updateProfileMultipliers = async () => {
    if (!selectedProfile) return;
    
    const token = localStorage.getItem("token");
    try {
      const response = await axios.patch(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/${selectedProfile.id}/`,
        {
          prefer_multiplier: preferMultiplier,
          avoid_multiplier: avoidMultiplier
        },
        { headers: { Authorization: `Token ${token}` } }
      );
      
      // Update local state
      const updatedProfiles = profiles.map(profile => 
        profile.id === selectedProfile.id ? response.data as PreferenceProfile : profile
      );
      setProfiles(updatedProfiles);
      setSelectedProfile(response.data as PreferenceProfile);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };
  
  return (
    <div className="road-preferences-container">
      <h2>Yol Tercihleri ve Konum Arama</h2>
      
      {/* Search Section */}
      <div className="search-section">
        <h3>Search for Roads</h3>
        <div className="search-box">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter road name (min 3 characters)"
            className="search-input"
          />
          <button 
            onClick={searchRoads} 
            disabled={searchQuery.length < 3 || isSearching}
            className="search-button"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {/* Map Container */}
        <div className="map-container">
          <div id="road-preferences-map" style={{ width: '100%', height: '400px' }}></div>
        </div>
        
        {/* Coordinate Information Box */}
        {showCoordinateInfo && startPoint && endPoint && (
          <div className="coordinate-info-box">
            <h3>Street Coordinates</h3>
            <p><strong>Start Point:</strong> Lat: {startPoint.lat.toFixed(6)}, Lng: {startPoint.lng.toFixed(6)}</p>
            <p><strong>End Point:</strong> Lat: {endPoint.lat.toFixed(6)}, Lng: {endPoint.lng.toFixed(6)}</p>
          </div>
        )}
        
        {searchResults.length > 0 && (
          <div className="search-results">
            <h4>Search Results</h4>
            <ul className="results-list">
              {searchResults.map(result => (
                <li
                  key={result.id}
                  className={selectedResult?.id === result.id ? 'selected' : ''}
                  onClick={() => handleResultClick(result)}
                >
                  <span className="road-name">{result.name}</span>
                  {result.road_type && <span className="road-type">{result.road_type}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Arama sonuçları yoksa ve arama yapıldıysa mesaj */}
        {!isSearching && searchQuery.length >= 3 && searchResults.length === 0 && (
             <p>Arama sonucu bulunamadı.</p>
        )}

        {/* Preference Form - Geocoding sonucu seçildiğinde gösterilmez */}
        {selectedResult && (
             <div className="selected-result-info">
                 <h4>Seçilen Konum: {selectedResult.name}</h4>
                 <p>Koordinatlar: {selectedResult.lat?.toFixed(6)}, {selectedResult.lon?.toFixed(6)}</p>
                 {/* Tercih ekleme butonları buraya gelmemeli */}
             </div>
        )}
      </div>
      
      {/* Current Preferences Section */}
      <div className="current-preferences">
        <div className="preferred-roads">
          <h3>Tercih Edilen Yollar</h3>
          {preferredRoads.length === 0 ? (
            <p>Tercih edilen yol bulunmuyor</p>
          ) : (
            <ul className="preference-list">
              {preferredRoads.map(pref => (
                <li key={pref.id}>
                  <div className="preference-info">
                    <span className="road-name">{pref.road_name}</span>
                    {pref.reason && <span className="reason">{pref.reason}</span>}
                  </div>
                  <button 
                    onClick={() => removePreference(pref.id, 'prefer')}
                    className="remove-button"
                  >
                    Kaldır
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="avoided-roads">
          <h3>Kaçınılan Yollar</h3>
          {avoidedRoads.length === 0 ? (
            <p>Kaçınılan yol bulunmuyor</p>
          ) : (
            <ul className="preference-list">
              {avoidedRoads.map(pref => (
                <li key={pref.id}>
                  <div className="preference-info">
                    <span className="road-name">{pref.road_name}</span>
                    {pref.reason && <span className="reason">{pref.reason}</span>}
                  </div>
                  <button 
                    onClick={() => removePreference(pref.id, 'avoid')}
                    className="remove-button"
                  >
                    Kaldır
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      {/* Preference Profiles Section */}
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
                        setAsDefault(profile.id);
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
                onClick={updateProfileMultipliers}
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
              className="profile-input"
            />
            <textarea
              value={newProfileDescription}
              onChange={(e) => setNewProfileDescription(e.target.value)}
              placeholder="Description (optional)"
              className="profile-description-input"
            />
            <button 
              onClick={createProfile}
              disabled={!newProfileName}
              className="create-button"
            >
              Create Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoadPreferencesComponent;
