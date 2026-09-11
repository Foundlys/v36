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
| 7 Sales | PARTIAL | Owned pipelines, exact owner/period/currency quotas and current-source snapshots pass. Explicit per-opportunity probability scenarios now preserve recorded values, separate currencies, null incomplete comparisons and immutable source-bound snapshots through encrypted restart. Hierarchy, amount/date adjustments, sequences and browser acceptance remain. |
| 8 CRM | PARTIAL | Current member getters prevent CRM body-await mutations after revocation. ZERO CRM reads recompute current authorized sources on replay and retain source-free history through restart; source reownership and legacy safe views pass. Custom objects/UI, remaining mixed paths and full competitive acceptance remain. |
| 9 Marketing | PARTIAL | Owned plans and measurement adapters; exact-source sequential creative review now passes real current-member authority, private source/Data checks, no self-approval, immutable approved content, no publication, rollback and encrypted restart. Journey/audience activation, full campaign workflows, real provider proof and browser acceptance remain. |
| 10 Finance | PARTIAL | Preserved accounting engine and Finance-only capability-aware client loading pass full regression and encrypted restart; complete period-close, jurisdiction-specific workflows, scenarios and browser acceptance remain. |
| 11 Analytics | PARTIAL | Owned reports, observed source-scoped cohorts and saved typed cohort definitions pass private ownership/source ACL, revision-bound calculation, current caller rights, capacity bounds, atomic rollback and encrypted restart tests. Broader analytic models, model revision history, large-tenant performance and browser acceptance remain. |
| 12 Calendar | PARTIAL | Current-planner reminders, failure isolation, strict civil dates, half-hour/full-hour recurrence and encrypted restart pass. Actual typed recurrence form preserves intervals and explicit removal through a shared contract. External reconciliation, remaining scheduling UX and browser acceptance remain. |
| 13 Communication | PARTIAL | Retained message/draft separation, invalid/incomplete source availability, owner-authorized sharing, bounded member selection, immutable revision history, CAS restore without access rollback/send, mid-body principal/collaborator revocation and encrypted restart pass focused tests. Live co-editing, comments, reply/forward, safe attachments, mail provider acceptance and browser acceptance remain. Source-bound reply/forward draft preparation now passes exact source/recipient binding, stale body-wait rejection, current source ACL across native/history/export/ZERO and encrypted replay. No source quote or external send is performed. |
| 14 Automation | PARTIAL | Owner-bound execution, bounded retries, sequential authoring, private drafts, version activation, proof-based recovery and searchable paginated run history pass. Visual branching and external recovery evidence remain incomplete; browser acceptance is blocked. |
| 15 Workspace composition | PARTIAL | Shared forms, composer and explicit industry presets; atomic dashboard save/reset revisions prevent stale resurrection. The client session controller rejects reordered/cross-scope responses and preserves edits made during a save with revision handoff. Focused controller, authenticated API and full regression pass. Remaining section completeness and actual browser acceptance stay open. |
| 16 ZERO orchestration | PARTIAL | Exact revision-bound cohorts plus CRM, five owned-domain summaries and deterministic Analytics/Knowledge/Automation/Finance reads now recompute current source rights on replay and retain source-free conversation/audit references. Real role/capability/restart tests and Analysis-only/preferred module routing pass. Provider/model-assisted paths, remaining structured actions and browser acceptance remain. |
| 17 Registries | PARTIAL | Canonical registries retained; public positive-state/receipt forgery blocked; remaining runtime-to-registry integration and complete capability mapping remain Native/generic SMTP status no longer infers authenticated connectivity from socket/HTTP reachability; authenticated mail transport itself remains unimplemented. |
| 18 Policy/risk | PARTIAL | Input-bound approvals and requester identity, connector administration and owner-bound automatic work; complete external-action policy coverage remains |
| 19 Provisioner/composer | PARTIAL | Package preview/apply plus authorized tenant-member enrollment, roles, suspension and retained history; full multi-tenant provisioning/configuration dimensions and browser acceptance remain Real HTTP pre-configuration invitation/directory refusal and absence of partially created accounts are now verified before successful bootstrap and member enrollment. |
| 20 Second industry proof | COMPLETE | Test-only manifest extends owned business records; unavailable in production |
| 21 Standalone matrix | PARTIAL | Nine configuration/workflow/restart profiles pass; full product acceptance remains pending |
| 22 Composition matrix | PARTIAL | Twelve configuration/restart combinations pass; exhaustive choreography remains |
| 23 Adversarial testing | PARTIAL | Tenant, role, ACL, replay, crash and subscriber tests; full remaining mixed-path audit remains |
| 24 Competitive ledgers | PARTIAL | Nine versioned ledgers; critical BELOW_PARITY gaps explicitly open |
| 25 Performance/accessibility | PARTIAL | Static response read failures isolate the request; cohort event copies filter current ACL/name/time before count/byte limits, verified with 50,000 excluded fixture rows. Actual viewport/keyboard/concurrent production load acceptance remains. Communication history now uses one current-parent visibility selection for 20,000 retained revision fixtures; simulated production client handlers preserve stale revision checks and detached workspace isolation. |
| 26 Full regression | PARTIAL | Full checkpoint regression recorded; final completed-product gate cannot be inferred |
| 27 GitHub/CI | PARTIAL | Draft checkpoint published; final release PR/CI/merge gates remain |
| 28 Production deployment | NOT_STARTED | No release until genuine architecture/acceptance defects are closed |
| 29 Post-deploy checks | NOT_STARTED | No new production deployment to validate |
| 30 Browser acceptance | BLOCKED_EXTERNAL | BLOCKED_EXTERNAL_BROWSER_ACCEPTANCE: on 2026-09-09 the isolated local server returned HTTP 200 to its launcher; the connected cloud browser refused http://127.0.0.1:29670/login with net::ERR_BLOCKED_BY_CLIENT. No browser/keyboard/viewport pass, deployment, alternate network route or bypass. |
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

## Dashboard persistence rollback — 2026-09-09

