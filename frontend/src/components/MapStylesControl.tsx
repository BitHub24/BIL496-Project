import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapStylesControl.css';
import axios from 'axios';

// Map style definitions
const MAP_STYLES = {
  standard: {
    name: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  },
  light: {
    name: 'Light',
    url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors, © CARTO',
    maxZoom: 19
  },
  dark: {
    name: 'Dark',
    url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors, © CARTO',
    maxZoom: 19
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19
  },
  transport: {
    name: 'Transport',
    url: 'https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=6170aad10dfd42a38d4d8c709a536f38',
    attribution: '© OpenStreetMap contributors, Maps © Thunderforest',
    maxZoom: 19
  },
  outdoors: {
    name: 'Outdoors',
    url: 'https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=6170aad10dfd42a38d4d8c709a536f38',
    attribution: '© OpenStreetMap contributors, Maps © Thunderforest',
    maxZoom: 19
  }
};

// Trafik katmanı için stil fonksiyonu
const getTrafficStyle = (feature: any): L.PathOptions => {
  // Varsayım: feature.properties.severity değeri 'low', 'medium', 'high' olabilir
  // Veya feature.properties.congestion (0-1 arası bir sayı)
  const severity = feature?.properties?.severity || feature?.properties?.congestion_level || 'unknown'; 
  const congestion = typeof severity === 'number' ? severity : -1;

  let color = '#808080'; // Default color (gri)
  let weight = 3;
  let opacity = 0.65;

  if (congestion >= 0.7 || severity === 'high' || severity === 'heavy') {
    color = '#FF0000'; // Kırmızı (Yüksek yoğunluk)
  } else if (congestion >= 0.4 || severity === 'medium') {
    color = '#FFA500'; // Turuncu/Sarı (Orta yoğunluk)
  } else if (congestion >= 0 || severity === 'low' || severity === 'light') {
    color = '#008000'; // Yeşil (Düşük yoğunluk)
  }

  return {
    color: color,
    weight: weight,
    opacity: opacity
  };
};

// Backend'den dönen yanıt tipi (varsayımsal)
interface TrafficApiResponse {
  meta: any; // Meta veri
  data: GeoJSON.FeatureCollection; // GeoJSON verisi
}

interface MapStylesControlProps {
  map: L.Map | null;
  isOpen: boolean;
  onToggle: () => void;
}

