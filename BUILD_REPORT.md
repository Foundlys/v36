# Foundly OS v6.0.0 verification and release report

Date: 2026-09-04

This report is secondary evidence. Repository code, immutable git objects, automated tests, the deployed runtime, and real external-provider responses remain the sources of truth.

## Automotive / House of Cars pilot — deployed evidence

The Automotive pilot was resumed from the clean `main` recovery baseline `cf5e54aacc2e598c59a8dbe0866c9164f46f857a` on branch `feature/automotive-house-of-cars-pilot`. The bounded implementation checkpoints are:

- `2dc3d93`: canonical Automotive data, provider adapters, real-data search, deduplication, comparables, economics, dealer fit and explainable Buy Score;
- `efbc341`: authenticated Automotive APIs, existing ZERO integration and Auto-Provisioner capability-pack wiring;
- `3c75367`: dedicated Automotive workspace, safe provider-image proxy, official live-provider test and provider timeout hardening.

The exact resulting tree `2a72f95a16f7a47bf541c2903fa4f70f374981cd` was published as GitHub feature commit `618242dd8617c70afaa68ab67cfa00e9c2f03598` and merged through PR `#6` into `main` as `463128b9ad0826397d498a8bfc34f7ea59dee2c4`.

This is a reusable `AUTOMOTIVE` capability pack on the existing Foundly platform. It does not create a second application, database, CRM, event bus, persistence layer or ZERO instance. House of Cars is represented only as a development-partner preview and optional tenant dealer profile; no private dealer facts, preferences, inventory history or target margins are invented.

Implemented release-candidate scope:

- natural-language criteria parsing with multi-turn retention;
- parallel RDW, mobile.de and Marktplaats orchestration with truthful `LIVE`, `CACHED`, `STALE` and `UNAVAILABLE` states;
- canonical listing and vehicle-truth records, source manifests, transformation version, timestamps and provider provenance;
- conservative exact/high-confidence deduplication and persisted listing history;
- real-active-NL-listing comparables, versioned 2026 BPM estimation, acquisition economics, listing-scarcity signals, configurable dealer fit and explainable Buy Score;
- five Automotive tools in the existing ZERO registry, including the guarded “wat moet House of Cars vandaag inkopen?” flow;
- authenticated `/api/automotive/*` routes and responsive `/automotive` workspace with evidence, risk, economics, comparable and source drill-down;
- no synthetic runtime inventory and no fallback to fabricated provider results.

Official live provider observation on 2026-09-04 at `21:47:55Z`:

| Provider | Configured | Authenticated | Probe | Real records | Runtime classification | Blocker |
| --- | --- | --- | --- | ---: | --- | --- |
| RDW Open Data | yes | public | PASS, HTTP 200 | 50 received / 50 normalized vehicle-truth records | LIVE | none |
| mobile.de Search API | no | no | NOT RUN | 0 | BLOCKED | `MOBILE_DE_USERNAME` and `MOBILE_DE_PASSWORD` are absent |
| Marktplaats v2 Search | no | no | NOT RUN | 0 | BLOCKED | `MARKTPLAATS_ACCESS_TOKEN` is absent |
| AutoScout24 | no | no | NOT RUN | 0 | BLOCKED / P1 | official access and adapter contract are not yet verified |

RDW is authoritative vehicle truth, not a marketplace. The Tuesday real-marketplace acceptance gate therefore remains `BLOCKED` until mobile.de or Marktplaats is legitimately configured and returns at least one real matching listing end to end.

Release-candidate verification completed with exit code 0 for `npm run test:automotive`, `npm run test:automotive:live`, `npm run test:crm`, `npm run test:platform`, `npm run test:e2e`, `node jarvis-production-regression-test.js`, `node jarvis-client-regression-test.js` and `node speech-audio-visual-regression-test.js`. GitHub Actions `Production architecture tests` run `#26` (`33923115299`) subsequently completed successfully for feature SHA `618242dd`; its `Run npm test` step and every setup/cleanup step passed. The Automotive fixtures explicitly identify themselves as synthetic contract fixtures and are not provider proof.

