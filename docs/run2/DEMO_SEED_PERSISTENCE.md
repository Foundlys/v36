# Bounded native demo seed persistence

CI 270 failed on the published E-commerce checkpoint: the bounded real HTTP E-commerce seed/billing case exceeded the fixture's 15-second request timeout during the full test suite. The run ended with 1,839 passing ZERO cases and one failure; the corpus command did not run. The same earlier immutable source had passed locally with concurrency 2. Both outcomes and the complete failing CI log remain retained. This failure is not counted as a complete pass and no timeout was increased.

## Work and durability boundaries

The existing `limit` is now explicitly a maximum number of nodes per request. A monotonic 1,000 ms work budget yields after the current native command and its real checkpoint. Returned batch metadata reports actual applied nodes, requested limit, elapsed time and the yield reason. Callers continue from the current server cursor, including after a lost response. A single native operation, manifest validation, final persistence and notification work may exceed the soft work budget; this is not a hard latency guarantee.

In the actual server, each advance uses an opt-in synchronous transaction over the existing memory, record, decision, task, event and worker-state maps. Every native module/role/object check, exact revision, idempotency receipt, synthetic provenance and audit step still executes. Intermediate persist calls are deferred. The complete node prefix and engine cursor are then encrypted, fsynced and atomically renamed together using the existing writer. No successful response is returned before that durable boundary.

A native exception or failed final write restores the maps and prior dirty state. The current derived-fact cache is retired on rollback so it cannot show events from the discarded candidate. Earlier committed prefixes stay present. A process loss before the durable boundary leaves the preceding disk snapshot; a lost response after commit is recovered from the new cursor. Adapters without the outer transaction keep the already tested native per-command/checkpoint recovery path.

The transaction accepts synchronous internal callbacks only and rejects reentry. It does not wrap ordinary customer operations, alter the global file format, replace fsync/atomic rename, grant permissions or bypass the isolated-empty-demo gate. The HTTP runtime applies it only through the private demo-engine adapter. There is no client flag that enables deferred persistence for another operation.

## Event delivery and cache correctness

Canonical events and their notification outbox commit with the underlying records. Platform subscriber delivery is deferred while the outer boundary is active. After successful persistence, the normal native notification flusher runs in bounded groups. Delivery failure leaves a retryable outbox state and cannot roll back already committed business effects. Delivery is at least once; event IDs and native receipts remain the identity, not a claim of exactly-once network delivery.

An actual HTTP fixture forces the final encrypted rename to fail, checks zero acknowledgement and unchanged native records, restarts and explicitly retries. A second failure occurs after warming the real Analytics fact cache, immediately before a CRM lead event. The subscribed SSE client receives no uncommitted event, the funnel and lead count stay unchanged, and the same client receives the successful event after retry. Actual prior-prefix preservation, private at-rest encryption and stale-cursor refusal remain checked.

The existing real E-commerce lost-reply/restart/order/invoice/posting/internal-payment test remains in place. Its cursor checks now use actual acknowledged progress instead of assuming the requested upper limit was completely processed.

## Measurements and remaining work

The full 3,575-node E-commerce graph is being measured through the actual encrypted HTTP runtime, followed by the fourteen Dutch conversation scenarios. Separate runs retain the earlier per-command persistence and the batch implementation, with incremental cursor/timing reports and content-free file-I/O counts. The benchmark uses the same fixed scenario, all nine module entitlements and no model provider. Other local regression work may overlap; these are local diagnostic measurements, not isolated load, phone or end-user latency guarantees. Final results and exact source identities belong in checkpoint-tests.json only after completion.

Complete Finance/Automation/Analytics histories, correction/refund paths, complete commerce/Finance action controls, full model/social/voice acceptance, source freshness/valuation and desktop/HTTPS/physical-device delivery remain open. This persistence correction does not accept a finished demo.


## Demo controls and full-data context continuation — 7858bf9

See [DEMO_CONTROLS.md](DEMO_CONTROLS.md) for the shared native preview, start, pause and server-owned recovery controls. Native specialist evidence is bounded to 7000 bytes per source; whole-row/field omissions are explicit and the complete authorized source response remains hash-bound and independently re-read. Exact amounts, currency, null/zero and native pagination remain distinct. Isolated demo catalogs/projections/receipts are SYNTHETIC_DEMO, never observed customer truth. One synchronous capability resolution now uses one fresh authority snapshot; no grants are retained across calls or awaits.

