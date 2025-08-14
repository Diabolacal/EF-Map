import json

def process_labels():
    """
    This script processes the label files and creates a new JSON file called labels.json.
    """
    print("Processing label files...")

    # Load the label files
    with open('system_labels.json', 'r') as f:
        system_labels = json.load(f)
    with open('constellation_labels.json', 'r') as f:
        constellation_labels = json.load(f)
    with open('stellar_labels.json', 'r') as f:
        stellar_labels = json.load(f)

    # Create a new dictionary to store all the labels
    labels = {}

    # Process the system labels
    for label_id, label_data in system_labels.items():
        labels[label_id] = {
            'text': label_data,
            'type': 'system'
        }

    # Process the constellation labels
    for label_id, label_data in constellation_labels.items():
        labels[label_id] = {
            'text': label_data,
            'type': 'constellation'
        }

    # Process the stellar labels
    for label_id, label_data in stellar_labels.items():
        if isinstance(label_data, dict):
            labels[label_id] = {
                'text': label_data.get('text'),
                'type': 'region',
                'parent_id': label_data.get('parent_id'),
                'position': label_data.get('position'),
                'font_size': label_data.get('font_size'),
                'showOnZoom': label_data.get('showOnZoom')
            }
        else:
            labels[label_id] = {
                'text': label_data,
                'type': 'region'
            }

    # Save the new labels file
    with open('labels.json', 'w') as f:
        json.dump(labels, f, indent=2)

    print("Label files processed successfully!")

if __name__ == "__main__":
    process_labels()