The Neural command center, renderer, autonomous motion, audio and speech assets remain byte-for-byte identical to baseline `cf5e54a`; no Automotive change touches their source files.

Railway production evidence after PR `#6` publication:

- correct target reconfirmed: project `dazzling-solace`, environment `production`, service `v36`, domain `v36-production.up.railway.app`;
- deployment `0cef9021-01c6-4bc9-971f-1660d239319a`: `Active` and `Deployment successful`, deployed via GitHub from `Foundlys/v36` `main` SHA `463128b9`;
- deploy log: `Foundly OS v6.0.0 ONLINE op poort 8080`;
- `GET /api/health`: HTTP 200, version `6.0.0`;
- `GET /api/ready`: HTTP 503, `FAIL`, with exactly `authentication`, `public_base_url`, `oauth_callbacks` and `persistent_mount` false;
- `/automotive`, `/api/automotive/status`, `/api/zero/status`, `/api/crm/status`, `/api/analysis/status` and `/api/finance/status`: HTTP 401 `auth_not_configured`; this proves the existing security gate is still enforced but blocks authenticated production route and rendered-workspace acceptance;
- invalid-state Meta, Google, LinkedIn, TikTok and Wix callbacks: controlled HTTP 302 `oauth_state_invalid`, no `WWW-Authenticate` response header and no state/code reflection in the redirect;
- Railway showed 19 configured service variables without revealing values. No Foundly admin-auth variable, public-base variable, mobile.de Search credential or Marktplaats access token is attached to the service;
- `FOUNDLY_DATA_DIR` is present, but the deploy log reports `/data` is not proven as a separate writable volume; no durable production marker/restart test is therefore claimed;
- direct cloud-browser rendering of the application host was blocked by that browser with `ERR_BLOCKED_BY_CLIENT`; no screenshot or pixel/interaction PASS is claimed. The public HTTP checks above did complete;
- the pre-existing staged destructive Railway change still says `Service will be deleted` for `v36`. It was not deployed, discarded or modified. No Railway variable, secret, volume, domain, topology or staging service was changed.

The code release is deployed, but the production Automotive acceptance gate remains blocked by missing runtime authentication, durable storage and legitimate marketplace-provider credentials. Readiness and live protected-route evidence must not be labeled PASS until those external conditions are corrected safely.

## Preserved release lineage

- preserved production baseline: `v5.4.0`
- baseline merge commit on `main`: `205427e42d0cc617cd06abf94062ead7f65e796e`
- completed v6 implementation commit: `1181861e47388b3955ca1e1252e3825d6731d7a1`
- completed v6 implementation tree: `64e172fecd6a271d849801a19caea365bd825a92`
- published v6 main/release merge: `40b9ed700a3a93e1c4af3c66037a8ffc1116dd50`
- neural visual correction commit: `eab6b0faebcf886f59ce79d76d413241827c6b89`
- neural visual correction merge on `main`: `ee429a9104b54a879365c69c965ec42308c333ba`
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
| 10 | GitHub release and Railway runtime | DEPLOYED / READY BLOCKED | `release/foundly-v6.0.0` preserves the v6 release baseline and `main` contains the bounded neural visual follow-up; GitHub Actions passes; Railway redeployed and live `/api/health` reports v6.0.0; public `/api/ready` remains blocked only by the external configuration listed below |

## Local and CI result

`npm test`: PASS (`exit 0`)

GitHub Actions `Production architecture tests`: PASS for implementation commit `1181861e47388b3955ca1e1252e3825d6731d7a1` (run `33876702491`), published release commit `40b9ed700a3a93e1c4af3c66037a8ffc1116dd50` (run `33878418584`), and neural visual correction commit `eab6b0faebcf886f59ce79d76d413241827c6b89` (run `33899565892`).

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