A genuine isolated filesystem failure reproduced a rejected dashboard write remaining in memory. Dashboard writes and resets now use the existing scoped transaction primitive for their layout and audit buckets. Failed persistence restores both; a later graceful process flush cannot commit the rejected state. Authenticated failure/restart tests also preserve unrelated team dashboards and verify successful reset replay. The full regression passed. This increment preserves existing revision semantics; additional concurrent-edit handling remains open. Production was untouched.

## Reconnection and cohort checkpoint — 2026-09-09

The restored runtime contained an older snapshot. Its original worktree and pending order-review edits were preserved. The complete GitHub-tested tree was recovered by blob/tree hashes in a separate worktree; all prior source hashes matched. See RECOVERY_20260909_RECONNECTED.md. The interrupted cohort work was reconstructed and completed, including correction of its duplicate invalid-event count and static client route. Unit and authenticated Analysis-only API tests pass, and the full npm test suite exited 0 on this exact source set. No frozen engines changed. Browser and full masterbuild acceptance remain incomplete; production was untouched.

## Static response failure isolation — 2026-09-09

An isolated ReadStream failure reproduced an application-process crash. HTML and asset responses now bind read errors to their own response: an unopened failed file returns 503 without a filesystem path, partial output is closed, and disconnected clients release the stream. Concurrent API reads remain available and retain configuration. The focused fault/cancellation/restart test and complete npm test suite pass. Production was not modified. This does not establish load, viewport or browser acceptance.

## Bounded cohort source projection — 2026-09-09

Strict cohort query validation now happens before source retrieval. Current ACLs, event names and observed end filter records before detached copying; selected data has both a 20,000-event and 8 MiB bound. Overflow rejects the query without a partial report. A fixture with 50,000 irrelevant/private events verifies their payloads are never copied, authorized output is detached, malformed queries fail before retrieval and existing unbounded engine callers retain their contract. Focused tests and full npm test pass. This is bounded-copy correctness, not indexed scanning or production throughput acceptance. The preceding static-response tree passed GitHub Actions run 75. No production mutation.

## Concurrent dashboard editing — 2026-09-09

An actual HTTP write without a revision reproduced silent overwrite. Existing dashboard scopes now require a strict numeric If-Match precondition; only never-written scopes accept a header-free initial create. The client sends revision zero for a new scope. Resets append a bounded, persistent tombstone so revisions cannot return to zero and stale saves cannot resurrect a reset layout. A no-op reset at the current revision makes no new write. Missing preconditions return 428; stale revisions return 409; malformed/weak/wildcard matches return 422. Existing authorization precedes revision checks.

Focused HTTP tests and full npm test pass: simultaneous writes and initial creates admit exactly one writer, stale resets cannot remove recreated layouts, storage failure rolls back the revision and content, independent scopes remain separate, and encrypted restart retains the reset generation. The earlier persistence regression still performs real fault injection using the now-required preconditions; no assertions were removed. Client conflict messages retain local edits. UI request ordering and browser acceptance remain open. No production mutation.

## Saved cohort definitions — 2026-09-09

Typed cohort definitions now use existing owned Core records and capability contracts, with named save/load controls on the actual Analytics page. Saving has no source reads or business execution. Recalculation requires an exact current revision and always rechecks the requesting principal's current event/report access. Strict dates reject calendar rollover; UTC time fields preserve saved query precision. Unit and authenticated HTTP tests cover create replay, private owners and events, stale revisions, storage rollback, encrypted restart, archive, capability revocation and retained export. Full npm test exited 0. Model revision history and broader models remain open.

The previous dashboard concurrency tree passed GitHub Actions run 77. A fresh Browser connection succeeded; local acceptance navigation was rejected by net::ERR_BLOCKED_BY_CLIENT. Local fixture startup logged ONLINE, but a separate shell request could not reach its port; no reachable application or browser interaction is claimed. The isolated fixture was terminated. No production mutation or deployment.

## ZERO cohort analysis and replay — 2026-09-09

The real ZERO turn path now consumes an explicitly loaded saved cohort definition revision and the current reports/events capabilities. It uses the same canonical query service as Analytics. No source result is retained in conversation/audit; only a definition reference and generic response remain. Repeated turns recalculate current authorized sources and cannot return the earlier broader report. Authenticated tests verify role downgrade, encrypted restart, private source exclusion, source-free conversation text, foreign owner denial, stale definition refusal, capability/tool revocation and no business side effects. Full npm test exited 0. The previous saved-definition checkpoint passed CI run 78. Other ZERO action paths and full masterbuild acceptance remain incomplete; production was untouched.

## Sales probability scenarios — 2026-09-09

Explicit, revision-bound probability assumptions now project over the existing owned Sales forecast without modifying opportunities. The comparison retains separate currencies, exact cent rounding and null complete totals when source/probability coverage is incomplete. Scenarios are labeled user assumptions and never accounting revenue or measured confidence. The existing immutable snapshot path binds all source/target data plus assumptions and retains current-source ACL checks.

Focused unit/HTTP tests and full npm test pass: read-only query access, private source denial, unchanged records, missing-data semantics, stale revisions/basis, idempotency, failed storage rollback, encrypted restart and retained export. The actual forecast editor has scenario selection/rationale/comparison/save controls; browser acceptance is unproven. The previous ZERO cohort tree passed GitHub Actions run 79. Production was untouched.

## Dashboard client ordering and bootstrap boundary — 2026-09-09

The actual workspace uses a small session controller for dashboard loads and saves. Reordered load responses cannot replace the current scope; saving requires the loaded scope, freezes the outbound payload and admits only one pending write. Edits made while a save is pending remain local with the acknowledged revision, so the next save uses the correct base. A response from a prior scope is ignored. Focused controller tests exercise these orderings, and authenticated HTTP tests verify protected helper delivery before the workspace script. Full npm test exited 0. Browser interaction remains unproven.

A suspected unconfigured-tenant member bypass was independently tested and did not reproduce: the existing identity_composition_required guard refuses invitation and directory access before setup. No authorization implementation was changed. The new HTTP test confirms there is no partially created account, then verifies normal bootstrap configuration, real member privacy, read-only/Core denial, ZERO filtering, conversation ownership and encrypted restart. The preceding Sales scenario tree passed CI run 80. No production changes.

## Marketing creative content review — 2026-09-09

