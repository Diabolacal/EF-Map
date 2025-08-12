
import json
import os

def create_map_data():
    """
    This script consolidates and transforms multiple JSON data sources into a
    single map_data.json file for the frontend application.
    """
    print("Starting map data creation process...")

    # Define file paths
    output_dir = "eve-frontier-map/public"
    output_file = os.path.join(output_dir, "map_data.json")
    
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # --- 1. Load all necessary JSON files ---
    print("Loading source JSON files...")
    try:
        with open('stellar_systems.json', 'r') as f:
            stellar_systems = json.load(f)
        with open('stellar_regions.json', 'r') as f:
            stellar_regions = json.load(f)
        with open('stellar_constellations.json', 'r') as f:
            stellar_constellations = json.load(f)
        with open('system_labels.json', 'r') as f:
            system_labels = json.load(f)
        with open('constellation_labels.json', 'r') as f:
            constellation_labels = json.load(f)
        with open('stellar_labels.json', 'r') as f:
            stellar_labels = json.load(f)

    except FileNotFoundError as e:
        print(f"Error: Missing source file - {e}. Please ensure all required JSON files are present.")
        return

    # --- 2. Process stargates and transform solar system data ---
    print("Processing stargate data and transforming solar systems...")
    
    stargates = {}
    stargate_id_counter = 0
    solar_systems_transformed = {}
    scale_factor = 1_000_000_000_000_000 # Scale down astronomical coordinates

    if stellar_systems:
        for system_id, system_data in stellar_systems.items():
            # Transform position
            if 'center' in system_data and len(system_data['center']) == 3:
                system_data['position'] = {
                    'x': system_data['center'][0] / scale_factor,
                    'y': system_data['center'][1] / scale_factor,
                    'z': system_data['center'][2] / scale_factor
                }

            # Process stargates from the 'neighbours' field
            if 'navigation' in system_data and 'neighbours' in system_data['navigation'] and system_data['navigation']['neighbours']:
                for destination_id in system_data['navigation']['neighbours']:
                    stargate_id_counter += 1
                    stargates[str(stargate_id_counter)] = {
                        "id": stargate_id_counter,
                        "name": f"Stargate {system_id} -> {destination_id}",
                        "source_system_id": int(system_id),
                        "destination_system_id": int(destination_id)
                    }
            
            solar_systems_transformed[system_id] = system_data

    map_data = {
        "regions": stellar_regions,
        "constellations": stellar_constellations,
        "solar_systems": solar_systems_transformed,
        "stargates": stargates,
        "system_labels": system_labels,
        "constellation_labels": constellation_labels,
        "stellar_labels": stellar_labels,
    }

    # --- 3. Apply filtering logic ---
    print("Applying filtering logic...")
    ignored_regions = [
        '14000001', '14000002', '14000003', '14000004', '14000005',
        '12000001', '12000002', '12000003', '12000004', '12000005',
        '10000004'
    ]

    # Flag regions
    for region_id in ignored_regions:
        if region_id in map_data['regions']:
            map_data['regions'][region_id]['hidden'] = True

    # Flag constellations and systems in ignored regions
    if map_data.get('solar_systems'):
        for system_id, system_data in map_data['solar_systems'].items():
            if 'regionId' in system_data and str(system_data['regionId']) in ignored_regions:
                system_data['hidden'] = True
                if 'constellationId' in system_data and str(system_data['constellationId']) in map_data.get('constellations', {}):
                    map_data['constellations'][str(system_data['constellationId'])]['hidden'] = True


    # --- 4. Save the final file ---
    print(f"Saving the final map_data.json to {output_file}")
    with open(output_file, 'w') as f:
        json.dump(map_data, f, indent=2)

    print("Map data creation process completed successfully!")

if __name__ == "__main__":
    create_map_data()