## Neural command center visual correction

The old dashboard video was used only as the primary motion and composition reference. It is not copied, embedded, replayed, or shipped by the application.

- restored composition: one Foundly core, 12 module hubs and all 154 existing capability labels;
- deterministic topology: 166 explicit core/module/capability connections inside the existing 420-ribbon and 6,200-particle renderer budget;
- autonomous motion: a 46-second non-uniform 3D trajectory combining yaw, pitch, subtle roll, camera precession and depth change instead of a continuous simple orbit;
- orientation coverage: numerical regression proves front/rear, above/below, left/right, bidirectional roll, two-axis precession and non-monotonic yaw;
- background: near-black/deep-space black with only restrained blue atmosphere; neural filaments, particles and energy remain the primary color source;
- integration boundary: renderer/style files plus one constructor-data hook in `index-script.js`; no CRM, Analysis, Finance, Tax, Data, Connector, Automation, ZERO, auth, security or persistence implementation changed;
- regression result: the full `npm test` matrix remains PASS.

## Official fiscal-source verification

The committed fiscal metadata was rechecked on 2026-09-04 against the official Belastingdienst pages referenced by the code:

- BTW rates: 21%, 9%, 0% and exemption categories;
- statutory invoice fields and unique sequential invoice-number requirement;
- seven-year base administration retention, with ten-year categories for real estate and OSS/IOSS records;
- 2026 corporate-income-tax rates: 19% through EUR 200,000 and 25.8% above that threshold.

Only the versioned BTW rules are marked executable. Corporate tax and every other non-BTW fiscal domain remain architecture-only and review-gated.

## Live Railway evidence after final main publication

Observed at `https://v36-production.up.railway.app` on 2026-09-04:

- `GET /api/health`: HTTP 200, `version: 6.0.0`
- `GET /api/diagnostics/runtime-auth`: HTTP 200, production/Railway runtime detected, OpenAI configured, no secret values exposed
- `GET /api/ready`: HTTP 503, `verdict: FAIL`
- post-publication uptime observation: reset to 54 seconds after the final main push, consistent with a fresh Railway deployment
- target service reconfirmed as project `dazzling-solace`, environment `production`, service `v36`, domain `v36-production.up.railway.app`
- neural visual merge `ee429a9104b54a879365c69c965ec42308c333ba`: Railway deployment `939ee0ad-8734-45fb-af1b-aa8dfda92a15` reported `Deployment successful`
- deploy log after the visual merge: `Foundly OS v6.0.0 ONLINE op poort 8080`
- Railway Network Logs after that start: `GET /api/health`, HTTP 200

The public health endpoint, GitHub deployment status and Railway deployment record prove that a fresh v6.0.0 container built and started from the neural visual merge. The endpoint itself does not expose a commit SHA; commit binding is provided by the GitHub-attached Railway status and matching Railway deployment record.

## Remaining external live gates

These items cannot be truthfully converted into code-level PASS results or fixed by inventing/replacing credentials:

1. `authentication`: `FOUNDLY_ADMIN_USERNAME` plus the existing admin password, or an existing bearer token, must be present on the active Railway service.
2. `public_base_url`: `FOUNDLY_PUBLIC_BASE_URL=https://v36-production.up.railway.app` must be present on that same service.
3. `oauth_callbacks`: Meta, Google, LinkedIn, TikTok and Wix callback variables must exactly match the public origin and documented paths on that same service.
4. `persistent_mount`: the active service needs a Railway Volume mounted at `/data`, with `FOUNDLY_DATA_DIR=/data`.

No credential was changed, regenerated, copied into source control, or bypassed during this run. The existing GitHub login opened Railway successfully for read-only verification; no Railway variable, volume, secret, service topology or staged change was modified. Railway showed one pre-existing staged destructive change labelled `Service will be deleted` for `v36`; it was deliberately not applied and requires explicit human review before anyone uses `Deploy changes`.

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
