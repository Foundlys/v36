# Dated market references

The 26 September 2026 snapshot contains 12 selected facts from five primary pages: ACEA EU new-car registrations through August 2026, CBS July 2026 online retail turnover, Volkswagen ID. Polo configuration/entry-price announcements and BMW's provisional Neue Klasse i3 announcement. This is a small curated starting set, not comprehensive live market coverage.

The records retain publication and retrieval dates, publisher URLs, market and period, model generation/configuration and provisional status. The capture is an extraction from retrieved primary pages. The manifest hash verifies the extracted factual snapshot, not original webpage bytes. No complete articles, images or contact details are redistributed; no broad licence for the source databases is asserted.

The Volkswagen German entry price is not assigned to every battery/trim or another country. The new BMW i3 is distinguished from the previous i3 hatchback. Announced production/delivery dates and provisional WLTP targets do not prove present stock, final approval or actual deliveries. CBS sector growth and ACEA registrations remain external context rather than customer truth or company forecasts.

`market-reference.js` checks the snapshot hash and sources and exposes bounded native reads at `/api/sales/market-reference` and `/api/procurement/market-reference`, subject to current module capabilities. The result reports publication/capture age and requires refresh after 45 days without a new capture. Recent capture never asserts that no newer publication exists. No continuous source-refresh worker has been implemented yet.

The Sales scenario route and structured ZERO `FORECAST_SCENARIO` accept up to eight explicit benchmark IDs, alongside the existing native opportunity filters and user assumptions. Benchmarks are returned as context and never automatically applied as a revenue multiplier. Exact amounts, currency separation, missing-data exclusions and source revisions remain native. `MARKET_REFERENCES` provides an explicit ZERO read; natural-query context is additionally bounded and relevant to the selected industry or explicit retail intent.

Backtesting, calibrated uncertainty, broader make/model/specification coverage, automatic refresh, stock-linked value estimates and the complete demo interface remain open acceptance work. A scenario forecast is not recognised accounting revenue or a guaranteed outcome.
