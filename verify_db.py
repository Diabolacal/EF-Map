import sqlite3

def verify_database():
    """Connects to the database and verifies its contents."""
    db_file = "eve-frontier-map/public/map_data.db"
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()

        # Verify tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        expected_tables = ['regions', 'constellations', 'systems', 'stargates', 'labels', 'region_labels']
        print(f"Tables found: {tables}")
        assert all(table in tables for table in expected_tables), "Missing tables"

        # Verify data
        for table in expected_tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"Found {count} rows in '{table}' table")
            assert count > 0, f"No data in '{table}' table"

        print("Database verification successful!")

    except sqlite3.Error as e:
        print(f"Database verification failed: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    verify_database()