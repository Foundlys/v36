# Run 2 implementation checkpoint

This checkpoint extends the existing encrypted Core and current-principal capability resolver. Run 2 remains **IN PROGRESS / NOT ACCEPTED**. The acceptance matrix records missing code separately from missing runtime evidence.

## Voice and cross-module checkpoint

An explicit question naming multiple supported modules now collects authorized native specialist evidence in one ZERO turn, verifies each snapshot before and after model inference, and returns source receipts without executing business actions. Unavailable modules are denied and unavailable models produce a partial result. This does not establish difficult Automotive reasoning quality.

Voice settings define eight locales, two presentation choices and three modes. Existing lawful provider voices are used; perceived gender, naturalness and pronunciation require listening acceptance. Language, voice and mode controls were added within the existing Audio/privacy panel without changing the approved dashboard layout. Browser speech fallback remains distinct from provider voice quality.

The actual Realtime handlers bind calls to a finalized input transcript and a stable audio-item turn identifier. Model-supplied arguments cannot substitute for the user's words. Duplicate call IDs for one utterance dispatch once, an uncertain transport result cannot trigger an automatic duplicate, and a new utterance cancels an unfinished earlier one. Exact approval phrases share the same client/server rules across all eight languages; the existing native confirmation-token checks still apply. Current identity and preference checks run after the asynchronous ephemeral-credential request.

Full local `npm test` passes, including 61 ZERO unit/HTTP tests and the 14-case foundation corpus. CI 147 passed the previous research/discovery checkpoint. No live microphone, listening or browser acceptance is claimed: the supported cloud browser rejected the local preview with `ERR_BLOCKED_BY_CLIENT`. Full UI translation, realistic cognitive evaluations, demo universes and other code-controlled gaps remain open in `ACCEPTANCE_MATRIX.md`.

## Localization implementation in progress

`foundly-locales.js`, `foundly-static-copy.js` and `foundly-i18n.js` introduce explicit eight-locale presentation catalogs. A personal `ui_locale` is stored separately from ZERO's `language`. Login, enrollment, related error handling and native navigation use the catalogs. A late preference response cannot overwrite a newer explicit language selection. The catalog reports a missing key instead of substituting English for an incomplete supported locale.

Static bindings update existing text nodes and accessibility attributes. They preserve nested form controls, canonical option values and the frozen main dashboard's inline CSS. If a native renderer replaces a placeholder with business data, the old static binding cannot translate or overwrite that replacement. No blanket matching or automatic translation of customer records is performed. Seventy reviewed dynamic main-dashboard call sites use explicit catalog keys; state telemetry follows event metadata rather than matching a translated label.

Native numeric/date formatters use the interface locale. Date-only CRM/Finance values retain their calendar date regardless of browser time zone. Missing Automotive/CRM/Analysis numeric data remains unavailable rather than becoming a zero. These checks validate formatting and state contracts, not regional accounting/tax correctness or live language quality.

The seven static surfaces now contain 698 catalog-bound text and accessibility entries: main dashboard 107, workspace 120, CRM 178, Analysis 97, Finance 71, Automotive 116 and login 9. Explicit brand names, acronyms, canonical identifier examples and keyboard shortcuts are listed as invariants. No unresolved static copy remains in this limited inventory. Pipeline creation now uses six localized default names and explicit canonical OPEN/WON/LOST status and probability fields. Renaming a stage cannot change its business status; WON uses 100% and LOST 0%. Add/remove bounds and validation apply before submission. An uncertain request retains its original payload and native idempotency keys for explicit same-page retries. Closing stops subsequent writes until an explicit resubmission, including close/reopen while a call is in flight. This is not an atomic multi-record transaction or durable browser-reload recovery. Generated business-profile defaults remain separate code work. The historical seven-surface structural check is retained; the intentional CRM form/CSS extension is recorded separately. Frozen main inline CSS remains byte-identical to Run 1; browser and visual acceptance remain unverified.

