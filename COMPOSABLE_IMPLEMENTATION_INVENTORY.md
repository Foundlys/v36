# Composable OS recovered implementation inventory

Recovered 2026-09-05. Baseline `073f03041b72a1c35c7559e116c3e0cd4aa0db02`;
functional release `b1cf28f3de1ca693c893861fc2ca42f9abc26337`.
Recovery checkpoint `0de6655a6575335920540c58f3b29ab8b7f843aa` preserves the three
local module-contract/resolver files. This is implementation evidence, not release acceptance.
No Windows-specific process adapter or further business-domain implementation was
found in the available filesystem, branches, stashes or remote run branch.

## Ownership and gaps as recovered (baseline, before new implementation)

| Surface | Existing foundation | Ownership / retained contract | Integration gap |
|---|---|---|---|
| Core | server.js, platform-core.js | identity, encrypted persistence, events, audit, workers, sources/connectors | global environment principal; composition enforcement missing |
| CRM | crm-core.js, 38 collections | customer/relationship records and existing CRM deals remain CRM-owned | optional workflows currently reach CRM directly |
| Procurement | inkoop records, automotive-core.js | generic acquisition records; Automotive owns listing/vehicle enrichment | universal workflow/workspace incomplete |
| Sales | verkoop records; CRM deals via explicit CRM API | sales-owned operations separate from CRM relationship history | no standalone workspace; avoid copying CRM deals |
| Finance | finance-core.js | immutable ledger and accounting documents | entitlement integration pending; never move accounting data |
| Analytics | platform-core.js | projections of canonical events, KPI definitions | shared events are Core; analytics products require entitlements |
| Calendar | agenda records; Google calendar connector | calendar-domain events, independent of CRM appointments | timezone/conflict/recurrence and standalone UI acceptance pending |
| Communication | communicatie records, email/WhatsApp provider paths | domain messages/drafts; optional CRM relationships | standalone workflow and approval acceptance pending |
| Marketing | social_media/google_ads records, measurement adapters | campaign/provider data; canonical attribution through events | workspace tabs do not yet have distinct full workflows |
| Automation | platform-core.js, workers | workflow definitions/runs; shared scheduler stays Core | targets must be entitlement checked at execution/retry |
| Industry | Automotive engine and fixed capability packs | extend universal capabilities; no customer forks | fixed pack selection must not silently grant optional modules |

Dependency direction: workspace/HTTP/ZERO → capability gate → public domain service
→ Core storage/audit/event adapter. Optional domain calls require their own gate;
domain internals must not be imported as private storage by another product.
Current server composition includes legacy direct reads; those must be either
replaced by public queries or rejected in explicitly composed tenant profiles.

Data and Knowledge are Core services in this run. Their inspection workspaces
are permission-gated Core surfaces. No separate commercial Data/Knowledge SKU is
claimed: selling those independently requires a distinct product contract and
acceptance matrix. Analytics does not own the shared event ingestion service.

## Non-destructive transition

Keep historical bucket names and schema migrations. Store composition revisions
in the existing encrypted adapter. Do not migrate, delete or duplicate existing
customer records merely to rename a module. Disabling hides normal operations;
authorized exports remain possible. Reenabling restores access with current roles.
Archive and destructive retention remain explicit domain operations, never a
side effect of entitlement changes. Existing tenant behavior is preserved until
an authorized explicit composition is configured.

## Implemented after recovery