The full encrypted 3575-node E-commerce rehearsal exposed two context-budget errors, and its first bounded follow-up still timed out. Both failed observations remain archived. The fresh-grants repeat completed all 42 Dutch turns without HTTP error, with no model provider and no automatic social-quality acceptance. Seed time was 8.7 minutes under overlapping local work; full snapshot I/O and end-user performance remain open. The older baseline continues separately. Collection now records pending request identity before transport and retains uncertain failures without retry.

Latest immutable source 7858bf98a29a7ccc5768b884f0d0aa921f36af90/tree 410dcc5cec7c2f2d18b93e4b5632fddfdba2eb44: 1867 ZERO, 14 corpus, 12 involved native scripts PASS. Preceding published CI 271 passed on exact tree 5c6ae7a; this newer publication still needs its own full CI. The supported browser retry was blocked at local /data (ERR_BLOCKED_BY_CLIENT). No complete demo, independent empathy/voice review, browser/device installation or final downloadable app is accepted by this checkpoint.


## Continuation recovery and immutable manifest validation — 5dd3ea2

The current checkpoint is detailed in [CONTINUATION_RECOVERY.md](CONTINUATION_RECOVERY.md). Prior published CI 272 passes the complete regression. Reconstructed ZERO continuity and observation-date checks are verified separately; 5dd3ea2 passes 76 focused native/demo/ZERO checks and 14 corpus cases on unchanged source. Repeated Law validation now reuses only deeply immutable manifest objects; replacement, rollback and restart still validate fully. This is a local manifest-read improvement, not full-seed or device performance acceptance. The earlier reported local ad53950/raw Automotive measurement is unavailable in the current workspace and is retained as an explicitly unverified continuity record. The old E-commerce baseline is incomplete/unavailable, not running. Full Finance/Automation/Analytics histories, corrections, module controls, model/social/empathy/voice quality and downloadable/mobile/HTTPS delivery stay open. See the existing matrix for unchanged active-hour ranges and separate waiting times.


## Native Finance configuration continuation — aebdb91

See [DEMO_FINANCE_FOUNDATION.md](DEMO_FINANCE_FOUNDATION.md). Both priority demos now seed the real guarded Finance entity, scenario-year periods and nine ledger mappings, with normal native request recovery and current authority. Source aebdb91/tree ceabbc0 passes 82 focused native/demo/ZERO checks, 14 corpus cases and three native suites. The encrypted E-commerce HTTP chain uses that seeded configuration after forced commit rollback and restart. Configuration creates no invoice, payment, bank connection or realized-revenue claim. Financial transaction/correction and Automation/Analytics histories, full module controls, model/social/empathy/voice and actual download/phone/HTTPS acceptance remain open. Existing confirmed graphs and all earlier evidence remain retained at their original source identities.


## Native financial sales history continuation — 4204035

See [DEMO_FINANCE_TRANSACTIONS.md](DEMO_FINANCE_TRANSACTIONS.md). Both default graphs now execute native sales invoices, posting and internal payments with current source/permission checks, exact ledger balances and original-request recovery. Source 4204035/tree 4daa6cb passes 104 focused native/demo/ZERO cases, 14 corpus cases and three native suites on unchanged source. Actual encrypted HTTP proves rollback, lost payment reply and subsequent structured ZERO billing. CI 273 and 274 pass their preceding exact published trees; this new source still needs its own full CI. Purchase/COGS and approval history, credit/allocation/refund/correction, Automation/Analytics, complete controls, real social/empathy/voice quality and actual download/desktop/iPhone/Android/HTTPS delivery remain open. No demo acceptance promotion. The user reconfirmed the demo-first sequence on 27 September; the remaining Run 2 resumes only after both complete demos.


## Full credit correction continuation — 58da9e3

See [DEMO_CREDIT_CORRECTIONS.md](DEMO_CREDIT_CORRECTIONS.md). Both new demo graphs include one source-bound posted full credit, explicitly awaiting allocation; no refund, stock movement or cancellation is implied. Native Finance and structured ZERO require the original posted invoice, exact amount/parties/lines, current authority and the original request for recovery. Frozen 58da9e3/tree b28d89a passes 146 focused Finance/demo/ZERO cases, fourteen corpus cases and nine native suites. The preceding complete CI 275 passes exact tree 11e8626 with 1897 ZERO/14 corpus; this newer source needs its own full CI. Allocation, internal refunds, partial credits/returns, other histories, full module controls and actual model/social/empathy/voice/device/download acceptance stay open. Both complete priority demos remain ahead of the preserved remainder of Run 2.


## Explicit credit settlement continuation — cd7e91d