Static and conservative dynamic inventories are recorded in `localization-inventory.json` and `localization-dynamic-inventory.json`. The authoring scripts are separate from the runtime; the dynamic audit uses the local Acorn parser and does not execute scanned application code. It now resolves DOM helper parameters through lexical scopes, including nested form wrappers, and rejects shadowed or reassigned helpers. The expanded audit identifies 1,006 remaining expression candidates across 46 loaded scripts; the larger count reflects improved detection, not newly introduced untranslated copy. Conditionals, HTML templates, configuration labels, server errors, generated content, safe refresh of active dynamic views and remaining generated/default content need further work. Authenticated HTML now carries the current user’s validated locale before client controls are constructed. The response is not cached, and a bounded streaming transform preserves all unrelated UTF-8 bytes. Anonymous login still chooses from browser languages. All eight full-surface locale gates remain **FAIL / CODE_CONTROLLED**. Browser layout/assistive-technology acceptance and native-speaker review remain unverified.

Sign-in error and validation labels follow subsequent locale changes without another authentication request. ZERO's greeting uses the conversation language independently of the interface locale and keeps the user's name literal. Incremental HTML binding has a regression check for merging existing bindings without corrupting a tag or its adjacent controls.

The localization foundation passed full `npm test` with 69 ZERO tests and the 14-case corpus. CI 149 passed published commit `6cdefb660b7ba48138741a3390f83f67a0b64d96`, tree `17debd712763f0374a9a149a264673be87b97893`. The later seven-surface extension passes full local `npm test`, including 73 ZERO tests and the 14-case corpus; CI 150 passed its published tree `eb0c1fa1a5eedc37fc9b162cde748d47954ea641`. Exact source hashes, structural evidence and log hashes are recorded in `checkpoint-tests.json`. The internet connection was rechecked successfully; supported browser access to localhost still returns `ERR_BLOCKED_BY_CLIENT`.

Standalone CRM now packages and serves every script/style referenced by its HTML, including the shared locale catalogs and shell. Its navigation exposes CRM only after the native read check. Its existing configured actor has a private encrypted interface preference, validated independently of optional ZERO configuration. Tests cover missing-identity rejection, unsupported fields/locales, per-actor restart isolation, package dependencies and HTML language seeding. This service still has one configured actor per process; it does not introduce or claim a new multi-user identity system.

The startup/standalone extension passed 12 locale unit/HTTP tests, the existing static-response failure/recovery/cancellation regression and the expanded standalone CRM regression. CI 151 passed published head `f5718d43afe7d325264dfe7d568b2dc3bfd6f9a7`, tree `36faf22d7e97d5e43dacd27407e30f7453af43e0`. The subsequent pipeline extension passes 20 focused locale/authoring/controller tests and all native CRM regressions. CI 152 passed its published tree `2c1cd8ab04b083e2a88d37ce9d82a36c308cef41`.

Explicit dynamic message descriptors now bind catalog-owned text and accessibility attributes without matching ordinary strings or customer-shaped objects. Parameter snapshots stay private to the binding; native text replacements relinquish ownership. Labels update their text node so nested form inputs, values and handlers survive a language change. No screen reload or automatic business request is required.

The native Finance period-closing component uses these bindings for all visible local copy, known blockers, review state, receipts and guarded errors. Nested labels and dates reformat while customer names, record IDs, exact large cent totals, selected periods, reasons, confirmation and uncertain-request payloads remain intact. Unknown provider errors use a catalog error instead of raw backend text. The existing uncertain-result notice is no longer overwritten by the outer catch. Eight-locale handler tests, 85 ZERO unit/HTTP tests, the 14-case corpus and the native Finance close core/API/client regressions pass. Full CI for this extension is pending. This does not establish complete Finance module localization, statutory correctness, provider completeness or browser acceptance.

## Implemented and connected