- One nine-module manifest and tenant composition resolver, with founder-only configuration, preview, revision conflicts and retained exports.
- Server/API/engine aliases, workspace navigation, ZERO tool execution and workflow targets enforce composed access. Fine-grained method/route coverage is still being audited.
- Independent Procurement, Sales, Calendar, Communication and Marketing records use retained historical buckets. No CRM deals or financial records were copied.
- Sales stages and full-scope currency aggregates; Calendar recurrence, conflicts and reminders; internal Procurement/Sales approval; communication drafts and campaign plans never claim external delivery.
- Automation owns its tasks/documents, records sequential outcomes durably, binds approval to exact inputs, refuses indeterminate crash replay, supports conditions/delays and explicitly opted-in scheduled/event workflows.
- Canonical event versions, permissions, outbox notifications and permission-preserving projections/SSE; subscriber failure does not undo business records.
- The shared workspace contains real domain forms, a package composer and distinct section projections. Unsupported sections are explicitly marked unavailable rather than showing repeated overview KPIs.
- One module-access contract now maps every owned CRM/Finance/native entity and declared public engine operation. READ and APPROVE remain distinct from WRITE; read-only roles are not offered mutation tools.
- Partial composition hides disabled workspace sections while retaining permitted CRM data. Model context uses scoped record queries and the CRM public read contract, verified with a model-transport fixture.
- Runtime module probes test each module’s own read contract and storage/encryption/mount gates without optional-module or provider calls. Commercial acceptance remains separately pending.
- Explicitly composed CRM uses the same principal as the platform. Legacy CRM data queries use public permission-filtered reads; canonical/knowledge queries and dashboard team/role scopes enforce record access.
- Calendar slots derive from recorded availability and busy periods, with stale-selection rejection, idempotent booking, period-based distribution and private durable in-app reminders. External calendar coverage is not fabricated.
- New module mutations and composition changes restore touched in-memory buckets if the existing atomic persistence adapter fails. Worker module errors are isolated and reported instead of silently aborting unrelated module hooks.
- Test-only second-industry manifest extends actual Procurement/Sales fixtures without production registration or universal-engine branches.

## Verification and remaining boundary

See COMPOSABLE_ACCEPTANCE.md and COMPOSABLE_TEST_EVIDENCE.json for exact test scope.
Nine standalone configurations and twelve combinations exercise real authenticated
HTTP operations and encrypted restart. This does not establish nine complete,
competitive, sellable products. All unclosed critical gaps are listed in the
versioned competitive-ledgers directory.

The production identity is still a service principal selected from existing
server environment settings. Do not claim end-user identity provisioning or
multiple signed-in tenant memberships from this adapter. No authentication
provider, account or credential was invented. A verified production identity
contract is required before such claims can be made.

No destructive migrations, Railway configuration edits, credential changes or
production deployments were performed during this continuation. The Neural
renderer, audio/speech formatters and CRM/Finance/Automotive domain engines remain
unchanged. The shared platform engine has bounded workflow/event authorization fixes.

## 2026-09-06 event-contract checkpoint

Analytics owns saved reports in its existing historical bucket. Generated report and draft text records its model-assisted provenance; provider verification stays false. Owned reports remain exportable when the module is disabled. Automation workflow/task/document/run events use the same existing persistence adapter and a durable outbox. Tests simulate canonical-event persistence failure, restart, retry, deduplication and private event filtering. Workflow version identity now includes enabled/approval policy, while existing stored signatures remain unchanged for replay compatibility.

Previous exact-tree CI: run 47 (`34037718901`), commit `b1d0ec93b88a73b3476b9b62fb311e05e0c3e9d5`, completed successfully. This checkpoint is still partial product implementation; production and browser acceptance are not inferred from local or CI tests.

Role/projection follow-up: MANAGER no longer advertises Finance rights absent explicit assignment, matching the preserved Finance engine. Trusted FOUNDER/SUPER_ADMIN authority is translated to the legacy ADMIN vocabulary only after composed module/capability checks. Shared Data excludes operational Core/outbox/idempotency buckets and disabled entity capabilities. The complete npm test matrix passes with these guards; legacy tenants retain their existing behavior.

## Procurement sourcing increment

Owned RFQs and manually recorded supplier bids reuse the procurement adapter, ACL, events, export and revision contracts. Comparisons include only complete bids for the current RFQ revision and currency. Missing delivery times remain unknown; provenance stays user supplied and unverified. The shared workspace provides supplier/RFQ selectors, line entry and a comparison view. No supplier transport or external award was added. Official comparison benchmark: [Zoho Procurement RFQ awards](https://www.zoho.com/qa/procurement/help/request-for-quotes/award-request-for-quotes/), retrieved 2026-09-06. Approval chains, partial awards and browser acceptance remain incomplete.
