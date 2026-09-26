# Retained public reference data

These are dated reference observations for Foundly's normal application contracts. They are not customer records, live connector receipts, a complete marketplace crawl, or proof of completed sales. Runtime APIs enforce current module, role and capability permissions and return at most 100 records per page. ZERO receives bounded, explicitly external and non-executable context.

## Automotive — 26 September 2026

`snapshots/2026-09-26/catalog-manifest.json` describes the checked, compressed catalog. Its 214,175 records are different kinds of evidence:

| Kind | Records | Actual scope |
| --- | ---: | --- |
| RDW registered make/trade-name groups | 92,130 | Complete captured passenger-car grouping; 1,451 raw make labels are not 1,451 canonical manufacturers |
| EEA type/variant/version/fuel groups | 69,564 | Complete captured grouping of provisional 2025 new-car registration records |
| EEA technical representatives | 50,000 | Partial: one representative registration per selected group, not every car or every variant specification |
| EEA make/country registration aggregates | 2,243 | Sum of published registration counts; not used-car sales or option demand |
| Public listing observations | 238 | Dated observations from mobile.de, AutoScout24 NL, Marktplaats, Van Mossel, Cardoen, BMW NL, Porsche NL and Autohero DE |

RDW source: <https://opendata.rdw.nl/> — CC0. EEA/DG CLIMA source: <https://co2cars.apps.eea.europa.eu/> — CC BY 4.0, attribution to the European Environment Agency and European Commission Directorate-General for Climate Action (DG CLIMA); provisional data and original metadata are retained. Dataset URLs, queries, retrieval times, SHA-256 digests and raw licensed captures accompany the compiled snapshot.

An advertiser's asking price or minimum bid is not a sale price. Public listing access does not establish an API connection or complete/current dealer inventory. Market-source redistribution rights are marked `NOT_ESTABLISHED`; no photos, descriptions, private-seller contact data or embedded page configuration are included. The publication review must consider each source's actual permitted reuse before redistributing a demo package.

Later EEA retrieval encountered an HTTP tunnel 403. AutoScout24 BE/DE listing paths were skipped when robots disallowed them. Failed requests are retained. No access controls, credentials, proxies or TLS checks were bypassed.

Rebuild the exact record payload offline with:

```sh
python public-data/build-automotive-catalog.py public-data/snapshots/2026-09-26/build-config.json public-data/snapshots/2026-09-26
```

The build timestamp changes on rebuild. The payload and its content digests identify the captured data. `initial-manifest.json` and `expanded-manifest.json` also document earlier attempts; they are not assertions that every attempted payload is included. `market-coverage.json` describes only the original collection; `catalog-manifest.json` is the consolidated runtime scope.

## Product and price references — 26 September 2026

`ecommerce/2026-09-26/catalog-manifest.json` describes separately licensed public product data:

| Kind | Retained records | Actual scope |
| --- | ---: | --- |
| Open Food Facts product projection | 17,717 | Bounded prefix of the official bulk export |
| Open Beauty Facts product projection | 8,249 | Bounded prefix, selecting products with a name |
| Open Food Facts Belgium sample | 100 | One country-filtered page; source claims only |
| Open Prices price observations | 150,000 | Bounded export prefix with original decimal price, currency and date |
| Open Prices store references | 7,369 | Complete received location export, projected to public store reference fields |

There are 26,066 product reference rows, not necessarily distinct commercial products. The runtime currently indexes 26,065 valid numeric product codes; one source code fails the bounded numeric-code contract. The export prefixes are mostly US food products and do not represent a complete European assortment. Dedicated NL/DE product API requests returned HTTP 503; their failed receipts are retained. Price observations range across years and currencies, including missing and historical source values. They cannot establish current prices, stock, merchant costs, actual Foundly sales or a valuation. Barcode joins must be exact; absent product detail remains unknown.

Attribution: **Open Food Facts contributors**, **Open Beauty Facts contributors**, **Open Prices contributors**, and **OpenStreetMap contributors** for OSM store references. These public database projections are provided under **ODbL 1.0**: <https://opendatacommons.org/licenses/odbl/1-0/>. Individual OFF database contents use the Database Contents License: <https://opendatacommons.org/licenses/dbcl/1-0/>. The retained projections, extraction method and receipts are distributed with the source so the public reference data can be reused under its license. They remain separate from private tenant records and synthetic demo transactions. No contributor identities, receipt images or product images are redistributed.

Primary documentation:

- <https://openfoodfacts.github.io/openfoodfacts-server/api/>
- <https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/>
- <https://openfoodfacts.github.io/open-prices/guides/data/>
- <https://openfoodfacts.github.io/open-prices/guides/import-data/>

`collect-open-products.py` reads documented bulk exports once with explicit row, byte and time limits and no retries. Each receipt distinguishes a partial prefix from complete EOF. `network_prefix_sha256` hashes only the bytes actually read; it is not a checksum of an unreceived full export. `output_sha256` identifies the complete, retained field projection. Source provenance verifies collection, not every contributed factual claim.
