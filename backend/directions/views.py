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
from routing.models import UserRoadPreference, RoutePreferenceProfile
from django.utils import timezone
import json
import logging
import os # Dosya yolu için eklendi
import time # Zaman ölçümü için eklendi
import math # Matematik işlemleri için eklendi

# Gerekli olabilecek yeni importlar (Placeholder)
import networkx as nx # networkx import edildi
import osmnx as ox # osmnx import edildi
from geopy.distance import great_circle # Heuristic için eklendi

logger = logging.getLogger(__name__)

# --- Graf Yükleme (Global Değişkenle) --- 
GRAPH_FILE_PATH = os.path.join(settings.BASE_DIR, 'data', 'ankara_drive.graphml')
GRAPH = None # Global değişken
GRAPH_LOAD_TIME = None

def load_graph_once():
    """Graf dosyasını diskten sadece bir kez yükler ve global değişkende saklar."""
    global GRAPH, GRAPH_LOAD_TIME
    if GRAPH is None:
        start_time = time.time()
        if os.path.exists(GRAPH_FILE_PATH):
            logger.info(f"Loading graph from {GRAPH_FILE_PATH} (this happens only once)...")
            GRAPH = ox.load_graphml(GRAPH_FILE_PATH)
            GRAPH_LOAD_TIME = time.time() - start_time
            logger.info(f"Graph loaded successfully in {GRAPH_LOAD_TIME:.2f} seconds.")
        else:
            logger.error(f"Graph file not found at {GRAPH_FILE_PATH}! Run 'python manage.py create_graph' first.")
            # Sunucu başlangıcında hata vermek veya boş bir graf ile devam etmek yerine None bırakabiliriz.
            # İstek sırasında kontrol edilecek.
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
                # 3. Ağırlık fonksiyonu (moda göre)
                def weight_wrapper(u, v, edge_attr):
                    return calculate_travel_time(u, v, edge_attr[0], mode=mode)
                
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
