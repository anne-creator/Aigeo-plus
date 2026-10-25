"""Import personnel data only; never execute scripts or adopt demo workflow instructions."""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = ['metadata.json', 'employees.json', 'departments.json', 'skills.json', 'roles.json', 'teams.json', 'daily_capacity.json', 'calendars.json', 'bookings.json', 'discord_identity_mapping.json']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    source = args.source.resolve()
    payloads = {name: (source / 'data' / name).read_bytes() for name in FILES}
    records = {name: json.loads(raw) for name, raw in payloads.items()}
    source_manifest = json.loads((source / 'manifest.json').read_text())
    expected = {f['path']: f['sha256'] for f in source_manifest['files']}
    for name, raw in payloads.items():
        if hashlib.sha256(raw).hexdigest() != expected['data/' + name]:
            raise ValueError('Source checksum mismatch: ' + name)
    metadata = records['metadata.json']
    employees = records['employees.json']
    departments = records['departments.json']
    reference_date = metadata['reference_time'][:10]
    capacities = {(c['employee_id'], c['date']): c for c in records['daily_capacity.json']}
    ids = {e['employee_id'] for e in employees}
    if len(ids) != len(employees):
        raise ValueError('Duplicate employee IDs')
    counts = Counter(e['department_id'] for e in employees)
    for d in departments:
        if counts[d['department_id']] != d['headcount']:
            raise ValueError('Department headcount mismatch: ' + d['department_id'])
    department_ids = {d['department_id'] for d in departments}
    if set(counts) != department_ids:
        raise ValueError('Employee department is not in directory')
    skills = {s['skill_id']: s['name'] for s in records['skills.json']}
    people = []
    for index, e in enumerate(employees):
        c = capacities[(e['employee_id'], reference_date)]
        people.append({
            'id': e['employee_id'], 'name': e['name'], 'role': e['job_title'],
            'initials': ''.join(part[0] for part in e['name'].split()[:2]).upper(),
            'department': e['department_name'], 'departmentId': e['department_id'],
            'skills': [skills[k] for k in e['skills']], 'skillLevels': e['skills'],
            'permissions': e['permissions'], 'availableHours': c['free_hours'],
            'availabilityDate': reference_date, 'timezone': e['timezone'],
            'color': ['rose', 'mint', 'sand'][index % 3],
        })
    source_info = {
        'datasetId': metadata['dataset_id'], 'companyName': metadata['company_name'],
        'isSynthetic': metadata['is_synthetic'], 'referenceTime': metadata['reference_time'],
        'referenceDate': reference_date, 'timezone': metadata['timezone'],
        'directory': 'data/company',
        'resources': {name.removesuffix('.json'): 'data/company/' + name for name in FILES},
    }
    projection = {'people': people, 'departments': [d['name'] for d in departments], 'source': source_info}
    target = ROOT / 'data' / 'company'
    target.mkdir(parents=True, exist_ok=True)
    for name, raw in payloads.items():
        (target / name).write_bytes(raw)
    (target / 'import-manifest.json').write_text(json.dumps({
        'dataset_id': metadata['dataset_id'],
        'source_folder': source.name,
        'files': [{'path': name, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)} for name, raw in payloads.items()],
        'counts': {'employees': len(employees), 'departments': len(departments), 'roles': len(records['roles.json']), 'teams': len(records['teams.json']), 'calendar_days': len(records['calendars.json']), 'capacity_rows': len(records['daily_capacity.json']), 'bookings': len(records['bookings.json'])},
    }, indent=2) + '\n')
    (ROOT / 'src' / 'company-data.json').write_text(json.dumps(projection, separators=(',', ':')) + '\n')
    print(json.dumps({'dataset': metadata['dataset_id'], 'people': len(people), 'departments': len(departments), 'availability_date': reference_date}))


if __name__ == '__main__':
    main()
