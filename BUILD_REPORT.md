# Foundly OS v6.0.0 verification and release report

Date: 2026-09-04

This report is secondary evidence. Repository code, immutable git objects, automated tests, the deployed runtime, and real external-provider responses remain the sources of truth.

## Preserved release lineage

- preserved production baseline: `v5.4.0`
- baseline merge commit on `main`: `205427e42d0cc617cd06abf94062ead7f65e796e`
- completed v6 implementation commit: `1181861e47388b3955ca1e1252e3825d6731d7a1`
- completed v6 implementation tree: `64e172fecd6a271d849801a19caea365bd825a92`
- release branch: `release/foundly-v6.0.0`
- repository: `Foundlys/v36`

The v6 implementation is a strict descendant of the merged v5.4.0 baseline. No v5.4.0 Neural, ZERO, CRM, OAuth, security, persistence, worker, connector, provenance, speech, audio, or renderer work was rebuilt or discarded.

## Reconstructed master-phase status

The phase status below is derived from the committed implementation, public contracts, regression suites, full-platform end-to-end fixture, and live runtime responses.

| Phase | Scope | Gate | Evidence |
| --- | --- | --- | --- |
| 0 | Preserve and release v5.4.0 baseline | PASS | `main` contains merge commit `205427e`; all legacy suites pass unchanged on v6 |
| 1 | Canonical tenant data foundation | PASS | schema migrations, canonical records, append-only events, deduplication, provenance, encrypted persistence, content-addressed manifests, retention, offline outbox, recovery |
| 2 | Realtime and historical Analysis | PASS | canonical ingest, shared incremental fact cache, realtime feed, paginated rollups, versioned KPI Registry, drilldown, freshness, attribution, commercial funnel, campaign outcome deduplication |
| 3 | Measurement architecture and delivery adapters | CODE PASS / LIVE EXTERNAL | Meta CAPI, GA4 Measurement Protocol and Google Ads enhanced-conversion contracts exist; consent and identity gates pass; no real provider delivery is claimed without credentials and provider receipts |
| 4 | Foundly Finance and Dutch fiscal guardrails | PASS | double-entry posting, invoices, purchase approval, partial payment, credit notes, AP/AR, bank reconciliation, document review, assets, reports, budgets, forecasts, close, reversals and audited export |
| 5 | Knowledge and Learning | PASS | typed evidence lifecycle, confidence, validity, supersession, permission filtering, feedback and outcome evaluation; no automatic-retraining claim |
| 6 | Connector lifecycle, Automation and Auto-Provisioner | PASS | truthful connector state machine, checkpoints, attempts, signed webhook records, replay-safe workflows, high-risk approval gates and five configuration-driven capability packs |
| 7 | ZERO cross-platform orchestration | PASS | authoritative server-side tools for Analysis, Finance, Knowledge and Automation; idempotency, confirmation, verification, audit and legacy `/api/jarvis/*` aliases retained |
| 8 | Business workspaces | CONTRACT PASS | responsive `/analysis` and `/finance` workspaces, strict CSP assets, accessible empty states, persisted-record-only displays, exports and ZERO entry points |
| 9 | Integrated platform journey | PASS | deterministic end-to-end lead → CRM → won deal → invoice → payment → reconciliation → attribution → knowledge → learning → ZERO answer; encrypted restart persistence passes |
| 10 | GitHub release and Railway runtime | PARTIAL | release branch is committed/pushed; GitHub Actions passes; live `/api/health` reports v6.0.0, but public `/api/ready` remains FAIL on external Railway configuration listed below |

## Local and CI result

`npm test`: PASS (`exit 0`)

GitHub Actions `Production architecture tests`: PASS for implementation commit `1181861e47388b3955ca1e1252e3825d6731d7a1` (run `33876702491`).

### Preserved platform gates

- server, UI and test JavaScript syntax: PASS
- core persistence, encryption and full restart: PASS
- 93 connector schema/status contracts: PASS
- source/provenance contracts and truthful provider state: PASS
- worker execution, retry persistence and recovery: PASS
- exact production authentication normalization and timing-safe comparison: PASS
- tenant-header isolation, SSRF protection and secret-safe diagnostics: PASS
- known/default encryption secrets and unsafe production origins rejected: PASS
- Meta, Google, LinkedIn, TikTok and Wix OAuth callback bypass of Basic Auth: PASS
- hashed/HMAC-bound persisted OAuth state, TTL, lease, replay defense and transient retry: PASS
- native provider token encryption, probe, bootstrap and restart: PASS with mocked provider responses
- ZERO Realtime ephemeral credential/origin/session contract: PASS with mocked OpenAI response
- current search, weather/news routing, deterministic time and follow-up context: PASS
- idempotent tool execution, encrypted confirmation, prompt-injection defense and audit: PASS
- bounded, persisted and deletable conversation memory: PASS
- hands-free client, local double-clap gate, standby privacy and failure isolation: PASS
- deterministic WebGL2/HDR renderer, motion samples, adaptive quality, bloom and occlusion source contracts: PASS
- display/spoken split, Dutch normalization and audio-reactive output contract: PASS
- 38-collection CRM Core, RBAC, Customer 360, pipelines, analytics, dashboards, automation and standalone runtime: PASS

