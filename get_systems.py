import requests
import json
import time

# Configuration
BASE_URL = "https://world-api-stillness.live.tech.evefrontier.com/v2/solarsystems"
LIMIT = 1000  # Number of items to request per page
OUTPUT_FILE = "all_solarsystems.json"

def fetch_all_solar_systems():
    """
    Fetches all solar systems from the API using pagination and saves them to a JSON file.
    """
    all_systems = []
    offset = 0
    
    print("Starting to fetch solar systems...")

    while True:
        # Construct the full URL with query parameters
        params = {'limit': LIMIT, 'offset': offset}
        
        try:
            # Make the GET request
            print(f"Fetching {LIMIT} systems with offset {offset}...")
            response = requests.get(BASE_URL, params=params, headers={'accept': 'application/json'})
            
            # Check for a successful response
            response.raise_for_status()  # This will raise an exception for HTTP error codes (4xx or 5xx)
            
            # Parse the JSON response
            data = response.json()
            
            # Get the list of systems from the 'data' key
            systems_on_page = data.get('data', [])
            
            # If the page is empty, we've reached the end
            if not systems_on_page:
                print("No more systems returned. Reached the end.")
                break
            
            # Add the fetched systems to our main list
            all_systems.extend(systems_on_page)
            
            # Prepare for the next page
            offset += LIMIT
            
            # Be polite to the server and wait a moment before the next request
            time.sleep(0.5)

        except requests.exceptions.RequestException as e:
            print(f"An error occurred: {e}")
            break
            
    if all_systems:
        print(f"\nFinished fetching. Total solar systems found: {len(all_systems)}")
        
        # Write the collated data to a single JSON file
        try:
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                # The final file will be an array of solar system objects
                json.dump(all_systems, f, indent=2, ensure_ascii=False)
            print(f"All solar systems have been successfully saved to '{OUTPUT_FILE}'")
        except IOError as e:
            print(f"Could not write to file '{OUTPUT_FILE}': {e}")
    else:
        print("No solar systems were fetched.")

if __name__ == "__main__":
    fetch_all_solar_systems()