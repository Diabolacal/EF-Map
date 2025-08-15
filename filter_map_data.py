
import json

def filter_map_data():
    with open('map_data.json', 'r') as f:
        map_data = json.load(f)

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
    for system_id, system_data in map_data['solar_systems'].items():
        if str(system_data['region_id']) in ignored_regions:
            system_data['hidden'] = True
            if str(system_data['constellation_id']) in map_data['constellations']:
                map_data['constellations'][str(system_data['constellation_id'])]['hidden'] = True


    with open('map_data.json', 'w') as f:
        json.dump(map_data, f, indent=2)

if __name__ == "__main__":
    filter_map_data()
