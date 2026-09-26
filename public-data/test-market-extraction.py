import importlib.util
from pathlib import Path
import unittest
import json

spec = importlib.util.spec_from_file_location('extractor', Path(__file__).with_name('extract-market-observations.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
SOURCE = {'id': 'fixture', 'url': 'https://www.marktplaats.nl/l/auto-s/', 'retrieved_at': '2026-09-26T18:00:00Z', 'sha256': 'fixture-not-live-data'}


class ExtractionTests(unittest.TestCase):
    def test_currency_units_and_missing_prices(self):
        self.assertEqual(m.amount('€ 31.489,99', True), '31489.99')
        self.assertEqual(m.amount(31489.99), '31489.99')
        self.assertIsNone(m.amount(None))
        self.assertIsNone(m.amount('Op aanvraag', True))
        self.assertEqual(m.numeric('278.120 km', True), 278120)
        self.assertEqual(m.kw('135 kW (184 PK)'), 135)
        self.assertEqual(m.month('06/2014'), '2014-06')

    def test_bid_is_not_an_asking_price_and_personal_contact_is_not_exported(self):
        item = {'itemId': 'fixture-1', 'categoryId': 96, 'title': 'BMW 320', 'priceInfo': {'priceCents': 495000, 'priceType': 'MIN_BID'}, 'sellerInformation': {'sellerName': 'PRIVATE PERSON', 'phone': 'PRIVATE PHONE'}, 'description': 'PRIVATE LONG DESCRIPTION', 'attributes': [{'key': 'mileage', 'value': '12345'}], 'vipUrl': '/v/auto-s/bmw/fixture-1'}
        payload = {'props': {'pageProps': {'searchRequestAndResponse': {'listings': [item, item], 'categoriesById': {'96': {'name': 'BMW'}}}}}}
        page = '<script id="__NEXT_DATA__" type="application/json">' + json.dumps(payload) + '</script>'
        rows = m.extract(page, SOURCE)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['price'], {'amount': '4950.00', 'currency': 'EUR', 'type': 'MINIMUM_BID', 'vat_status': 'UNKNOWN'})
        self.assertEqual(rows[0]['vehicle']['make'], 'BMW')
        self.assertNotIn('PRIVATE', json.dumps(rows))
        self.assertFalse(rows[0]['provenance']['provider_api_connected'])
        self.assertFalse(rows[0]['provenance']['sale_confirmed'])

    def test_off_origin_and_javascript_links_cannot_become_listing_links(self):
        for value in ['javascript:alert(1)', 'https://outside.example/car', 'https://user:password@www.marktplaats.nl/car']:
            self.assertIsNone(m.public_url(value, SOURCE['url']))

    def test_script_is_parsed_as_data_and_is_never_executed(self):
        self.assertEqual(m.extract('<script>throw new Error("should never execute")</script>', SOURCE), [])


if __name__ == '__main__':
    unittest.main()
