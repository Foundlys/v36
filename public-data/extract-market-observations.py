"""Extract factual listing observations from captured public pages, without JS execution.

No descriptions, photographs, personal seller names, contacts, tracking IDs,
cookies or page configuration are exported. Observations never imply API access,
complete inventory, a completed sale or a verified transaction price.
"""
import ast
from collections import Counter
from decimal import Decimal, InvalidOperation
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import urllib.parse
import warnings

VERSION = 'foundly-public-market-extractor/1.0.0'


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.active = None
        self.buffer = []
        self.scripts = []
        self.links = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script':
            self.active, self.buffer = attrs, []
        if tag == 'a' and attrs.get('href'):
            self.links.append(attrs['href'])

    def handle_data(self, value):
        if self.active is not None:
            self.buffer.append(value)

    def handle_endtag(self, tag):
        if tag == 'script' and self.active is not None:
            self.scripts.append((self.active, ''.join(self.buffer)))
            self.active = None


def walk(value, depth=0):
    if depth > 100:
        return
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from walk(item, depth + 1)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item, depth + 1)


def documents(page):
    docs = []
    chunks = []
    decoder = json.JSONDecoder()
    for attrs, raw in page.scripts:
        if attrs.get('type') in ('application/ld+json', 'application/json'):
            try:
                docs.append((attrs, json.loads(raw)))
            except (ValueError, TypeError):
                pass
        for match in re.finditer(r'self\.__next_f\.push\(', raw):
            try:
                item, _ = decoder.raw_decode(raw[match.end():])
                if len(item) > 1 and isinstance(item[1], str):
                    chunks.append(item[1])
            except (ValueError, TypeError):
                pass
    # React's transport may split a JSON row across consecutive string chunks.
    for line in ''.join(chunks).splitlines():
        parts = line.split(':', 1)
        if len(parts) == 2:
            try:
                docs.append(({'format': 'RSC_JSON'}, json.loads(parts[1])))
            except ValueError:
                pass
    return docs


def amount(value, formatted=False):
    if value is None or isinstance(value, bool):
        return None
    value = str(value).strip()
    if formatted:
        value = re.sub(r'[^0-9,.-]', '', value).replace('.', '').replace(',', '.')
    if not re.fullmatch(r'\d+(?:\.\d+)?', value):
        return None
    try:
        number = Decimal(value)
        return format(number.quantize(Decimal('0.01')), 'f') if number.is_finite() and number >= 0 else None
    except InvalidOperation:
        return None


def numeric(value, formatted=False):
    result = amount(value, formatted)
    return float(result) if result is not None else None


def month(value):
    m = re.fullmatch(r'(\d{2})[-/](\d{4})', str(value or ''))
    if m and 1 <= int(m[1]) <= 12:
        return m[2] + '-' + m[1]
    return value if re.fullmatch(r'\d{4}-\d{2}(?:-\d{2})?', str(value or '')) else None


def kw(value):
    match = re.search(r'(\d+(?:[.,]\d+)?)\s*kW', str(value or ''), re.I)
    return float(match[1].replace(',', '.')) if match else None


def public_url(value, source_url):
    if not value:
        return None
    url = urllib.parse.urljoin(source_url, value)
    parsed = urllib.parse.urlsplit(url)
    return url if parsed.scheme == 'https' and parsed.hostname == urllib.parse.urlsplit(source_url).hostname and not parsed.username and not parsed.password else None


def record(source, external_id, vehicle, price=None, price_type='UNKNOWN', url=None, seller=None, path=None, availability='ADVERTISED', currency=None):
    source_id = source.get('provider', source['id'])
    return {
        'listing_id': source_id + ':' + str(external_id),
        'source_record_id': str(external_id),
        'record_kind': 'PUBLIC_LISTING_OBSERVATION',
        'vehicle': vehicle,
        'price': {'amount': price, 'currency': currency, 'type': price_type if price is not None else 'UNKNOWN', 'vat_status': 'UNKNOWN'},
        'seller': seller or {'type': 'UNKNOWN'},
        'availability_at_observation': availability,
        'provenance': {
            'classification': 'PUBLIC_VERIFIED', 'authority': 'PUBLIC_ADVERTISER_CLAIM',
            'provider': source_id, 'observation_page': source['url'], 'listing_url': public_url(url, source['url']),
            'observed_at': source['retrieved_at'], 'snapshot_sha256': source['sha256'],
            'extraction_path': path, 'transformation_version': VERSION,
            'provider_api_connected': False, 'inventory_complete': False, 'specifications_complete': False,
            'sale_confirmed': False, 'reuse_license': source.get('reuse_license', 'NOT_ESTABLISHED')
        }
    }