### New v6 platform gates

- platform schema and non-destructive migrations: PASS
- tenant isolation across platform and finance domains: PASS
- immutable canonical events and provider/internal deduplication: PASS
- realtime aggregation and server-paginated historical rollups: PASS
- incrementally updated shared fact cache: PASS
- versioned KPI Registry, empty-state semantics and record drilldown: PASS
- attribution, commercial funnel and revenue/margin double-count protection: PASS
- Meta and Google measurement contracts: CONFIGURED/UNVERIFIED until real provider access succeeds
- Dutch BTW rule, invoice-requirement and retention guardrails: PASS
- non-BTW Dutch tax domains: ARCHITECTURE-ONLY by design
- canonical data online/offline, conflict and recovery contracts: PASS
- Knowledge lifecycle and Learning feedback/outcome evaluation: PASS
- connector lifecycle, checkpoints, attempts and webhook records: PASS
- replay-safe Automation execution and explicit high-risk approval: PASS
- Auto-Provisioner capability packs: PASS
- double-entry ledger balance and immutable-posting/reversal contract: PASS
- sales and purchase invoices, partial payments, credit notes and counterparties: PASS
- bank import, proposals and explicitly confirmed reconciliation: PASS
- source-document confidence/review gate: PASS
- fixed assets with separate book/fiscal values: PASS
- P&L, balance sheet, cash flow, AR/AP aging, VAT, margin, budget and forecast reports: PASS
- tenant-scoped, permission-gated audited exports: PASS
- period close and reversal controls: PASS
- Analysis and Finance API authentication and SSE contract: PASS
- Analysis and Finance responsive/CSP/accessibility/empty-state contracts: PASS
- full-platform end-to-end deterministic journey and encrypted restart: PASS

## Official fiscal-source verification

The committed fiscal metadata was rechecked on 2026-09-04 against the official Belastingdienst pages referenced by the code:

- BTW rates: 21%, 9%, 0% and exemption categories;
- statutory invoice fields and unique sequential invoice-number requirement;
- seven-year base administration retention, with ten-year categories for real estate and OSS/IOSS records;
- 2026 corporate-income-tax rates: 19% through EUR 200,000 and 25.8% above that threshold.

Only the versioned BTW rules are marked executable. Corporate tax and every other non-BTW fiscal domain remain architecture-only and review-gated.

## Live Railway evidence before final main publication

Observed at `https://v36-production.up.railway.app` on 2026-09-04:

- `GET /api/health`: HTTP 200, `version: 6.0.0`
- `GET /api/diagnostics/runtime-auth`: HTTP 200, production/Railway runtime detected, OpenAI configured, no secret values exposed
- `GET /api/ready`: HTTP 503, `verdict: FAIL`

The public health endpoint proves that a v6.0.0 container built and started. It does not expose a commit SHA, so it does not by itself prove which immutable git commit produced the running container.

## Remaining external live gates

These items cannot be truthfully converted into code-level PASS results or fixed by inventing/replacing credentials:

1. `authentication`: `FOUNDLY_ADMIN_USERNAME` plus the existing admin password, or an existing bearer token, must be present on the active Railway service.
2. `public_base_url`: `FOUNDLY_PUBLIC_BASE_URL=https://v36-production.up.railway.app` must be present on that same service.
3. `oauth_callbacks`: Meta, Google, LinkedIn, TikTok and Wix callback variables must exactly match the public origin and documented paths on that same service.
4. `persistent_mount`: the active service needs a Railway Volume mounted at `/data`, with `FOUNDLY_DATA_DIR=/data`.

No credential was changed, regenerated, copied into source control, or bypassed during this run. Railway dashboard inspection could not proceed because the selected GitHub login was rejected; the login method was not retried or silently changed.

## Still requiring real target-system observation

- exact deployed commit SHA from the Railway deployment record;
- live OpenAI Realtime WebRTC audio, microphone permission, local wake capability and playback in the target browser;
- live OAuth consent/token exchange for real Meta, Google, LinkedIn, TikTok or Wix accounts;
- provider permissions, app review, partner access and production data availability;
- real Meta CAPI, GA4 and Google Ads delivery plus provider processing receipts;
- measured browser FPS/frame time and WebGL2 pixel/motion parity on target hardware;
- live acoustic comparison on target audio hardware;
- rendered CRM, Analysis and Finance pixel/layout and interaction acceptance behind valid production authentication;
- standalone CRM deployment URL and live standalone-service readiness.

Do not label any item in the two sections above `LIVE PASS` until the required Railway, browser or provider evidence has been observed.
