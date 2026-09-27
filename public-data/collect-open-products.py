#!/usr/bin/env python3
"""Bounded, one-request samples of the officially published bulk exports.

No credentials, pagination loop, retries or individual-product crawl. The output
is an ODbL-licensed field projection, not an assertion of complete/live inventory.
Private contributor identifiers and receipt images are deliberately not retained.
"""
import argparse
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
from pathlib import Path
import time
import urllib.request

PRODUCT_FIELDS = {'code', 'product_name', 'product_name_en', 'product_name_nl', 'product_name_fr', 'product_name_de',
                  'generic_name', 'brands', 'brands_tags', 'quantity', 'product_quantity', 'product_quantity_unit',
                  'categories', 'categories_tags', 'countries', 'countries_tags', 'packaging', 'packaging_tags',
                  'labels', 'labels_tags', 'ingredients_text', 'ingredients_text_nl', 'ingredients_text_en',
                  'allergens', 'allergens_tags', 'traces', 'nutriscore_grade', 'nutrition_grade_fr', 'ecoscore_grade',
                  'nova_group', 'nutriments', 'serving_size', 'last_modified_t', 'created_t', 'url'}
PRICE_FIELDS = {'id', 'product_code', 'product_name', 'category_tag', 'labels_tags', 'origins_tags',
                'price', 'price_per', 'currency', 'date', 'price_is_discounted', 'price_without_discount',
                'discount_type', 'location_id', 'created', 'updated', 'type', 'source'}
LOCATION_FIELDS = {'id', 'osm_id', 'osm_type', 'osm_name', 'osm_brand', 'osm_country', 'osm_country_code',
                   'osm_city', 'osm_postcode', 'type', 'name', 'website_url', 'city', 'country', 'country_code'}
SOURCES = {
    'food-products': ('https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz', 'jsonl.gz', PRODUCT_FIELDS, 'Open Food Facts'),
    'beauty-products': ('https://static.openbeautyfacts.org/data/en.openbeautyfacts.org.products.csv', 'tsv', PRODUCT_FIELDS, 'Open Beauty Facts'),
    'price-observations': ('https://prices.openfoodfacts.org/data/prices.jsonl.gz', 'jsonl.gz', PRICE_FIELDS, 'Open Prices'),
    'store-locations': ('https://prices.openfoodfacts.org/data/locations.jsonl.gz', 'jsonl.gz', LOCATION_FIELDS, 'Open Prices / OpenStreetMap contributors'),
}
ALLOWED_HOSTS = {'static.openfoodfacts.org', 'static.openbeautyfacts.org', 'prices.openfoodfacts.org', 'openfoodfacts-ds.s3.eu-west-3.amazonaws.com'}

class AllowedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        from urllib.parse import urlparse
        p = urlparse(newurl)
        if p.scheme != 'https' or p.hostname not in ALLOWED_HOSTS or p.username or p.password:
            raise ValueError('Export redirect outside documented source hosts')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

class LimitReached(Exception):
    pass

class MeteredReader(io.RawIOBase):
    def __init__(self, response, max_bytes, seconds):
        self.response, self.max_bytes, self.deadline = response, max_bytes, time.monotonic() + seconds
        self.bytes = 0
        self.sha = hashlib.sha256()
    def readable(self):
        return True
    def readinto(self, target):
        if self.bytes >= self.max_bytes or time.monotonic() > self.deadline:
            raise LimitReached('byte_or_duration_limit')
        b = self.response.read(min(len(target), self.max_bytes - self.bytes))
        self.bytes += len(b)
        self.sha.update(b)
        target[:len(b)] = b
        return len(b)

def project(row, fields):
    # Retain only bounded, named public product facts. No contributor profiles,
    # source scripts, image metadata or arbitrary nested user-submitted objects.
    result = {}
    for key in fields:
        value = row.get(key)
        if value is None or value == '' or value == []:
            continue
        if isinstance(value, (str, int, float, bool)):
            if not isinstance(value, str) or len(value) <= 10000:
                result[key] = value
        elif isinstance(value, list) and len(value) <= 200 and all(isinstance(v, (str, int, float, bool)) for v in value):
            result[key] = value
        elif key == 'nutriments' and isinstance(value, dict):
            result[key] = {k: v for k, v in value.items() if isinstance(v, (str, int, float)) and len(str(v)) <= 100}
    return result

