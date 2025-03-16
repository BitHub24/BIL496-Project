from typing import Dict, List, Tuple, Set
import xml.etree.ElementTree as ET
from rtree import index
import re
from difflib import SequenceMatcher
from unidecode import unidecode

class AddressIndex:
    def __init__(self):
        self.spatial_idx = index.Index()
        self.addresses: Dict[int, Dict] = {}  # id -> address data
        self.streets: Dict[str, Set[int]] = {}  # street name -> set of address ids
        self.neighborhoods: Dict[str, Set[int]] = {}  # neighborhood -> set of address ids
        self.pois: Dict[str, Set[int]] = {}  # POI name -> set of address ids
        self.poi_types: Dict[str, Set[int]] = {}  # POI type -> set of address ids
        self.exact_addresses: Dict[str, Set[int]] = {}  # "street_name:number" -> set of address ids
        self.current_id = 0

        # Common POI types in Turkish and English
        self.poi_categories = {
            'shop': {'market', 'supermarket', 'bakkal', 'fırın', 'eczane', 'pharmacy'},
            'amenity': {'restaurant', 'cafe', 'bank', 'atm', 'hospital', 'school', 'university',
                       'lokanta', 'hastane', 'okul', 'üniversite', 'banka'},
            'leisure': {'park', 'garden', 'sports_centre', 'spor merkezi'},
            'tourism': {'hotel', 'museum', 'otel', 'müze'},
            'public_transport': {'station', 'stop', 'metro', 'bus_station', 'durak', 'istasyon'}
        }

    def add_address(self, lat: float, lon: float, tags: Dict[str, str]):
        """Add an address point to the index."""
        self.current_id += 1
        
        # Store address data
        address_data = {
            'lat': lat,
            'lon': lon,
            'tags': tags,
            'id': self.current_id
        }
        
        # Add to spatial index
        self.spatial_idx.insert(
            self.current_id,
            (lon, lat, lon, lat)  # rtree expects (minx, miny, maxx, maxy)
        )
        
        # Store address data
        self.addresses[self.current_id] = address_data
        
        # Index street name and exact address
        street = self._get_street_name(tags)
        if street:
            # Normalize and store street name
            normalized_street = self._normalize_street_name(street)
            if normalized_street not in self.streets:
                self.streets[normalized_street] = set()
            self.streets[normalized_street].add(self.current_id)
            
            # Store exact address (street + number)
            house_number = tags.get('addr:housenumber')
            if house_number:
                exact_addr_key = f"{normalized_street}:{house_number}"
                if exact_addr_key not in self.exact_addresses:
                    self.exact_addresses[exact_addr_key] = set()
                self.exact_addresses[exact_addr_key].add(self.current_id)
        
        # Index neighborhood/district
        neighborhood = tags.get('addr:suburb') or tags.get('addr:district')
        if neighborhood:
            normalized_neighborhood = self._normalize_text(neighborhood)
            if normalized_neighborhood not in self.neighborhoods:
                self.neighborhoods[normalized_neighborhood] = set()
            self.neighborhoods[normalized_neighborhood].add(self.current_id)

        # Index POIs
        self._index_poi(tags, self.current_id)

    def _index_poi(self, tags: Dict[str, str], addr_id: int):
        """Index POI information."""
        # Index POI name
        name = tags.get('name')
        if name:
            normalized_name = self._normalize_text(name)
            if normalized_name not in self.pois:
                self.pois[normalized_name] = set()
            self.pois[normalized_name].add(addr_id)

        # Index POI types
        for category, types in self.poi_categories.items():
            if category in tags:
                poi_type = tags[category]
                if poi_type in types:
                    normalized_type = self._normalize_text(poi_type)
                    if normalized_type not in self.poi_types:
                        self.poi_types[normalized_type] = set()
                    self.poi_types[normalized_type].add(addr_id)

    def _normalize_text(self, text: str) -> str:
        """Normalize text for better matching."""
        # Convert to lowercase and remove diacritics
        text = unidecode(text.lower())
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _get_street_name(self, tags: Dict[str, str]) -> str:
        """Extract standardized street name from tags."""
        street = tags.get('addr:street')
        if not street:
            return None
        return street

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity ratio between two strings."""
        return SequenceMatcher(None, text1, text2).ratio()

    def _parse_address_query(self, query: str) -> Tuple[str, str]:
        """Parse a query into street name and house number."""
        # Remove extra spaces and normalize
        query = re.sub(r'\s+', ' ', query.strip())
        
        # Try to find a number at the end of the query
        match = re.search(r'^(.*?)[\s/]*(\d+)\s*$', query)
        if match:
            street = match.group(1).strip()
            number = match.group(2).strip()
            return street, number
        
        return query, None

    def _normalize_street_name(self, street: str) -> str:
        """Normalize street name by removing common suffixes and handling variations."""
        # Convert to lowercase and remove diacritics
        street = self._normalize_text(street)
        
        # Remove common Turkish street suffixes
        suffixes = [' sokagi', ' sokak', ' caddesi', ' cadde', ' bulvari', ' bulvar', ' sok', ' cad', ' sk', ' cd']
        for suffix in suffixes:
            if street.endswith(suffix):
                street = street[:-len(suffix)]
                break
        
        return street.strip()

    def _find_matching_streets(self, street_query: str) -> List[str]:
        """Find all streets that could match the query."""
        normalized_query = self._normalize_street_name(street_query)
        matching_streets = []
        
        # Debug print
        print(f"\nSearching for street: {street_query}")
        print(f"Normalized query: {normalized_query}")
        
        # First try exact matches
        for street in self.streets:
            if normalized_query == street:
                matching_streets.append(street)
                print(f"Exact match found: {street}")
                
        # If no exact matches, try partial matches
        if not matching_streets:
            for street in self.streets:
                # Check if query is part of street name or vice versa
                if normalized_query in street or street in normalized_query:
                    matching_streets.append(street)
                    print(f"Partial match found: {street}")
                # Also check similarity for typos
                elif self._calculate_similarity(normalized_query, street) > 0.8:
                    matching_streets.append(street)
                    print(f"Similarity match found: {street}")
        
        # Debug: print building numbers for matching streets
        for street in matching_streets:
            print(f"\nBuilding numbers for {street}:")
            for addr_id in self.streets[street]:
                addr = self.addresses[addr_id]
                if 'addr:housenumber' in addr['tags']:
                    print(f"  Building {addr['tags']['addr:housenumber']}")
                    
        return matching_streets

    def search(self, query: str, limit: int = 10) -> List[Dict]:
        """Search for addresses, streets, and POIs matching the query."""
        # First try to parse as exact address
        street_query, number = self._parse_address_query(query)
        
        print(f"\nSearch query: {query}")
        print(f"Parsed as - Street: {street_query}, Number: {number}")
        
        results = []
        seen_addresses = set()

        # Helper function to add results
        def add_result(addr_id: int, match_type: str, name: str, score: float):
            if addr_id not in seen_addresses:
                addr = self.addresses[addr_id]
                house_number = addr['tags'].get('addr:housenumber', '')
                street_name = addr['tags'].get('addr:street', '')
                print(f"Adding result: {street_name} {house_number} (type: {match_type}, score: {score})")
                results.append({
                    'type': match_type,
                    'name': name,
                    'lat': addr['lat'],
                    'lon': addr['lon'],
                    'full_address': self._format_address(addr['tags']),
                    'score': score,
                    'house_number': house_number
                })
                seen_addresses.add(addr_id)

        # If we have both street and number, prioritize exact building number matches
        if number:
            matching_streets = self._find_matching_streets(street_query)
            print(f"\nFound {len(matching_streets)} matching streets")
            
            # Look for exact building number matches on matching streets
            for normalized_street in matching_streets:
                exact_addr_key = f"{normalized_street}:{number}"
                print(f"\nLooking for exact address: {exact_addr_key}")
                if exact_addr_key in self.exact_addresses:
                    print(f"Found exact match!")
                    for addr_id in self.exact_addresses[exact_addr_key]:
                        add_result(addr_id, 'exact_address', f"{street_query} {number}", 1.0)
                    if results:  # If we found exact matches, return them
                        return results[:limit]

            # If no exact matches, look for buildings on matching streets
            print("\nLooking for buildings on matching streets...")
            for normalized_street in matching_streets:
                if normalized_street in self.streets:
                    for addr_id in self.streets[normalized_street]:
                        addr = self.addresses[addr_id]
                        addr_number = addr['tags'].get('addr:housenumber')
                        if addr_number:
                            try:
                                # Check if the house number matches
                                if addr_number == number:
                                    print(f"Found exact number match: {addr_number}")
                                    add_result(addr_id, 'exact_address', f"{street_query} {number}", 1.0)
                                else:
                                    # Include nearby numbers with lower score
                                    addr_num = int(addr_number)
                                    target_num = int(number)
                                    if abs(addr_num - target_num) <= 5:
                                        print(f"Found nearby number: {addr_number}")
                                        score = 0.9 - (abs(addr_num - target_num) * 0.1)
                                        add_result(addr_id, 'nearby_address', f"{street_query} {addr_number}", score)
                            except ValueError:
                                continue

            # If still no results, show all buildings on the matching streets
            if not results:
                print("\nNo exact or nearby matches found, showing all buildings on the street")
                for normalized_street in matching_streets:
                    if normalized_street in self.streets:
                        for addr_id in self.streets[normalized_street]:
                            addr = self.addresses[addr_id]
                            addr_number = addr['tags'].get('addr:housenumber')
                            if addr_number:
                                score = 0.5  # Lower score for other buildings on the street
                                add_result(addr_id, 'street_address', f"{street_query} {addr_number}", score)

        # If no results yet, proceed with regular search
        if not results:
            normalized_query = self._normalize_text(query)
            
            # Search in street names
            for street in self.streets:
                if normalized_query in street:
                    score = self._calculate_similarity(normalized_query, street)
                    for addr_id in self.streets[street]:
                        add_result(addr_id, 'street', street, score)

            # Search in neighborhoods
            for neighborhood in self.neighborhoods:
                if normalized_query in neighborhood:
                    score = self._calculate_similarity(normalized_query, neighborhood)
                    for addr_id in self.neighborhoods[neighborhood]:
                        add_result(addr_id, 'neighborhood', neighborhood, score)

            # Search in POIs
            for poi_name in self.pois:
                if normalized_query in self._normalize_text(poi_name):
                    score = self._calculate_similarity(normalized_query, self._normalize_text(poi_name))
                    for addr_id in self.pois[poi_name]:
                        add_result(addr_id, 'poi', poi_name, score)

        # Sort by score and limit results
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:limit]

    def _format_address(self, tags: Dict[str, str]) -> str:
        """Format address tags into a human-readable string."""
        parts = []
        
        # Street and house number
        street = tags.get('addr:street')
        if street:
            house_number = tags.get('addr:housenumber', '')
            parts.append(f"{street} {house_number}".strip())
        
        # Neighborhood/District
        neighborhood = tags.get('addr:suburb') or tags.get('addr:district')
        if neighborhood:
            parts.append(neighborhood)
        
        # City
        city = tags.get('addr:city', 'Ankara')
        parts.append(city)
        
        return ', '.join(parts)

class OSMGeocoder:
    def __init__(self, osm_file: str):
        self.address_index = AddressIndex()
        self._load_osm(osm_file)

    def _load_osm(self, filename: str):
        """Load OSM data and build address index."""
        tree = ET.parse(filename)
        root = tree.getroot()

        # First pass: collect all nodes with their coordinates
        node_coords = {}
        for node in root.findall('.//node'):
            node_id = node.get('id')
            if node_id:
                node_coords[node_id] = (
                    float(node.get('lat')),
                    float(node.get('lon'))
                )

        # Process nodes with address information or POIs
        for node in root.findall('.//node'):
            tags = {}
            has_info = False
            
            for tag in node.findall('tag'):
                key = tag.get('k')
                value = tag.get('v')
                if (key.startswith('addr:') or 
                    key in {'name', 'place', 'building'} or 
                    key in self.address_index.poi_categories):
                    tags[key] = value
                    has_info = True
            
            if has_info and ('addr:housenumber' in tags or 'addr:street' in tags):
                self.address_index.add_address(
                    float(node.get('lat')),
                    float(node.get('lon')),
                    tags
                )

        # Process ways (buildings, etc.)
        for way in root.findall('.//way'):
            tags = {}
            has_info = False
            nodes = []
            
            # Collect way nodes
            for nd in way.findall('nd'):
                ref = nd.get('ref')
                if ref in node_coords:
                    nodes.append(node_coords[ref])
            
            if nodes:
                # Calculate center point
                center_lat = sum(lat for lat, _ in nodes) / len(nodes)
                center_lon = sum(lon for _, lon in nodes) / len(nodes)
                
                # Get tags
                for tag in way.findall('tag'):
                    key = tag.get('k')
                    value = tag.get('v')
                    if (key.startswith('addr:') or 
                        key in {'name', 'place', 'building'} or 
                        key in self.address_index.poi_categories):
                        tags[key] = value
                        has_info = True

                # Check if it's a building with address information
                is_building = (
                    tags.get('building') in {'yes', 'residential', 'apartments', 'house'} or
                    'addr:housenumber' in tags
                )
                
                if has_info and is_building and ('addr:housenumber' in tags or 'addr:street' in tags):
                    self.address_index.add_address(
                        center_lat,
                        center_lon,
                        tags
                    )

        # Debug: Print some statistics
        print(f"Loaded addresses: {len(self.address_index.addresses)}")
        print(f"Streets: {len(self.address_index.streets)}")
        print(f"Exact addresses: {len(self.address_index.exact_addresses)}")
        building_numbers = sum(1 for addr in self.address_index.addresses.values() 
                             if 'addr:housenumber' in addr['tags'])
        print(f"Addresses with building numbers: {building_numbers}")
        
        # Print some example addresses
        print("\nExample addresses:")
        for i, addr in list(self.address_index.addresses.items())[:5]:
            print(f"Address {i}: {self.address_index._format_address(addr['tags'])}")
            if 'addr:housenumber' in addr['tags']:
                print(f"  Building number: {addr['tags']['addr:housenumber']}")
            if 'addr:street' in addr['tags']:
                print(f"  Street: {addr['tags']['addr:street']}")
            print("---")

    def search(self, query: str, limit: int = 10) -> List[Dict]:
        """Search for addresses and POIs matching the query."""
        return self.address_index.search(query, limit) 