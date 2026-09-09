# Foundly composable continuation — acceptance checkpoint

This is an interrupted-build continuation, not a completed release. Authoritative
baseline: `073f03041b72a1c35c7559e116c3e0cd4aa0db02`. Preserved functional release:
`b1cf28f3de1ca693c893861fc2ca42f9abc26337`.

## Recovery and preservation

The initially available branch was `feature/automotive-live-marketplaces` at
`e51b807`, whose tree matches the published functional work. It was preserved as
`checkpoint/pre-composable-20260905`. No tracked edits or stashes were discarded.
`feature/composable-os-execution` starts from the actual published main and contains
the local checkpoints `0de6655`, `e1496c0` and `0af997c`. Uploads remain outside Git.

Remote checkpoint `48ff996af19b5fde67ec42d99559fe34d8d11c05` has exactly the same
tree as tested local `e1496c0`: `ffdf7ca242fe52a1619f329439d15e762674a2b6`.
[Draft PR #15](https://github.com/Foundlys/v36/pull/15) preserves that work.
[CI run 44](https://github.com/Foundlys/v36/actions/runs/33994444039) passed on that
checkpoint. Subsequent changes require their own CI result; that earlier run is
not evidence for a later tree.

Remote checkpoint `89b6b29166ce4aadb8c3bd3f73b7695814aaef1c` exactly matches
local `0af997c`, tree `6ab1bd4674d38344bc84f7bce20198e2a6758555`.
[CI run 45](https://github.com/Foundlys/v36/actions/runs/33996640469) passed.
The next preserved checkpoint is local `fa56e20`, tree
`bad9018e7c01208beeb51987d263b08bd4877c22`, published as
`cb65663efc27cb2dde97514603b84ce2e256453d`.
[CI run 46](https://github.com/Foundlys/v36/actions/runs/34037115825) passed on that
exact tree. Subsequent access-contract changes require their own CI.

The reported Windows-specific WIP/adapter was not found in the available files,
refs, stashes or retrieved history. This is a limit of available evidence, not
proof that no other session ever contained it.

## Proven test scope

The current full `npm test` result and source hashes are recorded separately in
`COMPOSABLE_TEST_EVIDENCE.json`. Tests use isolated temporary data and fixture
credentials. No fixtures are inserted into production.

| Gate | Scope of evidence |
|---|---|
| Baseline non-regression | Existing security, OAuth/replay, ZERO/audio, CRM, Finance, Automotive, source registry, dashboard and full-platform suites |
| Composition API | Real authenticated HTTP, route/engine aliases, founder-only configure/preview, canonical write denial, capability revocation at ZERO execution, encrypted restart |
| Nine standalone configurations | Each module alone: navigation, snapshots, dashboard, tools, own core workflow, exports and restart |
| Twelve combinations | Required compositions, shared navigation/tools, snapshots and restart; detailed business choreography is not fully accepted |
| Domain workflows | Procurement/Sales approvals, stages, currency aggregates beyond page one, Calendar DST/conflicts, safe Communication/Marketing states, outbox retry |
| Workflow safety | Sequential outcomes, input-bound approval, no duplicate successful steps, explicit BLOCKED state, crash uncertainty, conditions, delays, opt-in schedule |
| Event security | Supported event versions, tenant mismatch, role-filtered events, realtime/historical projections, cached facts, campaign outcomes, attribution and SSE |
| Industry extension | Test-only property fields accepted by the existing universal engines; wrong-pack fields and production demo activation rejected |
| New scheduling and persistence | Real authenticated slot/booking routes; stale confirmation and replay tests; durable private reminders; failed-persist rollback |
| Capability operations | Every owned CRM/Finance/native entity has a declared capability; revocation blocks public routes, record aliases and declared engine methods; read-only tools and Finance approval roles tested |
| Model input boundary | Real server route with an isolated model transport: assigned CRM contact reaches model context; private CRM contact is excluded |
| Additional authorization | CRM principal alignment, legacy read filtering, private canonical/knowledge access and shared-dashboard scope checks |
| UI | Syntax and existing structural/responsive regression checks; new browser interaction is not proven |

`full_product_acceptance: PENDING` in the configuration matrix is intentional.
Health/readiness endpoints do not substitute for full commercial acceptance.
Module runtime readiness reports its declared operational scope, current access, storage, encryption and genuine production mount separately from commercial acceptance. Optional providers are not contacted by these probes.
Module manifests retain `standalone: UNVERIFIED`, `sellable: false` and
`ACCEPTANCE_PENDING`; unimplemented responsibilities are not marked READY by fiat.

## Exact phase map

| Phase | Status | Evidence / remaining requirement |
|---|---|---|
| 0 Repository/runtime/checkpoint | COMPLETE | Local/remote refs and worktrees recovered; functional work preserved; live public baseline observed |
| 1 Architecture inventory | COMPLETE | Ownership, retained buckets, Core services and dependency boundaries in inventory |
| 2 Module contracts | PARTIAL | Nine manifests, shared role grants, isolated probes, owned entity/operation mappings and durable events; remaining legacy contracts and full standalone product acceptance are explicit |
| 3 Capability resolver | PARTIAL | Composed module/role/tool and private-data guards now use real tenant member sessions with live operation-boundary roles; invitation, suspension and current-member workers pass HTTP/restart. Remaining mixed-entry audit and browser acceptance are explicit |
| 4 Industry abstraction | PARTIAL | Typed fields, provenance, bounded KPI definitions and declarative dashboard/manual-workflow presets share universal engines and current capability gates; authenticated save/restart/pack-switch tests and second-industry fixtures pass. Production KPI/source integrations, additional specialization types and browser acceptance remain. |
| 5 Automotive pack | PARTIAL | Existing engine preserved; integration and non-regression checked; complete composed browser/provider acceptance remains |
| 6 Procurement | PARTIAL | Owned sourcing, complete RFQ item/quantity allocation, aggregate approval thresholds, sequential reviewers, source/policy revision protection and encrypted restart pass; supplier collaboration and browser acceptance remain. |
| 7 Sales | PARTIAL | Owned pipelines, forecasts, exact owner/period/currency quotas, revision-bound snapshots and current source permission checks pass; hierarchy, scenario workflows, sequences and browser acceptance remain. |
| 8 CRM | PARTIAL | Existing engine and isolated configuration pass; competitive and full identity/UI acceptance remain |
| 9 Marketing | PARTIAL | Owned plans and existing measurement adapters; journey activation and real provider proof remain |
| 10 Finance | PARTIAL | Preserved accounting engine and Finance-only capability-aware client loading pass full regression and encrypted restart; complete period-close, jurisdiction-specific workflows, scenarios and browser acceptance remain. |
| 11 Analytics | PARTIAL | Owned reports with explicit inference provenance, retained export and durable events; permission-filtered analytics exist; cohorts/model/section contracts remain |
| 12 Calendar | PARTIAL | Availability-driven slots, distribution, idempotent booking, internal reminders, private ACL and restart; external reconciliation/browser proof pending |
| 13 Communication | PARTIAL | Own drafts/templates/preferences; mail authorization, delivery, attachments and collaboration remain |
| 14 Automation | PARTIAL | Owner-bound execution, bounded retries, sequential authoring, private drafts, version activation, proof-based recovery and searchable paginated run history pass. Visual branching and external recovery evidence remain incomplete; browser acceptance is blocked. |
| 15 Workspace composition | PARTIAL | Shared forms, composer and distinct projections; explicitly missing sections and browser acceptance remain |
| 16 ZERO orchestration | PARTIAL | Dynamic availability and real read tools; complete structured prepare/execute/verify coverage remains |
| 17 Registries | PARTIAL | Canonical registries retained; public positive-state/receipt forgery blocked; remaining runtime-to-registry integration and complete capability mapping remain |
| 18 Policy/risk | PARTIAL | Input-bound approvals and requester identity, connector administration and owner-bound automatic work; complete external-action policy coverage remains |
| 19 Provisioner/composer | PARTIAL | Package preview/apply plus authorized tenant-member enrollment, roles, suspension and retained history; full multi-tenant provisioning/configuration dimensions and browser acceptance remain |
| 20 Second industry proof | COMPLETE | Test-only manifest extends owned business records; unavailable in production |
| 21 Standalone matrix | PARTIAL | Nine configuration/workflow/restart profiles pass; full product acceptance remains pending |
| 22 Composition matrix | PARTIAL | Twelve configuration/restart combinations pass; exhaustive choreography remains |
| 23 Adversarial testing | PARTIAL | Tenant, role, ACL, replay, crash and subscriber tests; full remaining mixed-path audit remains |
| 24 Competitive ledgers | PARTIAL | Nine versioned ledgers; critical BELOW_PARITY gaps explicitly open |
| 25 Performance/accessibility | PARTIAL | Existing regressions and form hardening; actual new viewport/keyboard/load acceptance remains |
| 26 Full regression | PARTIAL | Full checkpoint regression recorded; final completed-product gate cannot be inferred |
| 27 GitHub/CI | PARTIAL | Draft checkpoint published; final release PR/CI/merge gates remain |
| 28 Production deployment | NOT_STARTED | No release until genuine architecture/acceptance defects are closed |
| 29 Post-deploy checks | NOT_STARTED | No new production deployment to validate |
| 30 Browser acceptance | BLOCKED_EXTERNAL | BLOCKED_EXTERNAL_BROWSER_ACCEPTANCE: cloud browser navigation returned net::ERR_BLOCKED_BY_CLIENT. The documented Sites preview requires a compatible Vite dev server; this custom Node application has none. No architecture replacement, bypass, deployment or browser pass. |
| 31 Final evidence | PARTIAL | This checkpoint and ledgers preserve truth; no completion verdict issued |

Last contiguous fully completed phase: **1**. Earliest incomplete requirement:
close remaining module event contracts and complete mixed Core/legacy capability coverage. Runtime probes and owned-entity/method mappings are now tested; these are not evidence of complete product acceptance.
Current work spans those boundaries and their dependent workspaces/tests.

## Production and preservation

Authorized target remains `dazzling-solace / production / v36` at
`https://v36-production.up.railway.app`. Public health/readiness were observed
green during recovery and rechecked on 2026-09-06: both HTTP 200, version 6.0.0,
readiness PASS with all eight checks true. No configuration, volume, credential,
deployment or production-data mutation was made in this continuation.
An authenticated Railway session and protected-route authentication are not
available in the newly connected browser. No value was recovered from another
project or extracted from a browser session.

The frozen `neural-runtime.js`, audio/speech assets, `crm-core.js`,
`finance-core.js` and `automotive-core.js` retain baseline content. Existing
encrypted `/data` persistence was not replaced. Shared platform changes are
limited to the documented workflow/event/access integration. No new application
version or customer fork was created.

## Autonomy boundaries and next work

ZERO can read persisted domain evidence, use existing safe low-risk tools and
request existing confirmation. Automation can execute supported internal tasks,
documents and notifications; optional domain targets are authorized again.
High-risk actions require exact input-bound approval and a verified adapter.
Missing adapters remain BLOCKED. A process interruption with an indeterminate
side effect requires outcome reconciliation; blind retry is refused.

Continue from the earliest incomplete contract/access requirement and the exact
gap list in `competitive-ledgers/`. Preserve this checkpoint before any history
operation. Do not merge the draft as a completed masterbuild. Human credentials
and provider authorization block only the relevant external integrations;
they do not excuse unfinished internal capabilities.

**Verdict: MASTERBUILD INCOMPLETE — preserved development checkpoint.**

## 2026-09-08 Sales forecast checkpoint

The recovered unpublished forecast implementation is completed as a bounded increment. Targeted domain tests and authenticated Sales-only HTTP/restart tests pass. The complete `npm test` matrix exited 0; source hashes and output hash are in `COMPOSABLE_TEST_EVIDENCE.json`. This adds explicit-period projections and immutable reviewed snapshots, not quotas, forecast hierarchy, sequence execution or browser acceptance. The next incomplete gate is mixed Core/legacy route authorization under phases 2–3. No production changes.

## 2026-09-08 Core access increment

Targeted tests verify private memory/queue access, reserved namespace rejection, connector and worker privileges, current-owner execution, failure isolation, and ZERO conversation/confirmation ownership through authenticated HTTP and encrypted restart. Existing legacy behavior is preserved until explicit composition. Unowned historical tasks are retained, not automatically attributed to a new principal. Final full-regression results for this increment are recorded separately in the checkpoint evidence.

The full `npm test` regression for the Core access increment exited 0. Exact source hashes and output fingerprint are recorded in `COMPOSABLE_TEST_EVIDENCE.json`. This is another development checkpoint; formal deployment remains blocked by the remaining masterbuild acceptance gaps.

## 2026-09-09 order policy checkpoint

The full `npm test` matrix exited 0 with the direct-order review workflow and authenticated encrypted restart. A subsequent bounded evidence-reference type/length check and its negative test passed the focused order/RFQ review suites. Exact current source hashes and this distinction are recorded in `COMPOSABLE_TEST_EVIDENCE.json`; remote CI must verify the published tree. No production deployment occurred.

## Shared role and ingress contract checkpoint

Full `npm test` exited 0 on the shared manifest/resolver role table and generic-ingress guards. HTTP tests verify that rejection leaves business collections unchanged. Frozen engines and renderer remain byte-identical. This checkpoint does not supply a production end-user identity provider or close remaining competitive product gaps.

## 2026-09-09 provider capability boundary

Provider aliases now share explicit read/write capability contracts with native modules, including GA4, Google Calendar, Meta, measurement, WhatsApp and existing tax routes. ZERO multi-capability tools are omitted and denied if any consumed capability is revoked. Analytics-only GA4 queries store private, versioned provider reports in owned Analytics buckets, retain existing history, and preserve export after disablement. No provider credentials or production data were changed.

Full `npm test` passed after the existing readiness configuration test was isolated from real provider traffic. Unit and authenticated HTTP fixtures cover denial before transport, read-only reporting, query identity, owner/tenant isolation, persistence rollback and encrypted restart. Provider-shaped fixtures are not live account authorization or competitive acceptance. The recovered role-contract tree was published as `2c23d9b`; GitHub Actions run 57 passed. A separately reproduced malformed-workflow scheduler isolation defect is the next hardening task.

## Scheduler malformed-definition isolation

A null trigger previously stopped the complete scheduler tick before any healthy workflow ran. Reproduced and fixed. Tests now cover null records, missing triggers, twelve invalid action definitions before a valid workflow, preservation of malformed history, restart and no repeat of the completed run. New automatic triggers require explicit bounded event selection or an offset-bearing schedule. Full `npm test` passed. A fresh browser attempt on 2026-09-09 still returned `net::ERR_BLOCKED_BY_CLIENT`; no new browser acceptance is claimed.

## Bounded Automation retry checkpoint — 2026-09-09

Full `npm test` exited 0 on the exact source hashes in `COMPOSABLE_TEST_EVIDENCE.json`. Transient failures of supported internal task/document actions use 1–5 configured attempts, exponential backoff capped at one hour, and the original durable idempotency key. A lost-response fixture writes the task before failing, restarts encrypted HTTP storage, rejects execution under a foreign scheduler owner, and resumes without duplicate business records. Permission failures, unproven action contracts and unknown crash outcomes do not automatically retry. Exhaustion is retained as DEAD_LETTER for review.

The existing workspace exposes policy inputs, waiting times and attempt history. New visual acceptance remains blocked by the browser URL policy. Full multistep editing, explicit reconciliation of arbitrary uncertain effects and exhausted-run recovery remain open; the Automation competitive ledger stays BELOW_PARITY. The preceding exact-tree checkpoint passed GitHub Actions run 58. No production mutation or deployment.

## Sequential workflow authoring — 2026-09-09

The existing Automation workspace now uses one backend-provided authoring contract for ordered internal tasks/documents, notifications and delays, typed step conditions, explicit automatic triggers and schedules, mandatory approval requests and bounded retries. Saving adds an immutable version; older active versions remain active, which the editor explicitly states. It does not silently replace or disable any prior workflow. Shared compilation is side-effect-free; the existing server engine enforces current rights and exact approvals.

Full `npm test` exited 0. The authenticated API test executes the compiled multistep definition, rejects changed approval input, restarts encrypted persistence during a delay, retains the original task, creates the reviewed document once and rejects VIEWER writes. Assets are protected and served in dependency order. Syntax/API evidence does not establish DOM interaction, visual, keyboard or responsive acceptance. Version activation management, visual branching and uncertain-outcome reconciliation remain open. The preceding retry checkpoint passed GitHub Actions run 59. No production changes.

## Preserved workflow version activation — 2026-09-09

An additive owned activation record can select one version or pause all versions sharing the same workflow owner and name. Existing definition flags remain effective until an authorized owner or administrator explicitly changes activation. New versions do not override an established selection. Activation uses a required reason, confirmation and expected revision, returns identical last-command replay without duplicate events, and rolls back on persistence failure. Every committed transition is audited and emits a canonical owned event.

Full `npm test` exited 0. Tests cover current capability and owner enforcement, foreign tenant rejection, administrator selection without scheduler identity expansion, paused delayed work through restart, safe resumption, immutable definition bytes and export after module disablement. HTTP checks verify activation conflicts, encrypted pause persistence, preserved completed-run replay and VIEWER denial. No production mutation. The preceding exact-tree authoring checkpoint passed GitHub Actions run 60. Browser acceptance remains blocked; reconciliation of unknown side effects remains the next Automation recovery gap.

## Verified internal outcome recovery — 2026-09-09

Execution and read-only verification now share one payload mapping for internal tasks and documents. Recovery requires the original run actor, unchanged request and step definition, a trusted idempotency contract and an exactly matching durable record fingerprint. A confirmed reconciliation records the proof and rationale, preserves the interrupted state in history, and sets RECOVERY_READY. It does not execute the next step. A separate normal run request continues through current capability, activation and approval checks. Absent or external evidence remains blocked.

Full `npm test` exited 0. The HTTP fixture actually exits the child server immediately after the real encrypted task commit, then restarts with a persisted RUNNING step. It verifies no blind replay, exact recorded evidence, forged/foreign recovery denial, a second restart after reconciliation, and one task plus one explicitly continued document. Unit coverage adds changed-source refusal, rollback and missing-provider-contract refusal. Document authoring now shares the engine's 12,000-character bound rather than allowing silent truncation. The preceding activation tree passed GitHub Actions run 61. Browser acceptance remains unproven; no production change occurred.

## Tenant-member identity and current-principal execution — 2026-09-09

The existing administrator authentication is preserved. Founder/Super Admin management can create a one-use 24-hour invitation for the trusted deployment tenant. Members enroll with their own salted scrypt password; random session secrets are stored only as hashes and sent through Secure production, HttpOnly, SameSite=Strict cookies. Login/enrollment and cookie-authenticated writes require the configured canonical Origin. Enrollment and authorization changes are atomic and audited in the existing Core audit. Suspensions and role changes revoke existing sessions. User secret scopes never become shared datasets. No production account was created and no invitation was sent.

AsyncLocalStorage isolates request identities. Principal getters revalidate current membership at domain boundaries, including after asynchronous request-body reading. Registered active members can execute their own scheduled workflows and queued tasks under their current roles, with a bounded rotating owner list and isolated failures. The service scheduler does not lend its authority. The Users/Roles surface and a dedicated enrollment/login page use these existing Core-backed APIs.

Full `npm test` exited 0. Unit tests cover one-use redemption races, role changes during password verification, revocation, expiration, retained membership and rollback. HTTP tests use two real fixture sessions, simultaneous private-memory writes, private ZERO conversations, current-role denial, a body-await revocation barrier, cookie/Origin protection, secret-free data projections, current-member scheduling, suspension and encrypted restart. Browser interaction, MFA, SSO and verified email delivery remain unproven or unimplemented. Production public health was separately observed HTTP 200, version 6.0.0; no deployment or production mutation occurred. The preceding recovery tree passed GitHub Actions run 62.

## Industry presets and standalone loading — 2026-09-09

Finance and Analysis pages now isolate component failures and respect partial capabilities. Full regression and authenticated restart tests pass; missing values remain unavailable. Finance loading checkpoint `c1bff62004577cb0b5b37c477ca3c4e6dc2d7ea9` matches local `8f0583160bde0affc2c1e96ee6f0c012a8ae2ed7` at tree `bda5ab8c34dac35a7dceef27d4bd4321857f0960`; GitHub Actions run 71 succeeded.

The subsequent industry preset increment passes full npm test. It adds declarative existing-metric layouts and manual approval-required workflow drafts through existing engines, with no side effects on discovery. Current permissions and capabilities filter availability. Existing records survive encrypted restart and pack changes. The exact source hashes are recorded in COMPOSABLE_TEST_EVIDENCE.json. UI interactions still require browser acceptance. No production changes.
