from typing import List, Tuple, Dict
from .osm_loader import OSMLoader
from .astar import RoutingGraph, haversine_distance

class RoutingService:
    def __init__(self, osm_file: str):
        loader = OSMLoader()
        loader.load_osm(osm_file)
        self.graph = loader.get_graph()
        self._build_spatial_index()

    def _build_spatial_index(self):
        """Build a simple spatial index for faster nearest node lookup."""
        self.spatial_index: Dict[Tuple[int, int], List[int]] = {}
        grid_size = 0.01  # About 1km grid cells

        for node_id, node in self.graph.nodes.items():
            grid_x = int(node.lon / grid_size)
            grid_y = int(node.lat / grid_size)
            key = (grid_x, grid_y)
            
            if key not in self.spatial_index:
                self.spatial_index[key] = []
            self.spatial_index[key].append(node_id)

    def _find_nearest_node(self, lat: float, lon: float) -> int:
        """Find the nearest node to given coordinates."""
        grid_size = 0.01
        grid_x = int(lon / grid_size)
        grid_y = int(lat / grid_size)
        
        # Search in current and adjacent grid cells
        nearest_node = None
        min_distance = float('inf')
        
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                key = (grid_x + dx, grid_y + dy)
                if key in self.spatial_index:
                    for node_id in self.spatial_index[key]:
                        node = self.graph.nodes[node_id]
                        dist = haversine_distance(lat, lon, node.lat, node.lon)
                        if dist < min_distance:
                            min_distance = dist
                            nearest_node = node_id
        
        return nearest_node

    def calculate_route(self, 
                       start_lat: float, 
                       start_lon: float,
                       end_lat: float,
                       end_lon: float) -> Tuple[List[Tuple[float, float]], float]:
        """Calculate route between two points."""
        # Find nearest nodes to start and end points
        start_node = self._find_nearest_node(start_lat, start_lon)
        end_node = self._find_nearest_node(end_lat, end_lon)
        
        if not start_node or not end_node:
            return [], 0
            
        # Calculate route using A*
        path, distance = self.graph.astar(start_node, end_node)
        
        if not path:
            return [], 0
            
        # Convert node IDs to coordinates
        route_geometry = self.graph.get_route_geometry(path)
        
        return route_geometry, distance 