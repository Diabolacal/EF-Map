import json
import os

# --- NEW: helpers ---
def rot_rx_minus_90(x, y, z):
    """Z-up -> Y-up: (x, y, z) -> (x, z, -y)"""
    return (x, z, -y)

def transform_xyz_recursive(v):
    """
    Optional: walk any dict/list structures and rotate anything that looks like an XYZ.
    - Dict with numeric x,y,z -> rotate those keys
    - List/tuple of length 3 of numbers -> rotate
    - Recurse into containers
    """
    if isinstance(v, dict):
        out = {}
        # If it looks like a coordinate object, rotate once
        if all(k in v for k in ("x","y","z")) and \
           all(isinstance(v[k], (int, float)) for k in ("x","y","z")):
            X, Y, Z = rot_rx_minus_90(v["x"], v["y"], v["z"])
            out.update(v)
            out["x"], out["y"], out["z"] = X, Y, Z
            # still recurse other keys in case of nesting
            for k, val in v.items():
                if k not in ("x","y","z"):
                    out[k] = transform_xyz_recursive(val)
            return out
        # Otherwise, just recurse
        for k, val in v.items():
            out[k] = transform_xyz_recursive(val)
        return out

    if isinstance(v, (list, tuple)):
        if len(v) == 3 and all(isinstance(n, (int, float)) for n in v):
            x, y, z = v
            X, Y, Z = rot_rx_minus_90(x, y, z)
            return [X, Y, Z]
        return [transform_xyz_recursive(x) for x in v]

    return v


def create_map_data():
    """
    Consolidate & transform JSON sources into a single Y-up map_data.json for the frontend.
    Applies Rx(-90°) around X to convert Z-up -> Y-up.
    """
    print("Starting map data creation process...")

    # Define file paths
    output_dir = "eve-frontier-map/public"
    output_file = os.path.join(output_dir, "map_data.json")

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # --- 1. Load JSON files ---
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

    # --- 2. Process systems & stargates (apply rotation when deriving position) ---
    print("Processing stargate data and transforming solar systems...")

    stargates = {}
    stargate_id_counter = 0
    solar_systems_transformed = {}

    # 1 light-year in meters (your existing scale)
    scale_factor = 9_460_730_472_580_800  # 1 ly in meters

    if stellar_systems:
        for system_id, system_data in stellar_systems.items():
            # Build Y-up 'position' from Z-up 'center'
            if 'center' in system_data and len(system_data['center']) == 3:
                cx, cy, cz = system_data['center']
                # scale to LY first (uniform scale, order vs rotation doesn't matter)
                sx, sy, sz = cx / scale_factor, cy / scale_factor, cz / scale_factor
                X, Y, Z = rot_rx_minus_90(sx, sy, sz)  # (x, y, z) -> (x, z, -y)
                system_data['position'] = {'x': X, 'y': Y, 'z': Z}

            # Build stargate link list from neighbours (positions taken from systems later)
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

    # Optional: rotate any label payloads that contain coords
    # (Uncomment if your label JSONs have x/y/z or [x,y,z] anchors)
    # system_labels = transform_xyz_recursive(system_labels)
    # constellation_labels = transform_xyz_recursive(constellation_labels)
    # stellar_labels = transform_xyz_recursive(stellar_labels)

    map_data = {
        "_basis": {"source": "Z-up", "transform": "Rx(-90deg) → Y-up"},
        "regions": stellar_regions,
        "constellations": stellar_constellations,
        "solar_systems": solar_systems_transformed,
        "stargates": stargates,
        "system_labels": system_labels,
        "constellation_labels": constellation_labels,
        "stellar_labels": stellar_labels,
    }

    # --- 3. Filtering logic (unchanged) ---
    print("Applying filtering logic...")
    ignored_regions = [
        '14000001', '14000002', '14000003', '14000004', '14000005',
        '12000001', '12000002', '12000003', '12000004', '12000005',
        '10000004'
    ]

    for region_id in ignored_regions:
        if region_id in map_data['regions']:
            map_data['regions'][region_id]['hidden'] = True

    if map_data.get('solar_systems'):
        for system_id, system_data in map_data['solar_systems'].items():
            if 'regionId' in system_data and str(system_data['regionId']) in ignored_regions:
                system_data['hidden'] = True
                if 'constellationId' in system_data and str(system_data['constellationId']) in map_data.get('constellations', {}):
                    map_data['constellations'][str(system_data['constellationId'])]['hidden'] = True

    # --- 4. Save final file ---
    print(f"Saving the final map_data.json to {output_file}")
    with open(output_file, 'w') as f:
        json.dump(map_data, f, indent=2)

    print("Map data creation process completed successfully!")

if __name__ == "__main__":
    create_map_data()
