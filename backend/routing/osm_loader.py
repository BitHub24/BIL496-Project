import xml.etree.ElementTree as ET
from typing import Dict, Set, Tuple, List
from .astar import RoutingGraph

class OSMLoader:
    def __init__(self):
        self.graph = RoutingGraph()
        self.way_nodes: Set[int] = set()
        self.highway_types = {
            'motorway': 120.0,
            'trunk': 90.0,
            'primary': 70.0,
            'secondary': 60.0,
            'tertiary': 50.0,
            'residential': 30.0,
            'unclassified': 40.0,
            'motorway_link': 60.0,
            'trunk_link': 50.0,
            'primary_link': 40.0,
            'secondary_link': 40.0,
            'tertiary_link': 30.0
        }
        self.node_ways: Dict[int, List[int]] = {}  # node_id -> list of way_ids
        self.way_tags: Dict[int, Dict] = {}  # way_id -> tags

    def load_osm(self, filename: str):
        """Load OSM XML file and build routing graph."""
        tree = ET.parse(filename)
        root = tree.getroot()

        # First pass: collect all nodes that are part of ways and their ways
        for way in root.findall('.//way'):
            way_id = int(way.get('id'))
            if self._is_routable_way(way):
                # Store way tags
                self.way_tags[way_id] = {
                    tag.get('k'): tag.get('v')
                    for tag in way.findall('tag')
                }
                
                for nd in way.findall('nd'):
                    node_id = int(nd.get('ref'))
                    self.way_nodes.add(node_id)
                    
                    if node_id not in self.node_ways:
                        self.node_ways[node_id] = []
                    self.node_ways[node_id].append(way_id)

        # Second pass: add nodes to graph
        for node in root.findall('.//node'):
            node_id = int(node.get('id'))
            if node_id in self.way_nodes:
                self.graph.add_node(
                    node_id,
                    float(node.get('lat')),
                    float(node.get('lon'))
                )

        # Third pass: add edges and detect turn restrictions
        for way in root.findall('.//way'):
            way_id = int(way.get('id'))
            if way_id in self.way_tags:
                nodes = [int(nd.get('ref')) for nd in way.findall('nd')]
                speed_limit = self._get_speed_limit(way_id)
                oneway = self._is_oneway(way_id)
                
                for i in range(len(nodes) - 1):
                    self.graph.add_edge(
                        nodes[i],
                        nodes[i + 1],
                        bidirectional=not oneway,
                        speed_limit=speed_limit
                    )

        # Fourth pass: process turn restrictions
        for relation in root.findall('.//relation'):
            if self._is_turn_restriction(relation):
                self._process_turn_restriction(relation)

    def _is_routable_way(self, way) -> bool:
        """Check if way is routable (has acceptable highway tag)."""
        for tag in way.findall('tag'):
            if tag.get('k') == 'highway' and tag.get('v') in self.highway_types:
                return True
        return False

    def _is_oneway(self, way_id: int) -> bool:
        """Check if way is one-way."""
        tags = self.way_tags[way_id]
        return (
            tags.get('oneway') in ('yes', 'true', '1') or
            tags.get('highway') == 'motorway'  # motorways are always one-way
        )

    def _get_speed_limit(self, way_id: int) -> float:
        """Get speed limit for way in km/h."""
        tags = self.way_tags[way_id]
        
        # Check for explicit maxspeed tag
        if 'maxspeed' in tags:
            try:
                return float(tags['maxspeed'].split()[0])  # Handle "50 mph" format
            except (ValueError, IndexError):
                pass
        
        # Use default speed for highway type
        highway_type = tags.get('highway')
        return self.highway_types.get(highway_type, 50.0)

    def _is_turn_restriction(self, relation) -> bool:
        """Check if relation is a turn restriction."""
        for tag in relation.findall('tag'):
            if (tag.get('k') == 'type' and 
                tag.get('v') == 'restriction'):
                return True
        return False

    def _process_turn_restriction(self, relation):
        """Process turn restriction relation."""
        from_way = to_way = via_node = None
        restriction_type = None
        
        # Get restriction details
        for tag in relation.findall('tag'):
            if tag.get('k') == 'restriction':
                restriction_type = tag.get('v')
        
        # Get members
        for member in relation.findall('member'):
            role = member.get('role')
            if role == 'from':
                from_way = int(member.get('ref'))
            elif role == 'to':
                to_way = int(member.get('ref'))
            elif role == 'via':
                via_node = int(member.get('ref'))
        
        if from_way and to_way and via_node:
            # Determine if turn is allowed based on restriction type
            allowed = restriction_type.startswith('only_')
            self.graph.add_turn_restriction(via_node, from_way, to_way, allowed)

    def get_graph(self) -> RoutingGraph:
        return self.graph 