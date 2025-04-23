import os
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
import osmnx as ox
import logging

# Logger
logger = logging.getLogger(__name__)

# Graf dosyasının kaydedileceği yer (örn: backend/data/ankara_drive.graphml)
GRAPH_SAVE_DIR = os.path.join(settings.BASE_DIR, 'data')
GRAPH_FILENAME = 'ankara_drive.graphml'
GRAPH_FILE_PATH = os.path.join(GRAPH_SAVE_DIR, GRAPH_FILENAME)

class Command(BaseCommand):
    help = 'Downloads road network graph data for Ankara from OpenStreetMap and saves it as a GraphML file.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Downloading Ankara road network from OpenStreetMap...'))
        self.stdout.write('This might take a while depending on the network speed and data size.')
        
        try:
            # Ankara için sürüş ağı grafını indir
            # network_type='drive' varsayılan sürüş ağını alır (arabalar için)
            graph = ox.graph_from_place('Ankara, Turkey', network_type='drive')
            
            self.stdout.write(self.style.SUCCESS('Successfully downloaded graph data.'))
            self.stdout.write(f'Graph has {graph.number_of_nodes()} nodes and {graph.number_of_edges()} edges.')
            
            # Gerekli önişleme adımlarını ekle (örn: hız, seyahat süresi)
            self.stdout.write(self.style.NOTICE('Adding speed and travel time information to the graph edges...'))
            graph = ox.add_edge_speeds(graph)
            graph = ox.add_edge_travel_times(graph)
            self.stdout.write(self.style.SUCCESS('Speed and travel time added.'))

            # Kaydetme dizininin var olduğundan emin ol
            os.makedirs(GRAPH_SAVE_DIR, exist_ok=True)
            
            # Grafı diske GraphML formatında kaydet
            self.stdout.write(self.style.NOTICE(f'Saving graph to: {GRAPH_FILE_PATH}'))
            ox.save_graphml(graph, filepath=GRAPH_FILE_PATH)
            
            self.stdout.write(self.style.SUCCESS('Graph saved successfully!'))

        except Exception as e:
            logger.exception("An error occurred during graph creation or saving.")
            raise CommandError(f'Failed to create or save graph: {e}') 