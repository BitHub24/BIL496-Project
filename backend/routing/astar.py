from typing import Dict, List, Set, Tuple, Optional
from math import radians, sin, cos, sqrt, atan2
import heapq
from datetime import datetime, time

class Node:
    def __init__(self, id: int, lat: float, lon: float):
        self.id = id
        self.lat = lat
        self.lon = lon
        self.adjacent: Dict[int, Dict[str, float]] = {}  # node_id -> {distance, speed_limit, way_id}
        self.turn_restrictions: Dict[Tuple[int, int], bool] = {}  # (from_id, to_id) -> allowed

    def add_edge(self, node_id: int, distance: float, speed_limit: float = 50.0, way_id: int = None):
        """Add edge with distance, speed limit (km/h), and way_id."""
        self.adjacent[node_id] = {
            'distance': distance,
            'speed_limit': speed_limit,
            'way_id': way_id
        }

    def add_turn_restriction(self, from_id: int, to_id: int, allowed: bool = False):
        """Add turn restriction from one node to another through this node."""
        self.turn_restrictions[(from_id, to_id)] = allowed

    def can_turn(self, from_id: int, to_id: int) -> bool:
        """Check if turn is allowed from one node to another through this node."""
        # If no restriction is specified, turn is allowed
        if (from_id, to_id) not in self.turn_restrictions:
            return True
        return self.turn_restrictions[(from_id, to_id)]

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on Earth."""
    R = 6371  # Earth's radius in kilometers

    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

class TrafficModel:
    """Simple traffic model based on time of day."""
    
    PEAK_HOURS = [
        (time(7, 0), time(10, 0)),   # Morning peak
        (time(16, 0), time(19, 0)),  # Evening peak
    ]
    
    @staticmethod
    def get_traffic_multiplier(current_time: datetime = None) -> float:
        """Get traffic multiplier based on time of day."""
        if current_time is None:
            current_time = datetime.now()
        
        current_time = current_time.time()
        
        # Check if current time is in peak hours
        for start, end in TrafficModel.PEAK_HOURS:
            if start <= current_time <= end:
                return 1.5  # 50% slower during peak hours
                
        # Night time (22:00 - 05:00)
        if time(22, 0) <= current_time or current_time <= time(5, 0):
            return 0.8  # 20% faster during night
            
        return 1.0  # Normal traffic

class UserPreferences:
    """Class to handle user road preferences."""
    
    def __init__(self, 
                 preferred_ways: Dict[int, float] = None, 
                 avoided_ways: Dict[int, float] = None):
        """
        Initialize user preferences.
        
        Args:
            preferred_ways: Dictionary of way_id -> multiplier (default 0.75)
            avoided_ways: Dictionary of way_id -> multiplier (default 3.0)
        """
        self.preferred_ways = preferred_ways or {}
        self.avoided_ways = avoided_ways or {}
        
        # Default multipliers
        self.default_prefer_multiplier = 0.75  # 25% faster
        self.default_avoid_multiplier = 3.0    # 3x slower
    
    def get_way_multiplier(self, way_id: int) -> float:
        """Get multiplier for a way based on user preferences."""
        if way_id in self.preferred_ways:
            return self.preferred_ways.get(way_id, self.default_prefer_multiplier)
        elif way_id in self.avoided_ways:
            return self.avoided_ways.get(way_id, self.default_avoid_multiplier)
        return 1.0  # No preference

class RoutingGraph:
    def __init__(self):
        self.nodes: Dict[int, Node] = {}

    def add_node(self, id: int, lat: float, lon: float):
        self.nodes[id] = Node(id, lat, lon)

    def add_edge(self, from_id: int, to_id: int, bidirectional: bool = True, 
                 speed_limit: float = 50.0, way_id: int = None):
        """Add edge with speed limit (km/h) and way_id."""
        if from_id not in self.nodes or to_id not in self.nodes:
            return

        from_node = self.nodes[from_id]
        to_node = self.nodes[to_id]
        
        # Calculate distance using haversine formula
        distance = haversine_distance(
            from_node.lat, from_node.lon,
            to_node.lat, to_node.lon
        )
        
        from_node.add_edge(to_id, distance, speed_limit, way_id)
        if bidirectional:
            to_node.add_edge(from_id, distance, speed_limit, way_id)

    def add_turn_restriction(self, node_id: int, from_id: int, to_id: int, allowed: bool = False):
        """Add turn restriction at a node."""
        if node_id in self.nodes:
            self.nodes[node_id].add_turn_restriction(from_id, to_id, allowed)

    def astar(self, start_id: int, goal_id: int, current_time: datetime = None, 
              user_preferences: UserPreferences = None) -> Tuple[List[int], float]:
        """A* path finding algorithm with turn restrictions, traffic, and user preferences."""
        if start_id not in self.nodes or goal_id not in self.nodes:
            return [], 0

        goal_node = self.nodes[goal_id]
        traffic_mult = TrafficModel.get_traffic_multiplier(current_time)
        
        # Use empty preferences if none provided
        if user_preferences is None:
            user_preferences = UserPreferences()
        
        # Priority queue of (f_score, node_id, prev_node_id)
        open_set = [(0, start_id, None)]
        # Keep track of where we came from
        came_from: Dict[int, Tuple[int, int]] = {}  # current -> (prev, prev_prev)
        
        # g_score[n] is the time cost of the cheapest path from start to n currently known
        g_score: Dict[int, float] = {start_id: 0}
        
        while open_set:
            current_f, current_id, prev_id = heapq.heappop(open_set)
            
            if current_id == goal_id:
                # Reconstruct path
                path = []
                current = current_id
                total_time = g_score[current_id]
                while current in came_from:
                    path.append(current)
                    current, _ = came_from[current]
                path.append(start_id)
                return path[::-1], total_time

            current_node = self.nodes[current_id]
            prev_prev_id = came_from.get(prev_id, (None, None))[0] if prev_id else None
            
            for neighbor_id, edge_data in current_node.adjacent.items():
                # Skip if turn is not allowed
                if prev_id and not current_node.can_turn(prev_id, neighbor_id):
                    continue

                # Calculate time cost based on distance, speed limit, traffic, and user preferences
                distance = edge_data['distance']
                speed = edge_data['speed_limit']
                way_id = edge_data.get('way_id')
                
                # Apply user preference multiplier if way_id is available
                preference_mult = 1.0
                if way_id is not None:
                    preference_mult = user_preferences.get_way_multiplier(way_id)
                
                # Final time cost calculation
                time_cost = (distance / speed) * traffic_mult * preference_mult  # hours
                
                # Tentative g_score
                tentative_g = g_score[current_id] + time_cost
                
                if neighbor_id not in g_score or tentative_g < g_score[neighbor_id]:
                    # This path is better than any previous one
                    came_from[neighbor_id] = (current_id, prev_id)
                    g_score[neighbor_id] = tentative_g
                    
                    # f_score = g_score + heuristic
                    # Use distance/max_speed as optimistic time estimate
                    max_speed = 130.0  # km/h, maximum possible speed
                    h_score = haversine_distance(
                        self.nodes[neighbor_id].lat,
                        self.nodes[neighbor_id].lon,
                        goal_node.lat,
                        goal_node.lon
                    ) / max_speed
                    
                    f_score = tentative_g + h_score
                    heapq.heappush(open_set, (f_score, neighbor_id, current_id))
        
        return [], 0  # No path found

    def get_route_geometry(self, path: List[int]) -> List[Tuple[float, float]]:
        """Convert path of node IDs to list of coordinates."""
        return [(self.nodes[node_id].lat, self.nodes[node_id].lon) 
                for node_id in path]
                
    def get_route_ways(self, path: List[int]) -> List[int]:
        """Get list of way IDs used in the route."""
        way_ids = []
        for i in range(len(path) - 1):
            from_id = path[i]
            to_id = path[i + 1]
            if from_id in self.nodes and to_id in self.nodes[from_id].adjacent:
                way_id = self.nodes[from_id].adjacent[to_id].get('way_id')
                if way_id is not None and way_id not in way_ids:
                    way_ids.append(way_id)
        return way_ids