const MapStylesControl: React.FC<MapStylesControlProps> = ({ map, isOpen, onToggle }) => {
  // State'leri doğrudan localStorage'dan okuyarak başlat
  const [currentStyle, setCurrentStyle] = useState<string>(
    () => localStorage.getItem('mapStyle') || 'standard'
  );
  const [showTraffic, setShowTraffic] = useState<boolean>(
    () => localStorage.getItem('showTraffic') === 'true'
  );
  
  const [baseLayer, setBaseLayer] = useState<L.TileLayer | null>(null);
  const [trafficLayer, setTrafficLayer] = useState<L.GeoJSON | null>(null);
  const [isTrafficLoading, setIsTrafficLoading] = useState<boolean>(false);
  const [trafficError, setTrafficError] = useState<string | null>(null);

  // Temel harita katmanını ve (gerekirse) trafik katmanını başlat
  useEffect(() => {
    if (!map) return;
    
    console.log(`[MapInit Effect] Initializing map. Style: ${currentStyle}, Traffic: ${showTraffic}`);

    // 1. Mevcut baseLayer'ı kaldır (varsa)
    if (baseLayer) {
        try { map.removeLayer(baseLayer); } catch(e) {} 
    }
    // 2. Mevcut trafficLayer'ı kaldır (varsa) - toggleTraffic içinde de yapılıyor ama garanti olsun
    if (trafficLayer) {
        try { map.removeLayer(trafficLayer); } catch(e) {} 
        setTrafficLayer(null); // State'i de sıfırla
    }

    // 3. Yeni baseLayer'ı ekle (currentStyle'a göre)
    const styleKey = currentStyle as keyof typeof MAP_STYLES;
    const style = MAP_STYLES[styleKey] || MAP_STYLES.standard;
    const newBaseLayer = L.tileLayer(style.url, {
      attribution: style.attribution,
      maxZoom: style.maxZoom
    }).addTo(map);
    setBaseLayer(newBaseLayer);
    console.log(`[MapInit Effect] Base layer added: ${styleKey}`);

    // 4. Başlangıçta trafik gösterilmesi gerekiyorsa yükle
    if (showTraffic) {
        console.log('[MapInit Effect] Initial traffic is enabled, fetching...');
        // Fetch işlemi zaten isTrafficLoading kontrolü yapıyor
        fetchAndDisplayTraffic(map);
    } else {
        // Trafik kapalıysa yükleniyor ve hata durumlarını sıfırla
        setIsTrafficLoading(false);
        setTrafficError(null);
    }

    // Cleanup sadece baseLayer için olabilir, trafik toggle içinde yönetiliyor
    return () => {
      if (map && newBaseLayer) {
          try { map.removeLayer(newBaseLayer); } catch(e) {} 
          console.log(`[MapInit Effect Cleanup] Base layer removed: ${styleKey}`);
      }
    };
  // currentStyle değişince de çalışsın ki stil butonları haritayı güncelleyebilsin
  }, [map, currentStyle]); 

  // Trafik verisini çeken ve gösteren fonksiyon
  const fetchAndDisplayTraffic = async (currentMap: L.Map) => {
    if (!currentMap) return;

    // Check for token BEFORE making the request
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('[Traffic] Token not found in localStorage. Skipping traffic fetch.');
      setIsTrafficLoading(false);
      setTrafficError('Authentication token not found. Please log in again.'); // Show error to user
      // Optionally remove existing layer if token disappears mid-session
      if (trafficLayer) {
        try { currentMap.removeLayer(trafficLayer); } catch(e) {}
        setTrafficLayer(null);
      }      
      return; // Don't proceed if no token
    }
    
    setIsTrafficLoading(true);
    setTrafficError(null);
    console.log('[Traffic] Fetching traffic data...');

    try {
        const response = await axios.get<TrafficApiResponse>(
            `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/traffic/latest/`,
            { 
                headers: { 'Authorization': `Token ${token}` } // Use the token variable we already fetched
            }
        );

        // Fetch başarılı olduğunda mevcut katmanı kaldır
        if (trafficLayer) {
            try { currentMap.removeLayer(trafficLayer); } catch(e) {}
        }

        console.log('[Traffic] Data received, creating GeoJSON layer.');
        if (!response.data || !response.data.data || !response.data.data.features) {
            console.error('[Traffic] Invalid GeoJSON data received from API.');
            setTrafficError('Invalid traffic data format.');
            setTrafficLayer(null); 
            return;
        }
        
        const geoJsonLayer = L.geoJSON(response.data.data, {
            style: getTrafficStyle
        }).addTo(currentMap);
        
        setTrafficLayer(geoJsonLayer); // Yeni katmanı state'e ata

    } catch (error: any) {
        console.error('[Traffic] Error fetching traffic data:', error);
        setTrafficError('Failed to load traffic data.');
        // Hata durumunda da mevcut katmanı kaldır (varsa)
        if (trafficLayer) {
            try { currentMap.removeLayer(trafficLayer); } catch(e) {}
            setTrafficLayer(null);
        }
    } finally {
        setIsTrafficLoading(false);
    }
  };

  // Harita stilini değiştir
  const changeMapStyle = (styleKey: string) => {
    if (!map || !MAP_STYLES[styleKey as keyof typeof MAP_STYLES] || currentStyle === styleKey) return;
    console.log(`[changeMapStyle] Changing style to: ${styleKey}`);
    // Sadece state'i güncelle, useEffect tetiklenip haritayı yenileyecek
    setCurrentStyle(styleKey);
    localStorage.setItem('mapStyle', styleKey);
    // Stil değişince trafik katmanı üstte kalsın diye bringToFront ekleyelim
    // Bu useEffect içinde yapılmalı aslında ama basitlik için burada deneyebiliriz
    // Daha iyi yöntem: baseLayer eklendikten sonra trafficLayer'ı tekrar eklemek
    // if (trafficLayer) {
    //    trafficLayer.bringToFront();
    // }
  };

  // Trafik katmanını aç/kapat
  const toggleTraffic = (show: boolean) => {
    if (!map) return;
    // State'i ve localStorage'ı güncelle
    setShowTraffic(show);
    localStorage.setItem('showTraffic', show.toString());
    console.log(`[toggleTraffic] Setting showTraffic to: ${show}`);

    if (show) {
        // Açılıyorsa ve zaten yüklenmiyorsa fetch et
        if (!isTrafficLoading) {
             console.log('[toggleTraffic] Fetching traffic...');
             fetchAndDisplayTraffic(map);
        }
    } else {
        // Kapatılıyorsa katmanı kaldır ve state'leri sıfırla
        console.log('[toggleTraffic] Removing traffic layer...');
        if (trafficLayer) {
            try { map.removeLayer(trafficLayer); } catch(e) {} 
            setTrafficLayer(null);
        }
        setIsTrafficLoading(false); 
        setTrafficError(null);
    }
  };

  return (
    <div className={`map-styles-control ${isOpen ? 'open' : ''}`}>
      <button 
        className="toggle-button" 
        onClick={onToggle}
        title="Map Styles"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"/>
        </svg>
      </button>
      
      {isOpen && (
        <div className="styles-panel">
          <h3>Map Style</h3>
          <div className="style-options">
            {Object.entries(MAP_STYLES).map(([key, style]) => (
              <button
                key={key}
                className={`style-button ${currentStyle === key ? 'active' : ''}`}
                data-style={key}
                onClick={() => changeMapStyle(key)}
              >
                {style.name}
              </button>
            ))}
          </div>
          
          <div className="traffic-toggle">
            <label>
              <input
                type="checkbox"
                checked={showTraffic}
                onChange={(e) => toggleTraffic(e.target.checked)}
                disabled={isTrafficLoading} // Yüklenirken disable et
              />
              Show Traffic
              {isTrafficLoading && <span className="loading-spinner"></span>} {/* Yüklenme göstergesi */} 
            </label>
            {trafficError && <div className="traffic-error">{trafficError}</div>} {/* Hata mesajı */} 
          </div>
        </div>
      )}
    </div>
  );
};

export default MapStylesControl;