Owned review requests now bind exact source revisions, rationale and sequential reviewer IDs without granting source access. Current read/approve rights and source visibility are required at decision time. Changed source content invalidates approval; rejection and requester withdrawal retain history. Final approval atomically freezes the creative and retains NOT_PUBLISHED. Unit tests and real tenant-member HTTP sessions verify private review copies in native/shared Data paths, self/out-of-order denial, role/capability revocation, idempotency, failed storage rollback, encrypted restart mid-review/after approval and retained export. Full npm test exited 0. Actual workspace request/review controls are delivered; browser and external publication remain unproven. The preceding dashboard session tree passed CI run 81. Production was untouched.

## Calendar execution principal — 2026-09-09

A real member HTTP test reproduced a reminder executing under the service worker after the author lost scheduling rights. Reminder writes now record the trusted current planner separately from recipient ownership; workers resolve the current active member and permissions. Existing canonical author provenance is accepted for retained rows; rows without trusted authors remain untouched. Each reminder commits notification, completion revision, audit and outbox atomically. Failures remain isolated, and bounded rotating batches prevent a full failed batch from starving later work.

Focused tests and full npm test exited 0: revocation, suspension, explicit recipient delegation, malformed records, failed persistence, restart/retry without duplicates, capability denial and more than 100 failed reminders. The previous Marketing checkpoint passed CI run 82. Cursor fairness is process-local; restart retains delivery state and starts scanning again. No external delivery or browser acceptance is claimed, and production was untouched. The next observed Calendar defects are permissive date rollover and half-hour recurrence ambiguity.

## Calendar civil time and recurrence — 2026-09-09

Reproduced defects included silent February 30 rollover, unreported half-hour ambiguity and lost milliseconds on subsequent occurrences. A shared Calendar time contract now rejects invalid civil dates before writes/queries and resolves generated wall times against actual nearby IANA offsets. Ambiguous/gap occurrences require correction or explicitly offset one-off events. Elapsed duration and milliseconds are preserved. Existing records are not rewritten.

Unit and authenticated API tests cover leap dates, full/half-hour transitions, a skipped civil day, weekly intervals, rejected-edit source/revision preservation, recurring conflicts and encrypted restart. Full npm test exited 0. Previous principal checkpoint passed CI run 83. This is local/runtime timezone evidence, not external-calendar reconciliation or browser acceptance. The next verified UI gap is the edit form dropping the stored recurrence interval. Production was untouched.

## Calendar editor and Communication counts — 2026-09-09

The actual Calendar form now has typed frequency/count/interval controls. Shared browser/server normalization preserves a two-week interval during edits, explicitly removes recurrence with null, and refuses unsupported rules. Authenticated API tests verify the protected asset, unchanged intervals, removed future conflicts and encrypted restart. Browser interaction remains unproven.

An authenticated test reproduced an unsent Communication draft counting as a message. The dashboard now reports drafts separately and derives message counts only from accessible retained message records. Missing classification and incomplete page coverage yield unavailable counts; independently disabled draft/inbox capabilities do not remove unrelated accessible components. Real member/private-owner, revocation, encrypted restart and bounded pure projection tests pass. Full npm test exited 0. Prior date checkpoint passed CI run 84. No production mutation.

During this regression, a separate isolated CRM reproduction confirmed that revoking a member while a request body is pending produces HTTP 401 after a lead has already entered memory. Existing regression did not cover this. Exact next action: preserve dynamic current identity through the CRM principal adapter and verify no mutation, audit or persisted record on pending-request revocation. This checkpoint is not full security acceptance.

## CRM current request authority — 2026-09-09

An authenticated partial-body request reproduced HTTP 401 after a lead had already entered memory following role revocation. The CRM principal adapter now preserves the underlying current member getters instead of copying roles/identity before await. Composition and engine entry checks therefore reject before mutation. The frozen CRM engine is unchanged.

Tests cover revoked create, suspended update and the special dashboard route; records and CRM audit remain identical before/after refusal and encrypted restart. Ordinary authorized CRM operations and full npm test pass. A separate isolated test subsequently reproduced a CRM source-access leak on ZERO result replay after role downgrade. Exact next task is read-result revalidation and source-safe conversation output; full security/product acceptance is not claimed. No production mutation.

## CRM ZERO current-source replay — 2026-09-09

The reproduced stale CRM answer leak now uses read-only recalculation on replay with the current principal and an exact-question hash. New CRM answers retain only read references in conversation/audit. Legacy CRM source-bearing snapshots and conversation text receive safe read projections without altering stored evidence; old assistant rows without a retained verifiable audit are marked unavailable. Non-read action receipts retain existing replay behavior.

Unit, real member API and full npm test pass: role downgrade, source ownership change without role change, changed question refusal, capability revocation, foreign conversation denial, encrypted restart, source-free history and no business actions. Existing CRM and ZERO regressions pass. Previous published current-principal checkpoint passed CI run 85. A separate Communication fixture reproduced the analogous generic domain-summary replay leak, which is the next task. Production remains untouched; no broad completion claim.

## Internal ZERO read replay and standalone routing — 2026-09-09

A separate Communication fixture reproduced the same retained-result source leak. The source-free retention/read projection contract now also covers five owned-domain summaries and deterministic Analytics, Knowledge, Automation and Finance reads. Replay binds the original question and execution family, recomputes current authorized sources, and never reruns business actions. Existing source-bearing audit/history evidence is preserved in storage and receives safe read views. The existing exact-revision cohort path remains intact. Provider/model-assisted paths are not claimed complete.

An Analysis-only question about conversion also reproduced an unnecessary CRM dependency. Composed ZERO routing now respects explicit module preference, skips unavailable CRM, and recognizes explicit KPI names. No missing-data value is invented, and denied Analytics capability does not fall back to CRM. Real member API, all-source role/capability/restart fixtures, existing ZERO action/idempotency regressions and full npm test pass. Prior CRM replay checkpoint passed CI run 86. Next independent work is Communication draft collaboration/history; external delivery and browser acceptance remain blocked. Production was untouched.


### Communication continuation — recovered unpublished collaboration