See [DEMO_CREDIT_SETTLEMENTS.md](DEMO_CREDIT_SETTLEMENTS.md). Both new demo graphs contain a full allocation against an unpaid invoice and a separate internal outgoing refund against a paid invoice/credit, through current native Finance and ZERO contracts. Frozen cd7e91d/tree 2b4c228 passes 162 focused cases, fourteen corpus cases and nine native suites. Preceding CI 276 passes exact tree 135c861 with 1912 ZERO/14 corpus; this newer source needs its own full CI. No external transfer or bank settlement is implied. Next are full native/ZERO module action controls, remaining histories/corrections, independent model/social/empathy/voice evaluation and actual desktop/iPhone/Android/HTTPS/download acceptance. Both complete priority demos remain ahead of the preserved remainder of Run 2.


## Native/ZERO Finance controls — b2cadbe

See [DEMO_FINANCE_CONTROLS.md](DEMO_FINANCE_CONTROLS.md). Five current invoice/credit actions now have native and structured ZERO controls, separate source-bound confirmation, owner-bound encrypted retention and explicit recovery after reload. All eight locales preserve current inputs and confirmation. Frozen b2cadbe/tree 9588a9f passes 212 focused cases, fourteen corpus cases and fifteen native suites. Preceding CI 277 passes exact tree a23dbf4 with 1928 ZERO/14 corpus; this newer source needs its own CI. Native approval/purchase and remaining histories/UI, independent model/social/empathy/voice quality and actual browser/device/HTTPS/download acceptance remain open. Both complete priority demos remain first.


## Purchase approval and operating-expense history — 9d98b8e

See [DEMO_PURCHASE_HISTORY.md](DEMO_PURCHASE_HISTORY.md). Both priority packs now have separate native operating expenses, source-bound approval, payable postings and internal outgoing payments. Six Finance operations have native/structured ZERO controls. Exact source changes invalidate approval before posting; approve-only owners do not gain write/post authority. Frozen 9d98b8e/tree 39017aa passes 19 repeated full-graph cases, 14 corpus cases and 15 native scripts. CI 278 PASS: 1945 ZERO/14 corpus op exact tree a542020; publicatie en checkout-merge zijn gecontroleerd. Its own newer full CI follows publication. Vehicle acquisition/COGS, purchase credits, partial corrections, invoice creation and other module UI, independent model/social/voice and real browser/device/HTTPS/download acceptance remain open. Complete Automotive and E-commerce demos still precede the remaining Run 2.


## Manual invoice creation interface — 6148808

See [DEMO_INVOICE_CREATION.md](DEMO_INVOICE_CREATION.md). Native and structured ZERO now create reviewed manual sales/purchase drafts with multiple exact lines and separate confirmation. Lost creation replies recover through restart and later approval/posting; known nonexecution retains authored input. The source 6148808/tree 4496181 passes 221 focused cases, 14 corpus cases and 15 native scripts on a clean unchanged checkout. Preceding complete CI 279 passes exact d441349 with 1960 ZERO/14 corpus; newer own CI follows publication. Order/CRM-derived billing UI, other module work and histories, independent model/social/voice quality and actual browser/device/HTTPS/download acceptance remain open. Priority demos still precede the remaining Run 2.


## Order and CRM invoice creation interface — a9c6148

See [DEMO_COMMERCE_INVOICING.md](DEMO_COMMERCE_INVOICING.md). Native and structured ZERO now create a reviewed linked order invoice from actual CRM/customer/entity sources, with bounded source paging and locked order prices. Lost replies recover through encrypted restart and later payment; known nonexecution retains supported input. Source a9c6148/tree 3c6cd44 passes 240 focused cases, 14 corpus cases and 15 native scripts on a clean unchanged checkout. Preceding complete CI 280 passes exact a2b0dde with 1973 ZERO/14 corpus; newer own CI follows publication. Product/stock/order action UI, other modules/histories/corrections, independent model/social/voice quality and actual browser/device/HTTPS/download acceptance remain open. Priority demos still precede the remaining Run 2.


## Commerce action controls — c24b206

See [DEMO_COMMERCE_CONTROLS.md](DEMO_COMMERCE_CONTROLS.md). Six native/structured ZERO product, stock and order actions now have current-authority controls, explicit confirmation and encrypted pending recovery. Both actual HTTP page chains continue to native order billing/posting/internal payment. Frozen source c24b206/tree 2d1debe: 261 focused/14 corpus/15 native PASS. Prior full CI 281: 1985 ZERO/14 corpus on exact c7d2f06. Own publication/CI is next, followed by the financial partial-return/correction chain and remaining complete-demo requirements. No complete demo, live model/social/voice, browser/device or delivery acceptance is claimed.
