import unittest
from datetime import datetime
from routing.astar import RoutingGraph, UserPreferences, Node

class TestPreferenceBasedRouting(unittest.TestCase):
    """Test cases for preference-based routing algorithm."""
    
    def setUp(self):
        """Set up a simple test graph."""
        self.graph = RoutingGraph()
        
        # Add nodes
        self.graph.add_node(1, 39.9, 32.8)  # Node 1
        self.graph.add_node(2, 39.91, 32.81)  # Node 2
        self.graph.add_node(3, 39.92, 32.82)  # Node 3
        self.graph.add_node(4, 39.93, 32.83)  # Node 4
        self.graph.add_node(5, 39.94, 32.84)  # Node 5
        
        # Add edges with way IDs
        # Path 1-2-5 (shorter)
        self.graph.add_edge(1, 2, True, 50.0, 101)
        self.graph.add_edge(2, 5, True, 50.0, 102)
        
        # Path 1-3-4-5 (longer)
        self.graph.add_edge(1, 3, True, 50.0, 103)
        self.graph.add_edge(3, 4, True, 50.0, 104)
        self.graph.add_edge(4, 5, True, 50.0, 105)
    
    def test_default_routing(self):
        """Test routing without preferences."""
        path, _ = self.graph.astar(1, 5)
        # Default should take shortest path: 1-2-5
        self.assertEqual(path, [1, 2, 5])
    
    def test_preferred_road(self):
        """Test routing with preferred road."""
        # Prefer the longer path by setting a strong preference for way 103
        preferences = UserPreferences(
            preferred_ways={103: 0.5}  # Make way 103 twice as fast
        )
        
        path, _ = self.graph.astar(1, 5, user_preferences=preferences)
        # Should now prefer the longer path: 1-3-4-5
        self.assertEqual(path, [1, 3, 4, 5])
    
    def test_avoided_road(self):
        """Test routing with avoided road."""
        # Avoid the shorter path by setting a strong avoidance for way 101
        preferences = UserPreferences(
            avoided_ways={101: 5.0}  # Make way 101 five times slower
        )
        
        path, _ = self.graph.astar(1, 5, user_preferences=preferences)
        # Should now avoid the shorter path and take: 1-3-4-5
        self.assertEqual(path, [1, 3, 4, 5])
    
    def test_combined_preferences(self):
        """Test routing with both preferred and avoided roads."""
        # Prefer way 104 and avoid way 102
        preferences = UserPreferences(
            preferred_ways={104: 0.5},  # Make way 104 twice as fast
            avoided_ways={102: 4.0}     # Make way 102 four times slower
        )
        
        path, _ = self.graph.astar(1, 5, user_preferences=preferences)
        # Should take the longer path due to combined preferences: 1-3-4-5
        self.assertEqual(path, [1, 3, 4, 5])
    
    def test_traffic_and_preferences(self):
        """Test routing with both traffic and preferences."""
        # Create a test time during peak hours
        peak_time = datetime(2025, 4, 18, 8, 30)  # 8:30 AM
        
        # First test without preferences during peak hours
        path_traffic_only, _ = self.graph.astar(1, 5, current_time=peak_time)
        # Should still take shortest path despite traffic: 1-2-5
        self.assertEqual(path_traffic_only, [1, 2, 5])
        
        # Now test with both traffic and preferences
        preferences = UserPreferences(
            preferred_ways={103: 0.6}  # Prefer way 103
        )
        
        path_combined, _ = self.graph.astar(1, 5, current_time=peak_time, user_preferences=preferences)
        # Should take the preferred path: 1-3-4-5
        self.assertEqual(path_combined, [1, 3, 4, 5])

if __name__ == '__main__':
    unittest.main()
