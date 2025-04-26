import requests
# import polyline # Kaldırıldı (HERE polyline için)
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from datetime import datetime
from users.models import UserProfile
from routing.models import UserRoadPreference, RoutePreferenceProfile, UserAreaPreference
from django.utils import timezone
import json
import logging
import os # Dosya yolu için eklendi
import time # Zaman ölçümü için eklendi
import math # Matematik işlemleri için eklendi
from django.contrib.gis.geos import Point # Koordinat kontrolü için eklendi (GeoDjango gerekmez)
from decimal import Decimal # Decimal ile karşılaştırma için eklendi

# Gerekli olabilecek yeni importlar (Placeholder)
import networkx as nx # networkx import edildi
import osmnx as ox # osmnx import edildi
from geopy.distance import great_circle # Heuristic için eklendi

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Graf Yükleme (Global Değişkenle) --- 
GRAPH_FILE_PATH = os.path.join(settings.BASE_DIR, 'data', 'ankara_drive.graphml')
GRAPH = None
GRAPH_LOAD_TIME = None
GRAPH_URL = os.environ.get('GRAPH_URL', 'https://example.com/path/to/ankara_drive.graphml') # URL'yi ayarla (örneğin: bir bulut depolama servisi)

def download_file(url, destination_file_name):
    """Downloads a file from the given URL to the specified local path."""
    # Ensure the directory exists
    directory = os.path.dirname(destination_file_name)
    logger.info(f"directory: {directory}")
    if not os.path.exists(directory):
        os.makedirs(directory)
        logger.info(f"Created directory {directory}.")

    try:
        # Send GET request to download the file
        response = requests.get(url)
        
        # Check if the request was successful
        if response.status_code == 200:
            with open(destination_file_name, 'wb') as f:
                f.write(response.content)
            logger.info(f"Downloaded file from {url} to local file {destination_file_name}.")
        else:
            logger.error(f"Failed to download file. HTTP Status Code: {response.status_code}")
            raise Exception(f"Failed to download file. Status Code: {response.status_code}")
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        raise

def load_graph_once():
    """Load the graph file from disk only once and store it in a global variable."""
    global GRAPH, GRAPH_LOAD_TIME
    if GRAPH is None:
        start_time = time.time()

        # Check if the graph file exists locally
        if os.path.exists(GRAPH_FILE_PATH):
            logger.info(f"Loading graph from {GRAPH_FILE_PATH} (this happens only once)...")
        else:
            # If the graph file does not exist locally, attempt to download it
            logger.info(f"Graph file not found at {GRAPH_FILE_PATH}. Attempting to download from URL...")
            download_file(GRAPH_URL, GRAPH_FILE_PATH)
            

        # Load the graph after download or from disk
        if os.path.exists(GRAPH_FILE_PATH):
            GRAPH = ox.load_graphml(GRAPH_FILE_PATH)
            GRAPH_LOAD_TIME = time.time() - start_time
            logger.info(f"Graph loaded successfully in {GRAPH_LOAD_TIME:.2f} seconds.")
        else:
            logger.error(f"Graph file still not found after download attempt. Cannot load the graph.")
            GRAPH = None  # You might want to handle this case more gracefully, depending on your app needs.

    return GRAPH

# Sunucu başladığında grafı yüklemeyi dene
load_graph_once()
# ---------------------------------------

# --- A* Heuristic Fonksiyonu --- 
def distance_heuristic(u, v, graph, mode='driving'):
    """A* için Haversine mesafesi heuristic fonksiyonu."""
    # Hedef düğümün koordinatlarını al
    # Not: graph değişkeni burada global veya parametre olarak alınabilir.
    # load_graph_once() çağrısı sonrası GRAPH global değişkeni dolu olmalı.
    target_node_data = graph.nodes[v]
    current_node_data = graph.nodes[u]
    
    # Koordinatlar (latitude, longitude) sırasıyla olmalı
    target_coords = (target_node_data['y'], target_node_data['x'])
    current_coords = (current_node_data['y'], current_node_data['x'])
    
    # Mesafeyi kilometre olarak hesapla
    distance_km = great_circle(current_coords, target_coords).km
    
    # Modlara göre ortalama hızlar (km/h) - Ayarlanabilir
    avg_speeds = {
        'driving': 50,
        'walking': 5,
        'cycling': 15,
    }
    avg_speed = avg_speeds.get(mode, 50) # Bilinmeyen mod için sürüş hızı
    # saniye/km = 3600 / km/h
    seconds_per_km = 3600 / avg_speed 
    estimated_time_seconds = distance_km * seconds_per_km
    return estimated_time_seconds