Recovery on 2026-09-09 found local `5a622839cc83ed38f656be11bb6acd90ef6cb765` and PR #15 `afdc6e5ad528a6744af6d8d58b5dac8c987c7ab4` have identical tree `dc4220d359ba5fea36b3bb787ec34ef1341f6d32`. GitHub Actions run 87 (`34329367885`) succeeded on that published commit. The old remote-tracking feature ref was stale; it was not treated as current. Canonical remote main remains `073f03041b72a1c35c7559e116c3e0cd4aa0db02`. Both existing worktrees, older modified Procurement files, stashes and local commit histories were inspected without resetting or switching branches. No stashes or staged changes existed in the recovered worktree.

Six modified tracked files and three new Communication files were newer than the published checkpoint. A binary diff, source archive, refs/reflog and complete local Git bundle were preserved before changes. Their exact recovered contents were committed as `e630b67463d8405eeb8f08b49f437b8a5105748b`, not discarded or rebuilt.

The collaboration increment now verifies explicit owner/admin sharing, current tenant member lookup, collaborator read/write boundaries, immutable history metadata/detail, revision-conflict prevention, source-hash-checked restore, restoration without reverting access grants, replay receipts and encrypted restart. An actual pending HTTP edit loses authority immediately when its collaborator grant is removed; a pending share refuses a newly suspended target; a pending restore refuses a newly revoked writer. Rejected operations do not appear after restart. Export remains subject to the established retained-export policy and current parent record visibility.

Additional reproduced defects: `available:false` could be overwritten by the snapshot loader and rendered as zero; incomplete/invalid source contracts were insufficiently validated; sharing unversioned retained drafts failed or risked a nonnumeric revision; oversized input could be silently truncated by generic sanitization. Focused regressions now pass. Recipient editing permits explicit clearing, member selection uses display names, and history pagination cannot silently advance an older form's write precondition.

Browser acceptance was retried with a local fixture confirmed HTTP 200 by its launcher. Cloud Browser refused its login URL with `net::ERR_BLOCKED_BY_CLIENT`; no actual keyboard, viewport or browser interaction is claimed. No production mutation. Current Front official sharing and draft-reply references were checked on 2026-09-09; the Communication ledger remains BELOW_PARITY for explicitly listed gaps.

Full `npm test` for this Communication increment exited 0. Exact code/source and log hashes are recorded in `COMPOSABLE_TEST_EVIDENCE.json`. This verifies the development checkpoint; remaining module, provider, performance and browser acceptance gates are not promoted to complete.


### Communication history bounds and truthful SMTP state

A 20,000-revision fixture reproduced 20,000 parent collection scans in one history listing. Parent visibility is now computed once per synchronous list/Data/export projection. A fresh request recomputes current collaborator rights; there is no retained ACL cache. Pagination excludes revision bodies. Production client handlers were exercised with an in-memory DOM contract: a newer history page cannot refresh an older share/restore form's expected revision, removing all collaborators sends an explicit empty list, read-only histories do not expose write controls, and completed actions do not redraw detached workspaces. These are code-level interaction tests, not browser/keyboard/viewport acceptance.

Native email probing previously claimed connected after a TCP socket opened without SMTP authentication. Generic SMTP profiles could likewise claim connectivity from a configurable HTTP health response. Both paths now share a conservative configuration projection: configured does not imply authenticated, connected or send-verified. The absent SMTP adapter no longer probes arbitrary administrator-supplied TCP/HTTP destinations. The ledger records authenticated transport and receipt processing as BELOW_PARITY implementation work; missing provider credentials are an additional external dependency, not a substitute for that implementation.

The preceding collaboration tree `6d5970b68591bda0e275c53bc582691e48a6253d`, published as `e54b115f5507f70f2aa3e3b34197b9f9404d8c04`, passed GitHub Actions run 88 (`34333036427`).


### Source-bound reply and forward preparation

Native Communication can preview a retained message and create an internal REPLY or FORWARD draft with an exact source revision/hash, validated recipients and an actor/input-bound idempotency receipt. Original text is presented as untrusted reference only; it is not automatically copied into the new authored body. No mail is sent, no mailbox completeness is inferred and no external thread receipt is invented. The Messages workspace exposes this preparation separately from ordinary draft editing.

A labelled retained-message fixture drives authenticated API tests; the runtime message CRUD route still rejects user-forged inbound records. Tests cover recipient mismatch, current source ownership, source changes during request-body waits, mutation rollback, encrypted restart and idempotent replay. Revoked source access hides derived drafts/history from native reads and ZERO, and current source ownership also bounds export. Existing retained-export permission continues working after module disablement. Independent authored drafts remain available when a different source becomes inaccessible.

Focused commands: `node communication-replies-test.js`, `node communication-replies-api-test.js`, `node communication-drafts-test.js`, `node communication-drafts-api-test.js`, `node communication-history-bounds-test.js`, `node communication-drafts-client-test.js`, `node communication-provider-state-test.js`. These do not substitute for real provider, browser or final competitive acceptance.

Full `npm test` including Communication source-bound drafts, history bounds, client handlers and SMTP truthfulness exited 0. Its current source hashes, actual 21-profile configuration matrix and log fingerprint are in `COMPOSABLE_TEST_EVIDENCE.json`. Active work remains Phase 24; earlier PARTIAL product gates are unresolved requirements, not instructions to restart completed work. Current production health/readiness could not be re-observed because the access tool refused both URLs. Historical HTTP 200 observations are not current proof. No production writes or deployment.

The final SMTP consistency regression also proves that a username alone is not configured and that both native and generic email status consume the same SMTP environment configuration. Current attachment checksum: `06ed763665e5ed8479b5aa60116aa6d11c0c776587f07fc9d12883bfd2a653bf`; current user overrides prohibit production changes and restarting completed phases.


### Retained text attachments

Draft attachments accept UTF-8 .txt files up to 64 KiB, with at most ten current attachments, twenty immutable retained files per draft, 2,000 files and 8 MiB of decoded attachment content per tenant/dealer scope. Unsupported file formats, malformed/canonical-invalid base64, invalid UTF-8, dangerous filename characters and control/bidirectional override codes are rejected before persistence. Unknown retained storage sizes fail closed. This is text-only format validation, not malware scanning or full binary attachment support.

