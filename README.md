# EVE Frontier Map Data Processing

This document outlines the steps to process the raw EVE Frontier map data, which is extracted from the game's JSON files. The process involves consolidating multiple JSON files into a single file and then filtering out specific regions that are not visible in-game.

## Step 1: Consolidate Raw Data

The first step is to consolidate the various JSON files into a single `map_data.json` file.

1.  **Create the consolidation script:**
    Create a Python script named `create_map_data.py` with the following content:

    '''python
    import json

    def create_map_data():
        # Load all the raw data files
        with open('all_solarsystems.json', 'r') as f:
            all_solarsystems = json.load(f)
        with open('constellation_labels.json', 'r') as f:
            constellation_labels = {item['id']: item['label'] for item in json.load(f)}
        with open('starmapcache.json', 'r') as f:
            starmapcache = json.load(f)
        with open('stellar_constellations.json', 'r') as f:
            stellar_constellations = json.load(f)
        with open('stellar_regions.json', 'r') as f:
            stellar_regions = json.load(f)
        with open('stellar_systems.json', 'r') as f:
            stellar_systems = json.load(f)
        with open('system_labels.json', 'r') as f:
            system_labels = {item['id']: item['label'] for item in json.load(f)}

        # Create a dictionary to hold the map data
        map_data = {
            'regions': {},
            'constellations': {},
            'solarsystems': {}
        }

        # Populate regions
        for region_id, region_data in stellar_regions.items():
            map_data['regions'][region_id] = {
                'name': region_data['name'],
                'constellations': []
            }

        # Populate constellations
        for const_id, const_data in stellar_constellations.items():
            region_id = const_data['region']
            map_data['constellations'][const_id] = {
                'name': constellation_labels.get(const_id, f"Constellation {const_id}"),
                'region': region_id,
                'systems': []
            }
            if str(region_id) in map_data['regions']:
                map_data['regions'][str(region_id)]['constellations'].append(const_id)

        # Populate solar systems
        for system_id, system_data in stellar_systems.items():
            const_id = system_data['constellation']
            map_data['solarsystems'][system_id] = {
                'name': system_labels.get(system_id, f"System {system_id}"),
                'constellation': const_id,
                'neighbours': all_solarsystems.get(str(system_id), {}).get('neighbours', [])
            }
            if str(const_id) in map_data['constellations']:
                map_data['constellations'][str(const_id)]['systems'].append(system_id)

        # Write the consolidated data to a file
        with open('map_data.json', 'w') as f:
            json.dump(map_data, f, indent=4)

    if __name__ == '__main__':
        create_map_data()
    '''

2.  **Run the script:**
    Execute the script from your terminal:
    '''bash
    python create_map_data.py
    '''
    This will generate the `map_data.json` file.

## Step 2: Filter Map Data

The next step is to add a `"hidden": true` flag to regions, constellations, and solar systems that should not be displayed.

1.  **Create the filtering script:**
    Create a Python script named `filter_map_data.py` with the following content:

    '''python
    import json

    def filter_map_data():
        with open('map_data.json', 'r') as f:
            map_data = json.load(f)

        # Regions to hide
        hidden_regions = [
            "14000001", "14000002", "14000003", "14000004", "14000005",
            "12000001", "12000002", "12000003", "12000004", "12000005",
            "10000004"
        ]

        # Add "hidden": true to the specified regions
        for region_id in hidden_regions:
            if region_id in map_data['regions']:
                map_data['regions'][region_id]['hidden'] = True
                # Also hide the constellations and systems in this region
                for const_id in map_data['regions'][region_id]['constellations']:
                    if str(const_id) in map_data['constellations']:
                        map_data['constellations'][str(const_id)]['hidden'] = True
                        for system_id in map_data['constellations'][str(const_id)]['systems']:
                            if str(system_id) in map_data['solarsystems']:
                                map_data['solarsystems'][str(system_id)]['hidden'] = True

        with open('map_data.json', 'w') as f:
            json.dump(map_data, f, indent=4)

    if __name__ == '__main__':
        filter_map_data()
    '''

2.  **Run the script:**
    Execute the script from your terminal:
    '''bash
    python filter_map_data.py
    '''
    This will update `map_data.json` with the `"hidden": true` flags.

## Step 3: Cleanup (Optional)

After successfully generating the filtered `map_data.json`, you can delete the intermediate files:

*   `create_map_data.py`
*   `filter_map_data.py`
*   The original raw JSON files (`all_solarsystems.json`, etc.)

This will leave you with the final `map_data.json` file.
