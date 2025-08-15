import json
import os
import sqlite3
import sys

# Custom adapter for large integers
def adapt_integer(i):
    if i >= 2**63 or i < -2**63:
        return str(i)
    return i

sqlite3.register_adapter(int, adapt_integer)

# --- NEW: helpers ---
def rot_rx_minus_90(x, y, z):
    """Z-up -> Y-up: (x, y, z) -> (x, z, -y)"""
    return (x, z, -y)

def create_database_schema(cursor):
    """Creates the database schema."""
    print("Creating database schema...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS regions (
            id TEXT PRIMARY KEY,
            name TEXT,
            center_x REAL,
            center_y REAL,
            center_z REAL,
            hidden BOOLEAN,
            nebulas TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS constellations (
            id TEXT PRIMARY KEY,
            name TEXT,
            region_id TEXT,
            center_x REAL,
            center_y REAL,
            center_z REAL,
            lines TEXT,
            hidden BOOLEAN,
            FOREIGN KEY(region_id) REFERENCES regions(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS systems (
            id TEXT PRIMARY KEY,
            name TEXT,
            constellation_id TEXT,
            region_id TEXT,
            center_x REAL,
            center_y REAL,
            center_z REAL,
            position_x REAL,
            position_y REAL,
            position_z REAL,
            security_class TEXT,
            security_status REAL,
            star_class TEXT,
            hidden BOOLEAN,
            FOREIGN KEY(constellation_id) REFERENCES constellations(id),
            FOREIGN KEY(region_id) REFERENCES regions(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stargates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            source_system_id TEXT,
            destination_system_id TEXT,
            FOREIGN KEY(source_system_id) REFERENCES systems(id),
            FOREIGN KEY(destination_system_id) REFERENCES systems(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS labels (
            id TEXT PRIMARY KEY,
            text TEXT,
            type TEXT,
            parent_id TEXT,
            position_x REAL,
            position_y REAL,
            position_z REAL,
            font_size INTEGER,
            show_on_zoom BOOLEAN
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS region_labels (
            id TEXT PRIMARY KEY,
            text TEXT,
            type TEXT,
            parent_id TEXT,
            position_x REAL,
            position_y REAL,
            position_z REAL,
            font_size INTEGER,
            show_on_zoom BOOLEAN
        )
    """)
    print("Database schema created successfully.")

def create_map_data():
    """
    Consolidate & transform JSON sources into a single SQLite database for the frontend.
    Applies Rx(-90°) around X to convert Z-up -> Y-up.
    """
    print("Starting map data creation process...")

    # Define file paths
    output_dir = "eve-frontier-map/public"
    db_file = os.path.join(output_dir, "map_data.db")

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Connect to SQLite database (or create it)
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    # Create database schema
    create_database_schema(cursor)

    # --- 1. Load JSON files ---
    print("Loading source JSON files...")
    try:
        with open('stellar_systems.json', 'r') as f:
            stellar_systems = json.load(f)
        with open('stellar_regions.json', 'r') as f:
            stellar_regions = json.load(f)
        with open('stellar_constellations.json', 'r') as f:
            stellar_constellations = json.load(f)
        with open('labels.json', 'r') as f:
            labels = json.load(f)
    except FileNotFoundError as e:
        print(f"Error: Missing source file - {e}. Please ensure all required JSON files are present.")
        return

    # --- 2. Process and insert data into tables ---
    print("Processing and inserting data into the database...")

    # Regions
    for region_id, region_data in stellar_regions.items():
        if not isinstance(region_data, dict):
            continue
        cursor.execute("""
            INSERT OR REPLACE INTO regions (id, name, center_x, center_y, center_z, hidden, nebulas)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            region_id,
            region_data.get('name'),
            region_data.get('center', [None, None, None])[0],
            region_data.get('center', [None, None, None])[1],
            region_data.get('center', [None, None, None])[2],
            False,
            json.dumps(region_data.get('nebulas'))
        ))

    # Constellations
    for const_id, const_data in stellar_constellations.items():
        if not isinstance(const_data, dict):
            continue
        cursor.execute("""
            INSERT OR REPLACE INTO constellations (id, name, region_id, center_x, center_y, center_z, lines, hidden)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            const_id,
            const_data.get('name'),
            str(const_data.get('regionId')),
            const_data.get('center', [None, None, None])[0],
            const_data.get('center', [None, None, None])[1],
            const_data.get('center', [None, None, None])[2],
            json.dumps(const_data.get('lines')),
            False
        ))

    # Systems and Stargates
    scale_factor = 9_460_730_472_580_800  # 1 ly in meters
    for system_id, system_data in stellar_systems.items():
        if not isinstance(system_data, dict):
            continue
        cx, cy, cz = system_data.get('center', [0, 0, 0])
        sx, sy, sz = cx / scale_factor, cy / scale_factor, cz / scale_factor
        X, Y, Z = rot_rx_minus_90(sx, sy, sz)

        # Get system name from system_names table
        cursor.execute("SELECT name FROM system_names WHERE id = ?", (system_id,))
        result = cursor.fetchone()
        system_name = result[0] if result else system_data.get('name')

        cursor.execute("""
            INSERT OR REPLACE INTO systems (id, name, constellation_id, region_id, center_x, center_y, center_z, position_x, position_y, position_z, security_class, security_status, star_class, hidden)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            system_id,
            system_name,
            str(system_data.get('constellationId')),
            str(system_data.get('regionId')),
            cx, cy, cz,
            X, Y, Z,
            system_data.get('securityClass'),
            system_data.get('securityStatus'),
            system_data.get('starClass'),
            False
        ))

        if 'navigation' in system_data and 'neighbours' in system_data['navigation'] and system_data['navigation']['neighbours']:
            for destination_id in system_data['navigation']['neighbours']:
                cursor.execute("""
                    INSERT INTO stargates (name, source_system_id, destination_system_id)
                    VALUES (?, ?, ?)
                """, (
                    f"Stargate {system_id} -> {destination_id}",
                    system_id,
                    destination_id
                ))

    # Labels
    for label_id, label_data in labels.items():
        if not isinstance(label_data, dict):
            continue
        
        label_type = label_data.get('type')
        table_name = ''
        if label_type == 'region':
            table_name = 'region_labels'
        elif label_type == 'constellation' or label_type == 'system':
            table_name = 'labels'
        else:
            continue

        pos = label_data.get('position', [None, None, None])
        font_size = label_data.get('font_size')
        show_on_zoom = label_data.get('showOnZoom')
        
        # Rotate labels to match the new coordinate system
        if pos and len(pos) == 3 and all(p is not None for p in pos):
            rotated_pos = rot_rx_minus_90(pos[0], pos[1], pos[2])
        else:
            rotated_pos = (None, None, None)

        cursor.execute(f"""
            INSERT OR REPLACE INTO {table_name} (id, text, type, parent_id, position_x, position_y, position_z, font_size, show_on_zoom)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            label_id,
            label_data.get('text'),
            label_type,
            str(label_data.get('parent_id')),
            rotated_pos[0], rotated_pos[1], rotated_pos[2],
            int(font_size) if font_size is not None else None,
            bool(show_on_zoom) if show_on_zoom is not None else None
        ))

    # --- 3. Filtering logic ---
    print("Applying filtering logic...")
    ignored_regions = [
        '14000001', '14000002', '14000003', '14000004', '14000005',
        '12000001', '12000002', '12000003', '12000004', '12000005',
        '10000004'
    ]

    for region_id in ignored_regions:
        cursor.execute("UPDATE regions SET hidden = ? WHERE id = ?", (True, region_id))
        cursor.execute("UPDATE systems SET hidden = ? WHERE region_id = ?", (True, region_id))
        cursor.execute("UPDATE constellations SET hidden = ? WHERE region_id = ?", (True, region_id))


    # --- 4. Save final file ---
    print(f"Saving the final map_data.db to {db_file}")
    conn.commit()
    conn.close()

    print("Map data creation process completed successfully!")

if __name__ == "__main__":
    create_map_data()