Attach/detach actions bind the current draft revision, requester and input. Exact historical bytes remain available for verified restore and tenant-owned export under current draft/source visibility. Content, draft, revision history, audit, outbox and idempotency receipts share the existing atomic encrypted persistence adapter. Generic Data and ZERO projections never receive the stored attachment bytes. Production client handlers verify SHA-256 and download text/plain; they do not inline-render uploaded content. Focused tests cover quota/integrity failures, readonly/current source/tenant boundaries, altered retries, detached workspace handling, atomic rollback and encrypted HTTP restart. A real pending upload is rejected after collaborator revocation and creates no retained file. Browser acceptance remains blocked as documented above.

The preceding published head 98ceadb62ca822c5ec179435d981e9ccfb82f100 passed CI run 91 (34335829819). Current source regression/CI must be verified separately; no production action or new COMPLETE/PARITY verdict follows from the text-attachment increment.


### Personal retained-message inbox

The Messages section now uses a dedicated read/search inbox, rather than a generic create/edit form that could only reject attempted provider-message writes. Search covers retained subject/body/participants; pages and direction/personal read/archive filters apply only to current authorized sources. External mailbox totals remain null and coverage is labelled AUTHORIZED_RETAINED_RECORDS_ONLY. Missing current-user read evidence is null, not inferred from provider status or opening the detail. Changed message revisions invalidate old read evidence while preserving the user's local archive choice.

Read/archive actions affect only the current user's internal inbox state. They bind both source-message and personal-state revisions, use actor/input-bound replay, publish an owner-private event, and atomically retain state/audit/outbox/receipt. No provider record or mailbox is changed. Content-free personal state remains private in shared Data, and owned export after disablement rechecks current message visibility. Native detail renders external text inertly and exposes draft preparation through the existing source-bound contract. Client search response generations prevent late or detached views replacing current content.

Focused tests: communication-inbox-test.js, communication-inbox-client-test.js and the expanded communication-replies-api-test.js. They prove 125-record pagination, private search counts, unknown coverage/read state, different users on the same source, both revision preconditions, persistence rollback, body-wait source revision/reownership changes, read-only denial, encrypted replay and current-source export. These are local contract/API/handler tests, not live provider or browser acceptance. Preceding text-attachment head 4b432275413b0b31c9ff2c9ff581ca09f2178815 passed CI run 92 (34362053761).


### Explicit SMTP authentication

Native and generic email test POSTs now require current Communication/inbox write authority plus the existing Core connector-management permission. They authenticate only the configured account; no MAIL, RCPT or DATA command is implemented by this adapter. Ordinary native/generic status reads never connect. SMTP uses verified TLS 1.2+ with hostname/SNI validation on 465 or mandatory STARTTLS on 587; pre-upgrade capabilities are discarded. A public IPv4 DNS result is selected and pinned into the actual socket lookup. Private/reserved answers, unsupported ports/auth mechanisms, malformed/oversized replies, TLS/certificate failures and bounded timeouts fail closed. IPv6-only hosts and non-PLAIN mechanisms remain unsupported.

Authentication attempts and current successful proof use the existing encrypted Core adapter. Concurrent attempts are refused. Configuration and current identity are checked after DNS, before credentials and before persisting success. Proof is private, credential-bound and expires after fifteen minutes; changed credentials, lost rights or a failed final persist cannot yield authenticated status. Even a successful SMTP auth proof keeps connected=false, send_verified=false and mailbox_access_verified=false for the broader email connector. Successful SMTP authentication does not establish complete mail transport or delivery.

communication-smtp-test.js runs actual local TLS/STARTTLS fixture servers with generated test certificates and injected local routing; no live provider account is contacted. communication-mail-auth-api-test.js uses real member sessions and encrypted runtime state with an explicitly labelled transport fixture, proving both HTTP entrypoints, passive shared status, configuration/role changes during awaits, private proof and zero sent messages/tasks. Unit tests additionally cover proof expiration, concurrency and atomic persistence failure.

