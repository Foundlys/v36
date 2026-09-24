# Run 2 implementation checkpoint

This checkpoint extends the existing encrypted Core and current-principal capability resolver. It does not replace Run 1, add PostgreSQL or claim a Run-3 Digital Twin.

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

CI run 146 on the first draft commit found a Workflow-inspection regression introduced by the natural mutation gate. The gate now preserves the explicit read-only `INSPECT_RUN` path. The original failing HTTP test, workflow language/generator checks, 51 ZERO tests and a subsequent complete `npm test` passed locally. CI on the replacement commit is still required; the failed run is not relabeled PASS.