- `zero/memory.js`: eight memory layers; explicit user provenance; private ownership; current role/capability filtering; effective dates, expiry, supersession, conflicts, revision checks and deletion of version-chain content. Atomic writes reuse `scoped-mutation.js`.
- `zero/context.js`: bounded question-driven lexical context assembly with source states, provenance, conflict flags and explicit unavailable/denied states. Semantic retrieval is not claimed.
- `zero/router.js`: versioned server-controlled registry; Responses, Chat and Anthropic transports; task/privacy eligibility; bounded fallback, timeout, cancellation and concurrency; persistent daily/flow request/token budgets; optional monetary budget requiring explicit model prices; usage/latency telemetry. Provider tests are contract evidence, not real account acceptance.
- ZERO's real conversation path uses assembled memory/context and rechecks current identity and source content after inference. Generated source answers are not preserved as reusable private facts in conversation/audit replay. Deleted memory cannot return through a cached answer.
- Personal preferences and client diagnostics use per-user storage. Legacy preferences migrate only for the bootstrap operator. Eight locale identifiers and male/female, Executive/Conversational/Briefing settings are validated. Voice quality and complete UI localization are not established by these settings.
- `zero/stack.js`: read-only current composition/permission observations and explicitly confirmed private customer declarations. Conflicting source-of-truth/schema facts require clarification. Expired credentials and unobserved schemas are reported honestly. It does not claim remote provider discovery where no authorized observations exist.

- `zero/agents.js` and `zero/native-agents.js`: bounded dependency-checked plans over eight registered native read specialists, current capability checks, separate server source re-reads, per-tenant concurrency, cancellation, context/tool/deadline limits, private source-free receipts, restart interruption and idempotent replay. Write actions remain in the existing typed native approval contracts. This is not proof of cognitive multi-agent quality.
- `zero/intent.js`: conservative natural-language mutation gate. Questions, hypotheticals, quotations and negations cannot trigger legacy write detection; implicit provider ingestion is removed from analysis requests. Real HTTP tests distinguish discussion from a requested task creation.

## API

All routes use the existing authentication, tenant context, origin checks and live identity. `/api/jarvis` remains an alias of `/api/zero`.

| Route | Method | Behavior |
| --- | --- | --- |
| `/api/zero/agents` | GET | Current registered native read specialists and limits |
| `/api/zero/plans` | GET / POST | Own plan receipts / create a bounded dependency plan |
| `/api/zero/plans/:id` | GET | Read own plan state; interrupted processes never silently rerun |
| `/api/zero/plans/:id/run` | POST | Read and independently verify current native evidence |
| `/api/zero/plans/:id/cancel` | POST | Cancel an owned pending or active plan |
| `/api/zero/memories` | GET / POST | Retrieve current authorized memory / explicitly record an assertion |
| `/api/zero/memories/:id` | DELETE | Revision-bound removal, including content in superseded versions |
| `/api/zero/models` | GET | Credential-free registry state and caller-scoped usage |
| `/api/zero/stack` | GET | Current evidence, unknowns, blocked facts and conflicts |
| `/api/zero/stack/evidence` | POST | Confirm a customer declaration with source and reason; connector-management permission required |

## Model configuration

Existing `FOUNDLY_AI_MODEL`, `FOUNDLY_AI_BASE_URL`, `FOUNDLY_AI_API_KEY` and `OPENAI_API_KEY` remain supported. `FOUNDLY_ZERO_MODEL_REGISTRY` optionally supplies a JSON array of model entries. Each entry specifies `id`, `provider`, `model`, HTTPS `base_url`, server-only `credential_env`, supported `protocols`, `tasks`, `privacy`, quality/priority, input/output limits and timeout. Entries can include input/output USD per million tokens. No live model price is guessed.

Budget controls: `FOUNDLY_ZERO_DAILY_REQUESTS`, `FOUNDLY_ZERO_DAILY_TOKENS`, `FOUNDLY_ZERO_WORKFLOW_REQUESTS`, `FOUNDLY_ZERO_CONCURRENCY`, `FOUNDLY_ZERO_MAX_MODEL_ATTEMPTS`, optional `FOUNDLY_ZERO_DAILY_USD`. Credentials are not returned or logged. Unknown provider usage keeps the conservative reservation charged. A configuration rollback uses the prior reviewed deployment configuration; provider availability remains separately unverified.

