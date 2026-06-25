import csv

def _get_dialect(is_csv):
    return 'excel' if is_csv else 'excel-tab'

def write_batch(filepath, col_names, data, is_csv=True):
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=col_names, dialect=_get_dialect(is_csv))
        writer.writeheader()
        writer.writerows(data)

def initialize_continuous(filepath, col_names, is_csv=True):
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=col_names, dialect=_get_dialect(is_csv))
        writer.writeheader()

def append_continuous(filepath, col_names, row_data, is_csv=True):
    with open(filepath, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=col_names, dialect=_get_dialect(is_csv))
        writer.writerow(row_data)