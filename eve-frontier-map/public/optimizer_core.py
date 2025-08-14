import math
import random
import time

# This script contains the core computational logic for the route optimizer,
# adapted to run in the browser via Pyodide.

# --- Core Calculation Logic ---

def calculate_distance(p1, p2):
    """Calculates the Euclidean distance between two 3D points (systems)."""
    return math.sqrt((p1['x'] - p2['x'])**2 + (p1['y'] - p2['y'])**2 + (p1['z'] - p2['z'])**2)

def calculate_total_distance(path, systems_data):
    """Calculates the total distance of an ordered path."""
    if not path or len(path) < 2:
        return 0.0
    total_dist = 0
    for i in range(len(path) - 1):
        total_dist += calculate_distance(systems_data[path[i]], systems_data[path[i+1]])
    return total_dist

def calculate_baseline_route(systems_in_radius_js, systems_data_js, start_system_name):
    """A dedicated function for the fast initial route calculation."""
    try:
        systems_in_radius = systems_in_radius_js.to_py()
        systems_data = systems_data_js.to_py()
        
        # 1. Nearest Neighbor
        unvisited = set(systems_in_radius)
        unvisited.remove(start_system_name)
        nn_path = [start_system_name]
        current_system = start_system_name
        while unvisited:
            nearest = min(unvisited, key=lambda sys: calculate_distance(systems_data[current_system], systems_data[sys]))
            nn_path.append(nearest)
            unvisited.remove(nearest)
            current_system = nearest
        
        # 2. 2-Opt Refinement
        best_path = nn_path
        path_len = len(best_path)
        improved = True
        while improved:
            improved = False
            for i in range(1, path_len - 1):
                for j in range(i + 1, path_len):
                    current_dist = calculate_distance(systems_data[best_path[i-1]], systems_data[best_path[i]]) + \
                                   calculate_distance(systems_data[best_path[j-1]], systems_data[best_path[j]])
                    new_dist = calculate_distance(systems_data[best_path[i-1]], systems_data[best_path[j-1]]) + \
                               calculate_distance(systems_data[best_path[i]], systems_data[best_path[j]])
                    if new_dist < current_dist:
                        best_path[i:j] = best_path[i:j][::-1]
                        improved = True
                        break
                if improved:
                    break
        
        best_dist = calculate_total_distance(best_path, systems_data)
        return {'path': best_path, 'distance': best_dist}
    except Exception as e:
        return {'error': str(e)}


def run_iterative_pass(current_best_path_js, systems_data_js, time_per_pass):
    """Runs a single, time-limited deep search pass."""
    try:
        current_best_path = current_best_path_js.to_py()
        systems_data = systems_data_js.to_py()

        random.seed()

        local_path = list(current_best_path)
        path_len = len(local_path)

        if path_len > 4:
            for _ in range(3):
                i, j = sorted(random.sample(range(1, path_len), 2))
                local_path[i:j] = local_path[i:j][::-1]
        
        start_time = time.time()
        best_path = local_path
        best_dist = calculate_total_distance(best_path, systems_data)

        avg_dist = best_dist / (path_len - 1) if path_len > 1 else 1.0
        temperature = avg_dist * 0.25 # Start with a quarter of the average distance
        cooling_rate = 0.985

        while time.time() - start_time < time_per_pass:
            new_path = list(best_path)

            # 2-opt move
            if random.random() < 0.5 and path_len > 3:
                i, j = sorted(random.sample(range(1, path_len), 2))
                new_path[i:j+1] = new_path[i:j+1][::-1]
            # Relocate move
            else:
                if path_len > 2:
                    idx_to_move = random.randint(1, path_len - 1)
                    system_to_move = new_path.pop(idx_to_move)
                    insert_pos = random.randint(1, len(new_path))
                    new_path.insert(insert_pos, system_to_move)

            new_dist = calculate_total_distance(new_path, systems_data)

            cost_diff = new_dist - best_dist
            if cost_diff < 0 or (temperature > 1e-8 and random.random() < math.exp(-cost_diff / temperature)):
                best_path = new_path
                best_dist = new_dist
            
            temperature *= cooling_rate

        return {'path': best_path, 'distance': best_dist}
    except Exception as e:
        return {'error': str(e)}