Protocol references checked 2026-09-09: [RFC 8314 TLS for submission](https://www.rfc-editor.org/rfc/rfc8314.html), [RFC 3207 STARTTLS state reset](https://www.rfc-editor.org/rfc/rfc3207.html), [RFC 4954 SMTP authentication](https://www.rfc-editor.org/rfc/rfc4954.html), [Node TLS hostname/certificate options](https://nodejs.org/download/release/latest-v22.x/docs/api/tls.html), and [RFC 5321 submission acceptance and delivery responsibility](https://www.rfc-editor.org/rfc/rfc5321.html). The future DATA response must be distinguished from final delivery and ambiguous outcomes must not trigger blind resend.

Preceding retained-inbox head 4f24df55cb4b5bfb8ea105514946057fb26e4687 passed CI run 93 (34363389014). Production remains untouched; account/provider, full transport, browser and competitive acceptance remain open.


### Source-bound internal send review

Communication now prepares a review of exact draft content, recipients, attachment hashes, sender/account HMAC binding and current unambiguous user-recorded recipient/purpose preferences. A different active designated member must have current approval permission and access to the same sources. Source/account/preference changes invalidate review. The requester may withdraw pending or internally approved reviews; only the assigned reviewer can approve or reject. These records remain internal: ready_for_submission is false, drafts retain NOT_SENT, and no message/task or SMTP submission is created. User-recorded preferences are not provider-verified consent or a legal determination.

Review state, source snapshot, actor/input-bound receipts, audit and outbox share atomic encrypted persistence. Retained owned export uses current parent/source visibility and strips the private account binding; generic Data never includes review snapshots. Real sessions prove configuration and permission changes during HTTP body waits, assigned-reviewer denial, approved withdrawal, encrypted replay and current-source export. Unit tests additionally cover source/preference changes, rollback and inactive reviewers. Production DOM-handler contracts require explicit reviewer/decision selection, bind the displayed preview revision, preserve retry keys only for identical input, reject A-B-A stale preview/search results and prevent detached actions. These tests do not establish browser acceptance.

Focused commands: node communication-send-reviews-test.js, node communication-send-reviews-api-test.js, node communication-send-reviews-client-test.js. Preceding SMTP-authentication head 99c14c2ed80cf65abe4c57b837e627d6afa78266 passed CI run 94 (34365311224). Provider submission, ambiguous-outcome recovery, receive/threading, ZERO handoff and competitive acceptance remain open; production is unchanged.


### Approved SMTP submission and durable unknown outcomes

A separate explicitly confirmed native submission uses the exact internally approved draft/source, recipients, sender/account, attachment hashes and user-recorded purpose preferences. The requester and designated reviewer must remain active and retain source/policy rights; the executing member also needs current Core connector-management and Communication draft/inbox write permissions. Current sources, account and authority are rechecked across transport awaits and before payload bytes. User-recorded preferences are not a legal determination or provider consent proof.

Stable Message-ID, deterministic bounded ASCII MIME, payload hash and original attachment bytes are durably encrypted before networking. UTF-8 subjects are encoded without splitting code points; authored body line endings are canonicalized. The original .txt attachment bytes use application/octet-stream plus attachment disposition to preserve their exact approved line endings without inline rendering. Header/control injection, unsupported address syntax, invalid Unicode, overlong wire lines and altered attachments are refused. Storage is bounded at 1,000 attempts/tenant, 100/draft and 16 MiB retained MIME; native inbox bounds remain 25,000 records. No retention purge is introduced.

The SMTP adapter authenticates over verified TLS, accepts every envelope recipient before DATA and synchronously persists DATA_IN_FLIGHT before writing content. A final 250 is provider acceptance, not recipient delivery. Explicit rejection, failure before content and ambiguous post-content disconnect/timeout remain distinct. Only verified acceptance plus successful atomic receipt/message persistence creates an outbound recorded message. Source drafts remain separate and NOT_SENT. Authentication-only calls still never issue MAIL/RCPT/DATA; passive connector status never connects.

Identical retries return the retained attempt and never resend. CONNECTING, DATA_IN_FLIGHT, UNKNOWN or already accepted matching source attempts block new submissions; uncertain attempts also block bypass through a new draft revision/review. Final persistence failure rolls back to the durable in-flight state, so a lost receipt does not become an invented zero or a retry. Real-session tests perform an actual fixture server process exit after DATA persistence; encrypted restart creates no second offer and no unproven message. Another test revokes executor rights after offered bytes: the observed acceptance remains durable under permission-free receipt attribution, while the now unauthorized response and future actions are refused. Receipt attribution never authorizes a new effect or borrows another member's privileges.

Current draft/source visibility governs native attempt reads and retained owned export, including exact MIME; operational payloads are excluded from shared Data. Native UI requires a distinct send confirmation, prevents duplicate pending form submissions, distinguishes acceptance from delivery, and shows uncertain outcomes without a resend control. These are handler/API/transport contracts, not actual browser acceptance. Unknown-attempt reconciliation, IMAP receive, provider thread identifiers, bounce/delivery verification, ZERO handoff and legitimate live account acceptance remain open.

Focused commands: node communication-mime-test.js, node communication-smtp-test.js, node communication-submissions-test.js, node communication-submissions-api-test.js, node communication-send-reviews-client-test.js. The predecessor internal-review head 9ffadb987fc1bc3a71edfde79a932c47c45d56d4 passed CI run 95 (34367627874). No live mail was sent and production was not altered. Protocol references checked 2026-09-09: [RFC 2045 MIME encoding](https://www.rfc-editor.org/rfc/rfc2045.html), [RFC 2047 encoded subjects](https://www.rfc-editor.org/rfc/rfc2047.html), and [RFC 5321 DATA acceptance and timeout ambiguity](https://www.rfc-editor.org/rfc/rfc5321.html).


### ZERO Communication outcome reads and unavailable counts

A reproduced ZERO status request previously ended at opening the Communication workspace. Explicit Communication status/overview requests now reach the existing permission-gated domain read; plain navigation remains navigation. The read includes integrity-checked counts of retained submission attempts visible through current draft/source access. CONNECTING/DATA_IN_FLIGHT/UNKNOWN remain acceptance-unknown; delivered and complete-mailbox totals remain null. Missing entity capabilities are rendered as unavailable, not a literal null or trustworthy zero. Invalid retained payload size/hash/status produces an unavailable submission summary.

No new ZERO external write tool is introduced. The existing source-free retention/replay contract recomputes current visible attempts after draft reassignment and encrypted restart; conversation/audit snapshots retain no source results. Real HTTP tests verify unknown acceptance, unchanged plain navigation, current-source exact-turn replay and unavailable message counts with inbox capability disabled. The ZERO prepare/review/execute handoff, provider receive/threading and reconciliation remain open. The preceding submitted-mail checkpoint is published as 9cbf1c6ef0085fe0560a234c6eb977b993e6fddd with tree 3d9fef4fa990debf8fca3cb87551e30a94eba2bd; it passed CI run 96 (34369545095).

## Phase 24 continuation: read-only mailbox receipt

Full `npm test` exited 0 at 2026-09-09T16:08:41.440281+00:00 for 226 source hashes recorded in `COMPOSABLE_TEST_EVIDENCE.json`. Actual configuration output still contains nine standalone and twelve combination profiles; product acceptance remains pending. Log `.recovery-evidence/20260909-communication-imap-regression.log`, SHA-256 `a31ca4c6b292dec640612b5a44940bbff12682ce68c97fd3802c1e6999dc33ec`. Prior published head `562d24ca5d4cb7898c532cc7f83dde6053776030` / local `2885176b00d223ac064d45b4fd0954a0f2437982` / tree `1d806b05d492f2a6b6e347a345289bc760970642` passed CI 97. This new source checkpoint needs its own CI.

Read-only bounded IMAP receipt now passes local TLS rev1/rev2, provider draft exclusion, unavailable content, current source downloads/export, atomic import/UID deduplication and actual session/restart tests. Threading/reply headers, receipt reconciliation and ZERO action handoff remain active code work; no live provider or browser acceptance is claimed. Only explicit IMAP sync contacts the configured provider. Status is passive. Exact raw MIME is private and downloaded as octet-stream after integrity verification. Coverage means UIDs observed over the stated scan window, includes provider drafts, and never substitutes for current external message totals or delivery proof. The retained inbox remains usable without a configured provider. TLS fixtures and HTTP transport fixtures are labelled and isolated; no real inbox or recipient was contacted.

Protocol references: [RFC 9051](https://www.rfc-editor.org/rfc/rfc9051.html) for EXAMINE, UIDVALIDITY/UID and BODY.PEEK; [RFC 8314](https://www.rfc-editor.org/rfc/rfc8314.html) for implicit IMAP TLS; [RFC 2047](https://www.rfc-editor.org/rfc/rfc2047.html) for encoded headers. These establish protocol requirements, not live provider evidence.

## Phase 24 continuation: reviewed reply headers and retained conversations

Source-bound reply review now includes exact RFC 5322 In-Reply-To/References headers; source revision changes block review and submission. Approved submission persists the same linkage without claiming recipient delivery; forwards do not acquire reply headers. Current-source conversations derive only from visible retained headers, never subject equality, and expose duplicate-ID ambiguity, incomplete participants and unknown external coverage. Native HTTP, isolated approved-submission, encrypted restart and production DOM handlers pass. Malformed Reply-To is unavailable instead of silently selecting a different recipient. Provider Draft flags continue to withdraw ordinary message and derived-draft access.

Full `npm test` exited 0 at 2026-09-11T08:08:09.018647+00:00, with 230 source hashes and the actual 21-profile matrix in `COMPOSABLE_TEST_EVIDENCE.json`. Log `.recovery-evidence/20260911-communication-threads-regression.log`, SHA-256 `e6cec996d2ca4e2790042bbc260e02820a977796d7546e5c1d1d3a87b3568974`. IMAP predecessor remains locally preserved at `1163d44966aaa45a814e2e6352ad0dce1666d828`; PR #15 still requires publication and CI for this combined increment. No production changes or live messages.

[Sections 3.6.2–3.6.4 of RFC 5322](https://www.rfc-editor.org/rfc/rfc5322.html) establish Reply-To and reply identifier semantics. Header linkage is unverified source metadata, not sender identity, current provider-thread completeness or delivery evidence. All remaining ledger requirements remain in scope.

## Phase 24 continuation: native Communication actions through ZERO

ZERO now exposes native source-bound reply preparation, internal draft creation, exact send preview, reviewer search, designated review/withdrawal and separately confirmed approved submission. Tool discovery and execution use the current operation-specific Communication and Core permissions. The same native services enforce all source, preference, account and approval rules; ZERO does not borrow a reviewer or generic confirmation. Actual HTTP sessions prove explicit submission, current owner/role checks across body waits, conflicting in-flight payload denial, encrypted exact-turn replay without resend and source-free conversation/audit views. Production UI delegates existing review/reply controls through ZERO with source selection, unchanged confirmation payloads and retry keys, and detached-view guards. This is isolated SMTP/HTTP/DOM evidence, not live delivery or browser acceptance.

Full `npm test` exited 0 at 2026-09-11T08:24:26.079587+00:00, with 234 source hashes and the actual 21-profile matrix in `COMPOSABLE_TEST_EVIDENCE.json`. Log `.recovery-evidence/20260911-communication-zero-actions-regression.log`, SHA-256 `ad4e405199377a42f0b246bd354b8ea827a3b98482712c4482e9322756cddcd5`. Prior local `16371981730880258f931563ff4a478d7da92857` matches published `b6e29fb33f71f88fd254dd8b1b613ac9e346cfcb`, tree `79f092da24cc4684a16e213ecea37131a04ac29f`; [CI 98](https://github.com/Foundlys/v36/actions/runs/34577834437) passed. This new ZERO-action increment requires its own CI. Phase 24 remains active. No production changes or real mail.

## Phase 24 continuation: comments and controlled live draft editing

Internal draft comments and replies now use current parent/source access, exact source revisions, author-only withdrawal with retained originals, bounded history, actor/input replay and atomic encrypted persistence. A separate sixty-second editing grant exposes a shared working copy without changing the saved draft or Messages count. Explicit confirmed takeover rotates the private grant and blocks old editors, including an already-authenticated HTTP save awaiting its body. Current membership/source/write permissions and expiry govern each update; tokens stay out of reads, Data, audit and owned exports. Native controls publish work text while editing, retain local text on takeover/conflict, preserve pending confirmation during polling, clear revoked source views and discard detached responses. Unit, real-session/restart and production DOM-handler tests cover these contracts; actual browser/keyboard/viewport and provider acceptance remain unproven.

Full `npm test` exited 0 at 2026-09-11T08:45:38.785261+00:00, with 240 source hashes and the actual 21-profile matrix in `COMPOSABLE_TEST_EVIDENCE.json`. Log `.recovery-evidence/20260911-communication-collaboration-regression.log`, SHA-256 `963f065f18c69604c041cddf5fe57857c68b66d84c0c9916807ab1041ba741cc`. Preceding local `32a3ae65767e9069a1afcce7ab9dd2ad4a51c305` matches published `2f5a8ca8a99616c2fac6a39592bbe9358fe78bdc`, tree `e17f333d73d2e8a320a84ced83b66ed347ab3e7e`; CI 99 passed. This increment needs its own publication/CI. Remaining requirements stay in scope. Phase 24 remains active; no live mail or production mutation.

## Phase 24 continuation: source/account-bound reply-all and Cc

Native and ZERO reply-all preparation now binds the exact current visible source recipients and configured sender. It preserves separate To/Cc, excludes the configured sender and repeated addresses, never copies blind recipients, and returns unavailable when source recipient or sender data is incomplete. Versioned source fingerprints preserve prior reply/forward contracts while binding new Cc and thread metadata. Draft editing, shared work text, immutable revisions/restores, review preview and recorded outbound messages retain Cc. Every To/Cc recipient requires the same current purpose preference and designated exact-source approval; the SMTP envelope includes all approved recipients while MIME preserves their header roles and reply linkage. Isolated approved transport, real native/ZERO HTTP body-wait changes, current-source replay, encrypted restart and production handlers pass; no live provider send or browser acceptance is claimed.

Full `npm test` exited 0 at 2026-09-11T08:56:06.257467+00:00, with 243 source hashes and the actual 21-profile matrix in `COMPOSABLE_TEST_EVIDENCE.json`. Log `.recovery-evidence/20260911-communication-reply-all-regression.log`, SHA-256 `803dcb856ad563f3c5b6e8ea0d1a0b85812013fa655fcf2c8e27607ccfe7c6c5`. Preceding local `8ef4d063cb792349afbe814627e26c995b81c5fd` matches published `aa65e42c088f808b89843192e44b0b18f099cf09`, tree `5595550ee98e21b4ac95e65a67de1feb156bc814`; CI 100 passed. This increment needs its own publication/CI. Phase 24 remains active; no live mail or production mutation.

[Front reply-all](https://help.front.com/en/articles/2247) and [RFC 5322 destination fields](https://www.rfc-editor.org/rfc/rfc5322.html) were checked 2026-09-11. Original visible recipients may be copied to Cc; blind recipients are never promoted into visible fields. These are workflow/protocol references, not Foundly live-provider evidence.

## Phase 24 continuation: bounded scanned binary attachments

PDF, PNG and JPEG attachments now require bounded signature checks and a successful local ClamAV process before atomic attachment. Exact bytes and immutable scan receipts survive history/restore and current-source owned export; binary content stays out of generic Data and downloads as hash-checked octet-stream without inline rendering. Scanner execution uses fixed arguments, no shell, no inherited application credentials, private temporary storage, current authority/configuration checks, official recent database requirements, limits and strict exit/result validation. Alerts, skipped/error/timeout outcomes and source revocation while the process runs never attach a file. Review/submission refuse expired binary scans without deleting the original file/history. Actual subprocess fixtures, real HTTP/restart and production handlers pass; they do not prove a real installed scanner/database, malware detection rate, browser or live-provider acceptance. Legacy text attachments remain explicitly unscanned. The current scratch runtime lacks clamscan; no production dependency was changed.

Full `npm test` exited 0 at 2026-09-11T09:11:10.220682+00:00, with 248 source hashes and the actual 21-profile matrix in `COMPOSABLE_TEST_EVIDENCE.json`. Log `.recovery-evidence/20260911-communication-binary-attachments-regression.log`, SHA-256 `d58dfe908a7a57b5092686997aa7eb31e830a78ab1189ed54c50305cfbfa99c2`. Preceding local `33a4b04ff96c411b7b060e5ecc4f808d86a8c03b` matches published `5814e04dd0ef99fce59cf42418cc00e6acb8ee3f`, tree `590cdc5c80cbc7b679984ee283b1b21ed3f13402`; CI 101 passed. This increment needs its own publication/CI. Remaining attachment size/type breadth stays in scope. Phase 24 remains active; no live mail or production mutation.

`COMMUNICATION_ATTACHMENT_SCANNING.md` records the official ClamAV protocol references checked 2026-09-11, runtime prerequisites and exact limits. No scanner fixture is presented as real malware detection or a safety guarantee.

## Phase 24 continuation — public IPv6 mail transport (2026-09-11T09:21:56.164249+00:00)

SMTP authentication/submission on 465 and mandatory STARTTLS 587 plus read-only IMAP 993 now support pinned public IPv6 as well as IPv4. Every DNS answer must match its declared family and ordinary public allocation; mixed private/public answers, reserved, documentation, transition, scoped and unallocated addresses fail before credentials. The connected peer must numerically equal the selected address, including after STARTTLS, without a second DNS lookup or family fallback. Actual isolated IPv6 TCP/TLS fixtures verify authentication, approved SMTP DATA and read-only IMAP with expanded equivalent addresses; changed peers fail before AUTH. IANA allocation and special-purpose registries were checked on 2026-09-11. Full regression passes; legitimate provider routing, non-PLAIN authentication and delivery reconciliation remain unproven or open as recorded.

Full `npm test` exited 0; 250 source hashes and 21 configuration contracts are retained in COMPOSABLE_TEST_EVIDENCE.json. Log `.recovery-evidence/20260911-communication-ipv6-regression.log`, SHA-256 `c78fa67df39256028642dc8f456bd7adebaaf8007144a9ba22a34aa1eba7dc15`. Frozen files unchanged. This is local fixture evidence, not browser/provider/production acceptance. Phase 24 remains active.

Primary address sources: [IANA IPv6 allocations](https://www.iana.org/assignments/ipv6-unicast-address-assignments) and [IANA special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry), retrieved 2026-09-11.

## Phase 24 continuation — explicit XOAUTH2 mail authentication (2026-09-11T09:33:21.634592+00:00)

Explicit XOAUTH2 now complements legacy PLAIN for SMTP 465/mandatory STARTTLS 587 and read-only IMAP 993. Separate bounded bearer-token and canonical UTC-expiry fields flow through existing encrypted tenant configuration and native connector setup; legacy default configuration fingerprints remain unchanged. Tokens never substitute for passwords or fall back after rejection. SMTP and IMAP error challenges receive only an empty acknowledgement, repeated challenges and false success are refused, and current token expiry/authority/configuration is checked before and across transport boundaries. Passive authentication/mailbox status cannot preserve trustworthy current proof after expiration. Actual isolated IPv6 TLS/STARTTLS exchanges cover bearer bytes, approved DATA, IMAP initial/continuation modes, failures and expiry; real HTTP sessions cover masked fields, encrypted restart and token rotation during pending authentication/receipt. Full regression passes. No legitimate provider credentials were changed or live account accessed; provider onboarding/automatic refresh, delivery reconciliation and browser acceptance remain open.

Full `npm test` exited 0; 253 source hashes and 21 configuration contracts are retained in COMPOSABLE_TEST_EVIDENCE.json. Log `.recovery-evidence/20260911-communication-xoauth2-regression.log`, SHA-256 `40ac0d0e4be092cd432bee212a9b2aa28db558b85bb29ac75223430922d07a38`. Frozen files unchanged. Phase 24 remains active. Protocol and configuration details, primary references and remaining provider/refresh limits are in COMMUNICATION_MAIL_AUTHENTICATION.md.