def nuxt_value(table, index, depth=0):
    if not isinstance(index, int) or index < 0 or index >= len(table) or depth > 20:
        return None
    value = table[index]
    if isinstance(value, dict):
        return {k: nuxt_value(table, v, depth + 1) for k, v in value.items()}
    if isinstance(value, list):
        return [nuxt_value(table, v, depth + 1) for v in value]
    return value


def extract(html, source):
    page = Page(html)
    docs = documents(page)
    output = []
    host = urllib.parse.urlsplit(source['url']).hostname
    if host == 'www.autohero.com':
        # Apollo's public render state is a JSON string literal. Do not evaluate
        # any JavaScript or read configuration/account state from the page.
        for attrs, raw in page.scripts:
            match = re.search(r'window\.__APOLLO_STATE__\s*=\s*', raw)
            if not match:
                continue
            try:
                state, _ = json.JSONDecoder().raw_decode(raw[match.end():])
                state = json.loads(state) if isinstance(state, str) else state
            except (ValueError, TypeError):
                continue
            for item in walk(state):
                if not all(key in item for key in ('id', 'manufacturer', 'model', 'offerPrice', 'mileage')):
                    continue
                money = item['offerPrice']
                value = amount(Decimal(str(money['amountMinorUnits'])) / 100) if money.get('conversionMajor') == 100 and money.get('amountMinorUnits') is not None else None
                mileage = item.get('mileage') or {}
                vehicle = {'make': item['manufacturer'], 'model': item['model'], 'variant': item.get('subType'), 'trim': item.get('subTypeExtra'),
                           'year': item.get('builtYear'), 'first_registration_year': item.get('firstRegistrationYear'), 'power_kw': item.get('kw'),
                           'engine_displacement_cc': item.get('ccm'), 'mileage_km': mileage.get('distance') if mileage.get('unit') == 'KM' else None,
                           'drivetrain': item.get('driveTrain'), 'source_fuel_type_code': item.get('fuelType'), 'source_gear_type_code': item.get('gearType'),
                           'co2_reported_g_km': item.get('co2Value'), 'co2_test_procedure': None}
                # Numeric provider enum codes stay uninterpreted until their
                # dictionary is observed. No guessed fuel/transmission values.
                output.append(record(source, item['id'], vehicle, value, 'ASKING', None, {'type': 'DEALER', 'name': 'Autohero', 'country': item.get('countryCode')}, '__APOLLO_STATE__/public-car-summary', 'COMING_SOON' if item.get('isComingSoon') else 'ADVERTISED', money.get('currency')))
    ld_cars = {}
    for attrs, doc in docs:
        if attrs.get('type') != 'application/ld+json':
            continue
        for item in walk(doc):
            types = item.get('@type', [])
            types = types if isinstance(types, list) else [types]
            if not any(t in types for t in ('Car', 'Vehicle')):
                continue
            offer = item.get('offers', {})
            if not isinstance(offer, dict) or offer.get('@type') == 'AggregateOffer':
                continue
            url = public_url(offer.get('url') or item.get('url'), source['url'])
            if not url:
                continue
            ld_cars[url] = item
            # Platform-specific parsers below retain richer exact IDs and fields.
            if host in ('www.autoscout24.nl', 'www.vanmossel.nl'):
                continue
            brand = item.get('brand', {})
            make = brand.get('name') if isinstance(brand, dict) else brand
            engine = item.get('vehicleEngine', {})
            odometer = item.get('mileageFromOdometer', {})
            vehicle = {'make': make, 'model': item.get('model'), 'variant': item.get('vehicleConfiguration'),
                       'title': item.get('name'), 'model_date': item.get('vehicleModelDate'), 'fuel': item.get('fuelType') or engine.get('fuelType'),
                       'transmission': item.get('vehicleTransmission'), 'body_type': item.get('bodyType'), 'color': item.get('color'),
                       'mileage_km': odometer.get('value') if odometer.get('unitCode') == 'KMT' else None,
                       'drivetrain': item.get('driveWheelConfiguration')}
            seller = offer.get('seller', {})
            seller = {'type': 'DEALER', 'name': seller.get('name')} if seller.get('@type') == 'AutoDealer' else {'type': 'UNKNOWN'}
            output.append(record(source, url, vehicle, amount(offer.get('price')), 'ASKING', url, seller, 'application/ld+json/Car', 'REPORTED_IN_STOCK' if offer.get('availability') == 'https://schema.org/InStock' else 'ADVERTISED', offer.get('priceCurrency')))
    for attrs, doc in docs:
        props = doc.get('props', {}).get('pageProps', {}) if isinstance(doc, dict) else {}
        if 'autoscout24.' in host and props.get('listings'):
            for item in props['listings']:
                v, p, seller = item.get('vehicle', {}), item.get('price', {}), item.get('seller', {})
                details = {d.get('iconName'): d.get('data') for d in item.get('vehicleDetails', [])}
                vehicle = {'make': v.get('make'), 'model': v.get('model'), 'model_group': v.get('modelGroup'), 'variant': v.get('modelVersionInput'),
                           'first_registration': month(details.get('calendar')), 'mileage_km': numeric(v.get('mileageInKm'), True),
                           'fuel': v.get('fuel'), 'transmission': v.get('transmission'), 'engine_displacement_cc': numeric(v.get('engineDisplacementInCCM'), True),
                           'power_kw': kw(details.get('speedometer')), 'equipment_reported': [s.strip() for s in (v.get('subtitle') or '').split(',') if s.strip()]}
                dealer = {'type': 'DEALER', 'name': seller.get('companyName')} if seller.get('type') == 'Dealer' else {'type': 'PRIVATE'}
                dealer['country'] = item.get('location', {}).get('countryCode')
                output.append(record(source, item['id'], vehicle, amount(p.get('priceRaw')), 'CONDITIONAL_ASKING' if p.get('isConditionalPrice') else 'ASKING', item.get('url'), dealer, '__NEXT_DATA__/props/pageProps/listings', currency='EUR' if str(p.get('priceFormatted', '')).startswith('€') else None))
        if host == 'www.marktplaats.nl' and props.get('searchRequestAndResponse'):
            search = props['searchRequestAndResponse']
            for item in search.get('listings', []):
                attributes = {a['key']: a.get('value') for a in item.get('attributes', []) + item.get('extendedAttributes', [])}
                options = next((a.get('values', []) for a in item.get('attributes', []) if a.get('key') == 'options'), [])
                category = search.get('categoriesById', {}).get(str(item.get('categoryId')), {})
                vehicle = {'make': category.get('name') if isinstance(category, dict) else None, 'model': attributes.get('model'), 'title': item.get('title'),
                           'year': numeric(attributes.get('constructionYear')), 'mileage_km': numeric(attributes.get('mileage')), 'fuel': attributes.get('fuel'),
                           'transmission': attributes.get('transmission'), 'body_type': attributes.get('body'), 'drivetrain': attributes.get('driveTrain'), 'equipment_reported': options}
                p = item.get('priceInfo', {})
                cents = p.get('priceCents')
                price = amount(Decimal(str(cents)) / 100) if isinstance(cents, (int, float)) and cents > 0 else None
                types = {'FIXED': 'ASKING', 'MIN_BID': 'MINIMUM_BID', 'BID': 'BIDDING', 'RESERVED': 'RESERVED'}
                output.append(record(source, item['itemId'], vehicle, price, types.get(p.get('priceType'), p.get('priceType', 'UNKNOWN')), item.get('vipUrl'), {'type': 'UNKNOWN', 'country': item.get('location', {}).get('countryAbbreviation')}, '__NEXT_DATA__/props/pageProps/searchRequestAndResponse/listings', 'RESERVED' if item.get('reserved') else 'ADVERTISED', 'EUR'))
        if host == 'suchen.mobile.de':
            for container in walk(doc):
                result = container.get('searchResults')
                if not isinstance(result, dict):
                    continue
                for item in result.get('listings', []):
                    a = item.get('attr', {})
                    vehicle = {'make': item.get('make', {}).get('localized'), 'model': item.get('model', {}).get('localized'),
                               'first_registration': month(a.get('fr')), 'mileage_km': numeric(a.get('ml'), True), 'power_kw': kw(a.get('pw')),
                               'engine_displacement_cc': numeric(a.get('cc'), True), 'fuel': a.get('ft'), 'transmission': a.get('tr'), 'body_type': a.get('c'),
                               'color': a.get('ecol'), 'emission_class': a.get('emc'), 'seats': numeric(a.get('sc'))}
                    price = item.get('price', {}).get('grs', {}).get('amount')
                    # The rendered search payload may not contain a per-ad URL.
                    # Preserve the exact ad ID and page, never fabricate a link.
                    output.append(record(source, item['id'], vehicle, amount(price), 'ASKING', None, {'type': 'UNKNOWN', 'country': a.get('cn')}, 'RSC_JSON/searchResults/listings', currency='EUR'))
        if host == 'www.vanmossel.nl' and attrs.get('id') == '__NUXT_DATA__' and isinstance(doc, list):
            for index, item in enumerate(doc):
                if not isinstance(item, dict) or not all(k in item for k in ('id', 'brand', 'model', 'price', 'slug', 'specs')):
                    continue
                item = nuxt_value(doc, index)
                specs = {s['type']: s.get('value') for s in item.get('specs', [])}
                vehicle = {'make': item.get('brand'), 'model': item.get('model'), 'variant': item.get('type'), 'year': item.get('year'),
                           'mileage_km': item.get('condition', {}).get('odometer', {}).get('value_in_km'), 'fuel': specs.get('fuel'), 'transmission': specs.get('transmission_type')}
                url = next((url for url in ld_cars if '/'+str(item['id'])+'-' in url), None)
                seller = item.get('advertiser', {})
                p = item.get('price', {}).get('purchase') or {}
                output.append(record(source, item['id'], vehicle, amount(p.get('formatted'), True), 'ASKING', url, {'type': 'DEALER', 'name': seller.get('name'), 'country': str(seller.get('country', '')).upper()}, '__NUXT_DATA__/vehicle', currency='EUR'))
    if host == 'occasions.bmw.nl':
        for attrs, raw in page.scripts:
            match = re.search(r"Action.loadVehicles\(\$\.parseJSON\(('(?:\\.|[^'\\])*')\)", raw)
            if not match:
                continue
            with warnings.catch_warnings():
                warnings.simplefilter('ignore', SyntaxWarning)
                payload = json.loads(ast.literal_eval(match[1]))  # String literal only; never eval page code.
            for item in payload.get('vehicles', []):
                vehicle = {'make': 'BMW', 'model': item.get('model'), 'variant': item.get('engine'), 'title': item.get('name'),
                           'first_registration': month(item.get('datePartOne')), 'mileage_km': numeric(item.get('mileage')),
                           'fuel': item.get('fuel'), 'transmission': item.get('transmission'), 'power_kw': numeric(item.get('powerKw')),
                           'power_hp': numeric(item.get('powerHp')), 'engine_displacement_cc': numeric(item.get('cylinderVolume')), 'registration': item.get('licensePlateScreen')}
                output.append(record(source, item['vehicleId'], vehicle, amount(item.get('price')), 'ASKING', None, {'type': 'DEALER', 'name': item.get('dealerName'), 'country': 'NL'}, 'Action.loadVehicles/vehicles', currency='EUR'))
    # Repeated cards are the same listing; similar cars on other websites are not.
    unique = {}
    for item in output:
        unique.setdefault(item['listing_id'], item)
    return list(unique.values())


def main():
    root, target = Path(sys.argv[1]), Path(sys.argv[2])
    manifest = json.loads((root / 'manifest.json').read_text())
    output, reports = [], []
    for source in manifest:
        if source.get('format') != 'html' or source.get('status') != 200:
            continue
        raw = (root / source['path']).read_bytes()
        if hashlib.sha256(raw).hexdigest() != source['sha256']:
            raise ValueError('Source snapshot checksum mismatch: ' + source['id'])
        rows = extract(raw.decode('utf-8', errors='replace'), source)
        reports.append({'source': source['id'], 'page': source['url'], 'observed_at': source['retrieved_at'], 'snapshot_sha256': source['sha256'], 'listing_observations': len(rows), 'complete_inventory': False})
        output.extend(rows)
    target.mkdir(parents=True, exist_ok=True)
    (target / 'market-observations.jsonl').write_text(''.join(json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n' for row in output))
    (target / 'market-coverage.json').write_text(json.dumps({'version': VERSION, 'observations': len(output), 'sources': reports, 'source_makes': dict(Counter(row['vehicle'].get('make') for row in output if row['vehicle'].get('make')))}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'observations': len(output), 'sources': reports}, ensure_ascii=False))


if __name__ == '__main__':
    main()