# -----------------------------

# --- A* Ağırlık Fonksiyonu (Yeni) --- 
WALKING_SPEED_MPS = 1.39 # Yaklaşık 5 km/h (metre/saniye)
CYCLING_SPEED_MPS = 4.17 # Yaklaşık 15 km/h (metre/saniye)

def calculate_travel_time(u, v, edge_data, mode='driving'):
    """Kenar için seyahat süresini moda göre hesaplar."""
    length_meters = edge_data.get('length')
    if length_meters is None:
        return float('inf') # Uzunluk yoksa bu yolu kullanma
    
    if mode == 'walking':
        # Uzunluk / yürüme hızı (m/s)
        return length_meters / WALKING_SPEED_MPS
    elif mode == 'cycling':
        # Uzunluk / bisiklet hızı (m/s)
        # İleride OSM'den bisiklet hızları veya yol tipleri eklenebilir
        return length_meters / CYCLING_SPEED_MPS
    else: # driving (varsayılan)
        # osmnx tarafından eklenen travel_time kullan
        # Eğer travel_time yoksa, hızdan hesapla (fallback)
        travel_time = edge_data.get('travel_time')
        if travel_time is not None:
            return travel_time
        else:
            # Fallback: Hız varsa kullan, yoksa varsayılan sürüş hızı (örn: 50km/h)
            speed_kmh = edge_data.get('speed_kph', 50) 
            speed_mps = speed_kmh * 1000 / 3600
            if speed_mps > 0:
                return length_meters / speed_mps
            else:
                return float('inf') # Hız sıfırsa veya negatifse yolu kullanma
# -----------------------------------

# --- HereRoutingService Sınıfı Kaldırıldı --- 
# class HereRoutingService:
#    ...
# -------------------------------------------

