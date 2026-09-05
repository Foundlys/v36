# Composable OS recovered implementation inventory

Recovered 2026-09-05. Baseline `073f03041b72a1c35c7559e116c3e0cd4aa0db02`;
functional release `b1cf28f3de1ca693c893861fc2ca42f9abc26337`.
Recovery checkpoint `0de6655a6575335920540c58f3b29ab8b7f843aa` preserves the three
local module-contract/resolver files. This is implementation evidence, not release acceptance.
No Windows-specific process adapter or further business-domain implementation was
found in the available filesystem, branches, stashes or remote run branch.

## Existing ownership and dependencies

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

## Recovery acceptance

The new resolver unit test passes nine module selections, selected combinations,
role denial, tenant mismatch rejection, revision conflict, serialized restart,
retention and test-only second-industry resolution. It does not prove nine fully
standalone products. There are no new migrations or production changes.

Next gate: runtime enforcement, including manual URLs, ZERO, workflow targets,
legacy transport aliases, disabled-data access and founder-only entitlement writes.
Do not release a client-only navigation filter as module isolation.
