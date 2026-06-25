import json

def write_batch(filepath, col_names, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

def initialize_continuous(filepath, col_names):
    # Simply create/clear the file for JSONLines stream
    with open(filepath, 'w', encoding='utf-8') as f:
        pass

def append_continuous(filepath, col_names, row_data):
    with open(filepath, 'a', encoding='utf-8') as f:
        # Write one JSON object per line (JSONL format)
        f.write(json.dumps(row_data) + '\n')