Provider schema references checked on 2026-09-24: [OpenAI Responses](https://developers.openai.com/api/reference/cli/resources/responses/methods/create), [Claude Messages](https://platform.claude.com/docs/en/build-with-claude/working-with-messages). The transport adapters isolate protocol shape from tenant policy and orchestration.

## Evidence and limits

`zero-evaluation/run.js` records real HTTP scenarios using isolated encrypted storage and real identity sessions. Its no-provider cases call no AI service. `zero/*.test.js` covers failure and policy contracts; the context API fixture deliberately copies a private string to test subsequent retention/deletion/revocation. It does not grade cognition. Existing provider fixtures include deterministic public DNS for their mocked OpenAI transport; production URL validation is unchanged.

The first corpus moved from 4/14 to 14/14 passing assertions. This is a narrow foundation checkpoint, **not Run 2 PASS**. The authoritative 125-row matrix remains open where broader evidence is missing. Broader specialist cognition/execution acceptance, governed research/activation, deeper heterogeneous discovery, universal search, complete localization, real voice, demo universes, Automotive knowledge, cognitive evaluation and full acceptance continue within this run.

The first full `npm test` exposed Calendar fixture DNS, repaired without changing production URL checks. Workflow’s local HTTP fixture now has an explicit test-only HTTPS transport adapter. The next full suite passed; later agent/intent changes passed their unit and real HTTP checks plus existing ZERO/Calendar/Workflow regressions. See `checkpoint-tests.json` for exact scope and log hashes. Full Run 2 acceptance remains open.

## Research, knowledge and heterogeneous discovery

- Current web research now runs through the same model/router request, token, concurrency, fallback and timeout policy. The server permits one built-in search call per provider response, rejects research without source evidence, and records tool usage separately. Configured monetary budgets require explicit search pricing as well as model prices. Provider-reported actual use remains distinguishable from conservative unknown-use reservations; provider billing may exceed a reservation, so this is not yet a verified hard spend ceiling.
- Search results are ephemeral external references. They are no longer automatically inserted into shared customer Data records. Retrieval dates are known; publication/effective dates and jurisdiction remain unknown unless reviewed. Citations are attribution, not verification of claims.
- `/api/zero/knowledge` and `/:id/transition` implement private reference quarantine, metadata/freshness evaluation, exact-content operator review, explicit activation, version supersession, retirement and rollback. Regulation references require authority, jurisdiction, primary-source classification and effective date. These are operator attestations, not automatic legal authority. Only active, effective, current references enter ZERO context; retirement/expiry/revocation is checked again after inference and on replay.
- `/api/zero/stack/discover` reads only server-configured OpenAPI JSON targets from `FOUNDLY_ZERO_DISCOVERY_TARGETS`. Each target has `id`, `module`, `schema_url`, optional server-only `credential_env` and `ttl_seconds`. HTTPS/public-network validation, redirect refusal, current module/connector rights, 512 KiB input cap, eight-second deadline, tenant concurrency and a durable daily request ceiling bound discovery. OpenAPI 3.x and Swagger 2.0 schemas, documented operations, security schemes and webhook names retain a document hash and source URL. This proves the observed document only. Runtime behavior, identities, remote schema references and source-of-truth remain unknown. Expired credentials, missing documentation, stale metadata and outages are explicit.

Provider references: [Responses tool-call ceiling](https://developers.openai.com/api/reference/cli/resources/responses/methods/create), [Web search sources](https://developers.openai.com/api/docs/guides/tools-web-search), checked 2026-09-24.

CI run 146 on the first draft commit found a Workflow-inspection regression introduced by the natural mutation gate. The gate now preserves the explicit read-only `INSPECT_RUN` path. The original failing HTTP test, workflow language/generator checks, 51 ZERO tests and a subsequent complete `npm test` passed locally. CI 147 passed the replacement research/discovery tree; the earlier failed run is not relabeled PASS.