class DirectionsView(APIView):
    permission_classes = [IsAuthenticatedOrReadOnly]
    
    def post(self, request):
        # try bloğunun başına taşıyalım ki except içinde erişebilelim
        start_node = None
        end_node = None
        graph = None
        user = request.user
        user_profile = None
        prefer_multiplier = 1.0 # Varsayılan
        avoid_multiplier = 1.0  # Varsayılan
        area_preferences = [] # Alan tercihleri listesi
        road_preferences = {} # Yol ID'sine göre tercih tipi (hızlı erişim için dict)
        
        try:
            # Extract coordinates from request
            start_coords = request.data.get('start')
            end_coords = request.data.get('end')
            
            # Get optional parameters
            departure_time_str = request.data.get('departure_time') # İleride kullanılabilir
            # Başlangıçta seçilen mod önemli
            initial_transport_mode = request.data.get('transport_mode', 'driving') 
            
            # --- Parametre Kontrolleri --- 
            if not start_coords or not end_coords:
                return Response(
                    {"error": "Start and end coordinates are required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not isinstance(start_coords, dict) or 'lat' not in start_coords or 'lng' not in start_coords:
                return Response({"error": "Invalid start coordinate format"}, status=status.HTTP_400_BAD_REQUEST)
            if not isinstance(end_coords, dict) or 'lat' not in end_coords or 'lng' not in end_coords:
                 return Response({"error": "Invalid end coordinate format"}, status=status.HTTP_400_BAD_REQUEST)

            logger.info(f"Route requested from {start_coords} to {end_coords} via {initial_transport_mode}")

            # Oturum açmış kullanıcılar için tercihleri yükle
            if user.is_authenticated:
                try:
                    user_profile = UserProfile.objects.get(user=user)
                    # Varsayılan profili veya seçili profili al (şimdilik varsayılan)
                    profile = RoutePreferenceProfile.objects.filter(user=user_profile, is_default=True).first()
                    if profile:
                        prefer_multiplier = profile.prefer_multiplier
                        avoid_multiplier = profile.avoid_multiplier
                        logger.info(f"User profile found: {user.username}, Multipliers: Prefer={prefer_multiplier}, Avoid={avoid_multiplier}")
                    else:
                         logger.warning(f"Default profile not found for user: {user.username}")

                    # Alan Tercihlerini Yükle
                    area_preferences = list(UserAreaPreference.objects.filter(user=user))
                    logger.info(f"Loaded {len(area_preferences)} area preferences for user: {user.username}")
                    
                    # Yol Tercihlerini Yükle (Dict olarak)
                    prefs = UserRoadPreference.objects.filter(user=user_profile).select_related('road_segment')
                    for pref in prefs:
                        road_preferences[pref.road_segment.osm_id] = pref.preference_type
                    logger.info(f"Loaded {len(road_preferences)} road preferences for user: {user.username}")

                except UserProfile.DoesNotExist:
                    logger.warning(f"UserProfile not found for authenticated user: {user.username}")
                except Exception as e:
                     logger.exception(f"Error loading user preferences: {e}")

            # --- A* Rota Hesaplama Mantığı --- 
            # 1. Yol ağını yükle
            graph = load_graph_once() 
            if graph is None: return Response({"error": "Road network graph is not loaded. Please check server logs."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # 2. Başlangıç/Bitiş noktalarına en yakın graf düğümlerini bul
            start_node = ox.nearest_nodes(graph, start_coords['lng'], start_coords['lat'])
            end_node = ox.nearest_nodes(graph, end_coords['lng'], end_coords['lat'])
            logger.info(f"Nearest nodes found: Start={start_node}, End={end_node}")
            
            # ---- Tüm Modlar İçin Süre Hesaplama ----
            all_durations = {}
            route_nodes = None # Geometri için kullanılacak rota düğümleri
            relevant_modes = ['driving', 'walking', 'cycling'] # Hesaplanacak modlar
            
            for mode in relevant_modes:
                logger.info(f"Calculating duration for mode: {mode}")
                # 3. Güncellenmiş Ağırlık Fonksiyonu
                def weight_wrapper(u, v, edge_attr_dict):
                    edge_data = edge_attr_dict[0] # Genellikle ilk kenar verisi kullanılır
                    base_travel_time = calculate_travel_time(u, v, edge_data, mode=mode)
                    
                    # Başlangıçta maliyet sonsuzsa, daha fazla hesaplama yapma
                    if base_travel_time == float('inf'):
                        return float('inf')

                    multiplier = 1.0
                    osm_id = edge_data.get('osmid')
                    
                    # --- Alan Tercihlerini Uygula --- 
                    # Kenarın orta noktasının koordinatlarını al (yaklaşık)
                    # Daha doğru bir yöntem, kenarın geometrisini kontrol etmek olurdu (GeoDjango ile)
                    u_data = graph.nodes[u]
                    v_data = graph.nodes[v]
                    edge_mid_lat = Decimal((u_data['y'] + v_data['y']) / 2)
                    edge_mid_lon = Decimal((u_data['x'] + v_data['x']) / 2)
                    # logger.debug(f"Edge ({u}-{v}): Midpoint ({edge_mid_lat:.6f}, {edge_mid_lon:.6f})") # Daha detaylı loglama için açılabilir

                    for area_pref in area_preferences:
                        # Koordinatlar alanın içinde mi kontrol et
                        if (area_pref.min_lat <= edge_mid_lat <= area_pref.max_lat and
                            area_pref.min_lon <= edge_mid_lon <= area_pref.max_lon):
                            if area_pref.preference_type == 'avoid':
                                multiplier *= avoid_multiplier
                                # logger.info(f"--> Edge ({u}-{v}) MIDPOINT ({edge_mid_lat:.6f}, {edge_mid_lon:.6f}) is inside AVOID area {area_pref.id}. Multiplier applied: {avoid_multiplier:.2f}. New total multiplier: {multiplier:.2f}") # Loglama kaldırıldı
                                # logger.debug(f"Edge ({u}-{v}) in AVOID area {area_pref.id}, multiplier now: {multiplier}")
                                break # İlk eşleşen alana göre işlem yap (veya en kötü durumu al?)
                            elif area_pref.preference_type == 'prefer':
                                multiplier *= prefer_multiplier
                                # logger.info(f"--> Edge ({u}-{v}) MIDPOINT ({edge_mid_lat:.6f}, {edge_mid_lon:.6f}) is inside PREFER area {area_pref.id}. Multiplier applied: {prefer_multiplier:.2f}. New total multiplier: {multiplier:.2f}") # Loglama kaldırıldı
                                # logger.debug(f"Edge ({u}-{v}) in PREFER area {area_pref.id}, multiplier now: {multiplier}")
                                break # İlk eşleşen alana göre işlem yap
                    # --------------------------------
                    
                    # --- Yol Tercihlerini Uygula ---
                    current_osm_id = edge_data.get('osmid')
                    preference_applied = False # Bu kenar için tercih uygulandı mı?

                    if isinstance(current_osm_id, list):
                        # Eğer osm_id bir listeyse, her birini kontrol et
                        for single_osm_id in current_osm_id:
                            if single_osm_id in road_preferences:
                                pref_type = road_preferences[single_osm_id]
                                if pref_type == 'avoid':
                                    multiplier *= avoid_multiplier 
                                    # logger.debug(f"Edge osm_id {single_osm_id} (in list) is AVOIDED, multiplier now: {multiplier}")
                                elif pref_type == 'prefer':
                                     multiplier *= prefer_multiplier
                                    # logger.debug(f"Edge osm_id {single_osm_id} (in list) is PREFERRED, multiplier now: {multiplier}")
                                preference_applied = True
                                break # Listeden ilk eşleşen tercihi uygula ve çık
                    elif current_osm_id is not None:
                         # Eğer osm_id tek bir değerse (int veya str)
                         if current_osm_id in road_preferences:
                            pref_type = road_preferences[current_osm_id]
                            if pref_type == 'avoid':
                                multiplier *= avoid_multiplier
                                # logger.debug(f"Edge osm_id {current_osm_id} is AVOIDED, multiplier now: {multiplier}")
                            elif pref_type == 'prefer':
                                 multiplier *= prefer_multiplier
                                # logger.debug(f"Edge osm_id {current_osm_id} is PREFERRED, multiplier now: {multiplier}")
                            preference_applied = True
                    # -------------------------------

                    final_cost = base_travel_time * multiplier
                    # logger.debug(f"Edge ({u}-{v}) BaseTime: {base_travel_time:.2f}, Multiplier: {multiplier:.2f}, FinalCost: {final_cost:.2f}")
                    return final_cost
                
                # 4. Heuristic fonksiyonu (moda göre)
                def heuristic_wrapper(u, v):
                    return distance_heuristic(u, v, graph, mode=mode)
                
                try:
                    # 5. A* algoritmasını çalıştır
                    path_nodes = nx.astar_path(graph, start_node, end_node, heuristic=heuristic_wrapper, weight=weight_wrapper)
                    
                    # Başlangıç modu için rota düğümlerini sakla (geometri için)
                    if mode == initial_transport_mode:
                        route_nodes = path_nodes
                        logger.info(f"Path nodes for geometry (mode: {mode}) stored: {len(route_nodes)} nodes.")
                    
                    # Toplam süreyi hesapla
                    duration = 0
                    for u, v in zip(path_nodes[:-1], path_nodes[1:]):
                        edge_data = graph.get_edge_data(u, v, key=0)
                        if edge_data:
                            duration += calculate_travel_time(u, v, edge_data, mode=mode) 
                        else:
                            logger.warning(f"Edge data not found between nodes {u} and {v} for mode {mode}")
                            duration = float('inf') # Hata durumunda süreyi sonsuz yap
                            break
                            
                    if duration == float('inf'):
                         logger.warning(f"Could not calculate valid duration for mode: {mode}")
                         all_durations[mode] = None # Süre hesaplanamadıysa null ata
                    else: 
                        all_durations[mode] = duration
                        logger.info(f"Calculated duration for {mode}: {duration:.2f}s")

                except nx.NetworkXNoPath:
                    logger.warning(f"No path found between nodes for mode: {mode}")
                    all_durations[mode] = None # Rota yoksa null ata
                except Exception as mode_e:
                    logger.exception(f"Error calculating route for mode {mode}: {mode_e}")
                    all_durations[mode] = None # Hata durumunda null ata
            # ----------------------------------------

            # Geometri için kullanılacak rota düğümleri bulundu mu kontrol et
            if route_nodes is None:
                # Başlangıç modu için rota bulunamadıysa veya hata oluştuysa
                logger.error(f"Could not determine path nodes for the initial mode: {initial_transport_mode}")
                # Belki ilk başarılı olan modun geometrisini kullanabilir veya hata dönebiliriz
                # Şimdilik hata dönelim
                return Response({"error": f"Could not calculate route for the selected mode ({initial_transport_mode})"}, status=status.HTTP_404_NOT_FOUND)
            
            # 6. Sonucu (geometri, süreler, mesafe) formatla
            route_geometry = {
                "type": "LineString",
                "coordinates": [ [graph.nodes[node]['x'], graph.nodes[node]['y']] for node in route_nodes ]
            }
            
            # Toplam mesafeyi hesapla (geometriyi oluşturan rotaya göre)
            total_distance = 0
            route_steps = []
            prev_bearing = None

            for i in range(len(route_nodes) - 1):
                u = route_nodes[i]
                v = route_nodes[i + 1]
                edge_data = graph.get_edge_data(u, v, key=0)
                
                if edge_data:
                    # Mesafe hesapla
                    step_distance = edge_data.get('length', 0)
                    total_distance += step_distance

                    # Yön hesapla (bearing)
                    u_lat, u_lon = graph.nodes[u]['y'], graph.nodes[u]['x']
                    v_lat, v_lon = graph.nodes[v]['y'], graph.nodes[v]['x']
                    
                    # İki nokta arasındaki açıyı hesapla
                    y = math.sin(v_lon - u_lon) * math.cos(v_lat)
                    x = math.cos(u_lat) * math.sin(v_lat) - math.sin(u_lat) * math.cos(v_lat) * math.cos(v_lon - u_lon)
                    bearing = math.degrees(math.atan2(y, x))
                    bearing = (bearing + 360) % 360  # 0-360 arasına normalize et

                    # Dönüş yönünü belirle
                    if prev_bearing is not None:
                        angle_diff = ((bearing - prev_bearing + 180) % 360) - 180
                        if angle_diff < -30:  # Changed from > to <
                            maneuver = 'turn-right'
                            instruction = f"Turn right and continue for {int(step_distance)} meters"
                        elif angle_diff > 30:  # Changed from < to >
                            maneuver = 'turn-left'
                            instruction = f"Turn left and continue for {int(step_distance)} meters"
                        else:
                            maneuver = 'straight'
                            instruction = f"Continue straight for {int(step_distance)} meters"
                    else:
                        maneuver = 'straight'
                        instruction = f"Head straight for {int(step_distance)} meters"

                    # Adımı ekle
                    route_steps.append({
                        'instruction': instruction,
                        'distance': step_distance,
                        'duration': calculate_travel_time(u, v, edge_data, mode=initial_transport_mode),
                        'maneuver': maneuver
                    })

                    prev_bearing = bearing
                else:
                    logger.warning(f"Edge data not found between nodes {u} and {v} for distance calculation!")
            
            logger.info(f"Calculated distance for initial mode ({initial_transport_mode}): {total_distance:.2f}m")
            logger.info(f"Generated {len(route_steps)} route steps")

            # Yanıtı oluştur (tüm süreleri içeren)
            route_response = {
                "routes": [{
                    "geometry": route_geometry,
                    "legs": [], # Legs şimdilik boş
                    "duration": all_durations.get(initial_transport_mode), 
                    "distance": total_distance,
                    "durations_by_mode": all_durations,
                    "steps": route_steps  # Adımları ekle
                }]
            }
            # ---------------------------------------------------

            return Response(route_response, status=status.HTTP_200_OK)
            
        except nx.NetworkXNoPath:
             logger.warning(f"No path found between requested points") # Düğüm ID'leri artık burada yok
             return Response({"error": "No path found between the selected points"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception(f"Error in DirectionsView during A* calculation: {str(e)}") 
            return Response(
                {"error": "Internal server error during route calculation.", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    # --- _transform_here_response Metodu Kaldırıldı --- 
    # def _transform_here_response(self, here_response):
    #    ...
    # ---------------------------------------------------

    # --- _decode_flexible_polyline Metodu Kaldırıldı --- 
    # def _decode_flexible_polyline(self, encoded):
    #    ...
    # ---------------------------------------------------
