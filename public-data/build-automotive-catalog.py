"""Build a compact, checksummed catalog from explicit captured source receipts."""
import gzip
import hashlib
import json
from pathlib import Path
import sys


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def identity(kind, *values):
    return digest(json.dumps([kind, *values], ensure_ascii=False, separators=(',', ':')).encode())[:32]


def build(config, target):
    rows, sources, coverage, retained = [], {}, {}, {}
    for dataset in config['datasets']:
        kind = dataset['kind']
        count = 0
        for item in dataset['captures']:
            root, receipt_id = Path(item['root']), item['id']
            receipt = next(row for row in json.loads((root / item.get('manifest', 'manifest.json')).read_text()) if row.get('id', row.get('name')) == receipt_id)
            if receipt['status'] != 200:
                raise ValueError('An unsuccessful source must not enter the catalog: ' + receipt_id)
            raw = (root / receipt['path']).read_bytes()
            if receipt['path'].endswith('.gz'):
                raw = gzip.decompress(raw)
            if digest(raw) != receipt['sha256']:
                raise ValueError('Captured source checksum mismatch: ' + receipt_id)
            source_id = receipt['sha256'][:24]
            sources[source_id] = {k: receipt[k] for k in ['url', 'retrieved_at', 'sha256', 'last_modified', 'etag'] if k in receipt}
            sources[source_id].update(provider=dataset['provider'], dataset=dataset['dataset'], license=dataset['license'], raw_retention='GZIP_SNAPSHOT', period=dataset.get('period'), geography=dataset.get('geography'))
            payload = json.loads(raw)
            payload = payload if isinstance(payload, list) else payload['results']
            retained[source_id + '.json.gz'] = gzip.compress(raw, mtime=0)
            for source in payload:
                if kind == 'REGISTERED_MODEL':
                    row = {'id': identity(kind, source.get('merk'), source.get('handelsbenaming')), 'record_kind': kind,
                           'make': source.get('merk'), 'model': source.get('handelsbenaming'), 'registered_fleet_count': int(source['registered_count']), 'country': 'NL'}
                elif kind in ['TYPE_VARIANT', 'TECHNICAL_REPRESENTATIVE']:
                    key = [source.get(k) for k in ['Mk', 'Cn', 'T', 'Va', 'Ve', 'Ft', 'Fm']]
                    row = {'id': identity(kind, *key), 'record_kind': kind, 'make': source.get('Mk'), 'model': source.get('Cn'),
                           'type': source.get('T'), 'variant': source.get('Va'), 'version': source.get('Ve'), 'fuel': source.get('Ft'), 'fuel_mode': source.get('Fm'), 'period': dataset['period']}
                    if kind == 'TYPE_VARIANT':
                        row['reporting_rows'] = int(source['observations'])
                    else:
                        row.update(source_record_id=source['ID'], type_reference_id=identity('TYPE_VARIANT', *key), applicability='ONE_REPRESENTATIVE_REGISTRATION_PER_TYPE_VARIANT',
                                   country=source.get('MS'), registration_date=source.get('Dr'), engine_power_kw=source.get('Ep (KW)'), engine_displacement_cc=source.get('Ec (cm3)'),
                                   mass_kg=source.get('M (kg)'), co2_wltp_g_km=source.get('Ewltp (g/km)'), electric_consumption_wh_km=source.get('Z (Wh/km)'),
                                   type_approval=source.get('TAN'), manufacturer=source.get('Man'), source_status=source.get('Status'))
                elif kind == 'REGISTRATION_AGGREGATE':
                    row = {'id': identity(kind, source.get('Mk'), source.get('MS'), dataset['period']), 'record_kind': kind, 'make': source.get('Mk'), 'model': None,
                           'country': source.get('MS'), 'registrations': source['registrations'], 'period': dataset['period'], 'used_sales_transactions': None}
                else:
                    raise ValueError('Unsupported catalog kind')
                row['source_id'] = source_id
                rows.append(row)
                count += 1
        coverage[kind] = {'records': count, 'query_complete': dataset.get('query_complete', False), 'scope': dataset['scope'], 'specifications_complete': False}
    observations, history = {}, {}
    for filename in config.get('market_observation_files', []):
        for line in Path(filename).read_text().splitlines():
            row = json.loads(line)
            if row['record_kind'] != 'PUBLIC_LISTING_OBSERVATION' or row['provenance'].get('provider_api_connected') is not False:
                raise ValueError('Market observations must retain their public-page source boundary')
            row['id'] = identity('PUBLIC_LISTING_OBSERVATION', row['listing_id'])
            history.setdefault(row['listing_id'], []).append(row)
            current = observations.get(row['listing_id'])
            if current is None or row['provenance']['observed_at'] > current['provenance']['observed_at']:
                observations[row['listing_id']] = row
    rows.extend(observations.values())
    coverage['PUBLIC_LISTING_OBSERVATION'] = {'records': len(observations), 'inventory_complete': False, 'live_api_connected': False, 'sale_confirmed': False}
    ids = [row['id'] for row in rows]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate source identities: pagination or snapshot consistency must be resolved first')
    target.mkdir(parents=True, exist_ok=True)
    (target / 'raw').mkdir(exist_ok=True)
    for name, data in retained.items():
        (target / 'raw' / name).write_bytes(data)
    raw = json.dumps({'records': rows, 'sources': sources, 'market_observation_history': history}, ensure_ascii=False, separators=(',', ':')).encode()
    packed = gzip.compress(raw, mtime=0)
    (target / 'catalog.json.gz').write_bytes(packed)
    manifest = {'schema_version': 'foundly-public-automotive-catalog/1', 'snapshot_id': config['snapshot_id'], 'created_at': config['created_at'],
                'catalog_file': 'catalog.json.gz', 'catalog_sha256': digest(packed), 'uncompressed_sha256': digest(raw), 'compressed_bytes': len(packed), 'uncompressed_bytes': len(raw),
                'records': len(rows), 'source_count': len(sources), 'coverage': coverage, 'all_brands_all_years_complete': False,
                'make_labels': sorted(set(str(row.get('vehicle', {}).get('make') or row.get('make')) for row in rows if row.get('vehicle', {}).get('make') or row.get('make'))),
                'market_snapshot_not_live_inventory': True, 'private_customer_records': False, 'raw_sources': {name: digest(data) for name, data in retained.items()}}
    (target / 'catalog-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    print(json.dumps(build(json.loads(Path(sys.argv[1]).read_text()), Path(sys.argv[2])), ensure_ascii=False))