def collect(source, outdir, max_rows, max_bytes, seconds):
    url, fmt, fields, attribution = SOURCES[source]
    target = outdir / (source + '.jsonl.gz')
    receipt_file = outdir / (source + '.receipt.json')
    if target.exists() or receipt_file.exists():
        raise FileExistsError('Preserve the prior capture; use a new output directory')
    receipt = {'schema_version': 'foundly-open-product-capture/1', 'source_id': source, 'source_url': url,
               'observed_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'license': 'ODbL-1.0',
               'license_url': 'https://opendatacommons.org/licenses/odbl/1-0/', 'attribution': attribution,
               'record_kind': 'PUBLIC_PRICE_OBSERVATION' if source == 'price-observations' else 'PUBLIC_STORE_REFERENCE' if source == 'store-locations' else 'PUBLIC_PRODUCT_REFERENCE',
               'authority': 'PUBLIC_CONTRIBUTOR_CLAIM', 'customer_truth': False, 'inventory_complete': False,
               'live_stock_verified': False, 'provider_api_connected': False, 'full_export_received': False,
               'selected_rows': 0, 'source_rows_read': 0, 'invalid_rows': 0, 'duplicate_rows': 0,
               'limits': {'selected_rows': max_rows, 'network_bytes': max_bytes, 'seconds': seconds},
               'field_projection': sorted(fields), 'retains_contributor_identity': False, 'retains_images': False}
    metered = None
    identities = set()
    try:
        opener = urllib.request.build_opener(AllowedRedirect())
        request = urllib.request.Request(url, headers={'User-Agent': 'Foundly-Public-Reference/1.0 (+https://github.com/Foundlys/v36)', 'Accept-Encoding': 'identity'})
        with opener.open(request, timeout=30) as response:
            receipt.update(http_status=response.status, final_url=response.url,
                           source_headers={k.lower(): v for k, v in response.headers.items() if k.lower() in {'content-type', 'content-length', 'etag', 'last-modified'}})
            metered = MeteredReader(response, max_bytes, seconds)
            stream = io.BufferedReader(metered, 65536)
            decoded = gzip.GzipFile(fileobj=stream) if fmt == 'jsonl.gz' else stream
            text = io.TextIOWrapper(decoded, encoding='utf-8-sig', errors='strict')
            csv.field_size_limit(1_000_000)
            rows = csv.DictReader(text, delimiter='\t') if fmt == 'tsv' else text
            with target.open('xb') as raw_out, gzip.GzipFile(fileobj=raw_out, mode='wb', mtime=0) as output:
                for value in rows:
                    receipt['source_rows_read'] += 1
                    try:
                        row = json.loads(value) if isinstance(value, str) else value
                        selected = project(row, fields)
                        identity = str(selected.get('code') if 'products' in source else selected.get('id') or '')
                        if not identity or 'products' in source and not any(selected.get(k) for k in ['product_name', 'product_name_nl', 'product_name_en', 'product_name_de', 'product_name_fr']):
                            receipt['invalid_rows'] += 1
                            continue
                        if identity in identities:
                            receipt['duplicate_rows'] += 1
                            continue
                        identities.add(identity)
                        payload = json.dumps(selected, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()
                        output.write(payload + b'\n')
                        receipt['selected_rows'] += 1
                        if receipt['selected_rows'] >= max_rows:
                            receipt['stop_reason'] = 'selected_row_limit'
                            break
                    except (ValueError, TypeError, AttributeError):
                        receipt['invalid_rows'] += 1
                else:
                    receipt['full_export_received'] = True
                    receipt['stop_reason'] = 'source_eof'
            receipt['status'] = 'COLLECTED_COMPLETE' if receipt['full_export_received'] else 'COLLECTED_PARTIAL'
    except LimitReached as error:
        receipt.update(status='COLLECTED_PARTIAL', stop_reason=str(error))
    except Exception as error:
        receipt.update(status='PARTIAL_SOURCE_ERROR' if receipt['selected_rows'] else 'SOURCE_UNAVAILABLE', error_type=type(error).__name__, error=str(error)[:500])
    finally:
        if metered:
            receipt.update(network_bytes_read=metered.bytes, network_prefix_sha256=metered.sha.hexdigest())
        if target.exists():
            receipt.update(output_file=target.name, output_bytes=target.stat().st_size, output_sha256=hashlib.sha256(target.read_bytes()).hexdigest())
        receipt['finished_at'] = dt.datetime.now(dt.timezone.utc).isoformat()
        receipt_file.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    return receipt

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('source', choices=SOURCES)
    p.add_argument('output_directory', type=Path)
    p.add_argument('--rows', type=int, default=25000)
    p.add_argument('--max-mib', type=int, default=64)
    p.add_argument('--seconds', type=int, default=180)
    a = p.parse_args()
    if not 1 <= a.rows <= 250000 or not 1 <= a.max_mib <= 128 or not 1 <= a.seconds <= 600:
        p.error('Collection limits exceed the bounded export policy')
    a.output_directory.mkdir(parents=True, exist_ok=True)
    print(json.dumps(collect(a.source, a.output_directory, a.rows, a.max_mib * 1024 * 1024, a.seconds)), flush=True)
