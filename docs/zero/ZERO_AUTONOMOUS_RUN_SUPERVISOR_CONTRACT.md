# FOUNDLY OS — ZERO Autonomous Master-Run Supervisor, Codex/Work Orchestration & Session Continuity

**Founder directive:** 2026-10-09  
**Requirement classification:** HARD P0 CONTROL-PLANE CONTRACT; not accepted, not implemented by this documentation change.  
**Applies to:** ALL founder priorities (P0-A Founder Private Agency, P0-B independently sellable enterprise products, P0-C remaining personal modules), all seven FROZEN master runs (Run 1 accepted/frozen; Run 2 active; Runs 3–7 governed by existing dependencies), all demos, ZERO quality/voice/social acceptance, local-first, enterprise security and zero-downtime goals.  
**Build owner:** Codex. Docs-only contribution; no code, deployed infrastructure, active ChatGPT Work automation or agent service created.

## 1. Non-negotiable founder intent

ZERO must continuously **inspect, monitor, control, correct, orchestrate and evidence-close** the complete Foundly OS run program against every approved specification, current strongest applicable competitive benchmark and hard acceptance gate. It must minimize manual "ga verder", lost conversations, repeated context, preventable stalls and unobserved failures.

ZERO must, where officially supported and authorized, automatically assign bounded development work to **Codex**, trigger approved **ChatGPT Work / Workspace Agent** workflows, and create/resume its own **agent conversational sessions**. When an assistant task, context window, individual worker, device, provider or chat session ends, work continues through persisted canonical state — not by hoping the same UI conversation remains open forever.

**Mandatory clarification:** Not all user-facing ChatGPT Chat / Work conversations can be programmatically opened, managed or controlled by a third-party application using a documented public API. Do NOT promise unsupported consumer-UI chat creation, covert browser automation, approval bypass or unlimited model consumption. Treat such exact UI integration as `BLOCKED_EXTERNAL_CAPABILITY` until an official available interface is verified. Use supported agent sessions, Codex APIs/SDK and authorized ChatGPT Workspace Agent triggers as production-grade execution paths instead.

## 2. Always-on ZERO Run Supervisor — authoritative truth and durable state

- Runs 24/7 as monitored, durable, restart-safe services **independently of one user chat, one Codex session and the founder's PC**. The Ryzen 9 9950X3D2/RTX 5090/128 GB/6 TB machine is the prioritized local worker, with an independent production control plane and durable data/queue for PC/network/power outage.
- On each (re)start recover LIVE source truth from `Foundlys/v36`: actual branches, remotes, PR heads, commits, worktrees, changed/staged/untracked files, stashes where locally accessible, unpublished commits, run artifacts, migrations, CI/test outcomes, source-provenance and observed deployment/runtime state. Never infer a "completed" status from stale assistant prose or test counts.
- Maintain one versioned source-of-truth ledger per requirement and run: `requirement_id, contract_revision, priority, owner, code_path, active_branch, PR, immutable_commit_sha/tree_sha, dependency, status, proof_artifact, real_runtime_validation, benchmark_result, remaining_work, next_task, blocker_reason, approvals, cost, elapsed_time, last_observed_at`. Store durable provenance and evidence hashes. Sync appropriate summary references to GitHub (without leaking credentials).
- Continue from the **latest verified checkpoint**; preserve existing accepted scope and historical branches/PRs, never restart Run 1 or silently retarget/rebuild Run 2. Changes to authoritative requirements need explicit governed versioning.
- Run statuses MUST distinguish `NOT_STARTED`, `ACTIVE`, `CODE_CONTROLLED_FAIL`, `ENVIRONMENT_UNVERIFIED`, `EXTERNAL_BLOCKED`, `AWAITING_APPROVAL`, `RATE_LIMITED`, `BUDGET_BLOCKED`, `NEEDS_INDEPENDENT_REVIEW`, `PASS` and `ACCEPTED`; "auto-close" only after proof for every applicable blocking requirement.

## 3. Planning, control and assignment cycle

**OBSERVE → RECONCILE → DIFFERENCE ANALYSIS → PRIORITIZE → SELECT DEPENDENCY-SAFE WORK → ALLOCATE TOOL / AGENT / BUDGET → EXECUTE → COLLECT IMMUTABLE EVIDENCE → VERIFY → CORRECT OR ESCALATE → ACCEPT ONLY IF ALL GATES PASS → CONTINUE.**

- Monitor GitHub events, check statuses/CI, pull requests, approved run ledgers, error telemetry, regressions, security, real model/voice/device evaluations, client integration, queue pressure and deployment health.
- Automatically generate small, testable Codex assignments that cite concrete existing contract rows, project files, permitted directories, latest relevant SHA, non-regression invariants, required tests, spend/time ceiling, completion evidence and stop/rollback rules.
- Prioritize **P0-A Founder Agency/Single Control Panel** while safely running **P0-B commercial line** in parallel. Do not silently move the whole roadmap, dilute obligations, skip demos or invent Run 8.
- For failures, inspect evidence, reproduce, identify a narrow repair, route to Codex, verify negative cases, run affected suites, complete regression and representative runtime acceptance, and publish the true result. Repeat with a configured bounded repair budget; escalate persistent or externally blocked failures without false success.
- For best-in-class quality, compare every applicable specification against an actually relevant current competitor; publish both score and test method. A superior marketing claim requires independent evidence. A green CI run does not close an untested browser, provider, video, voice, speed, social/empathy, risk or commercial gate.
- When all blocking gates for a run pass, generate an immutable acceptance package with audit/provenance. Automated status transition may occur only under approved policy; risk-sensitive merges/deploys and irreversible acceptance decisions require the configured human reviewer.
- Accepted run completion should trigger planning for the next authorized run/dependent phase, never an unsafe reset or uncontrolled code change.

## 4. Codex — officially supported automation

- Preferred execution choices, subject to available credentials/entitlements: **Codex SDK** for start/resume/stream; **Codex app-server** for durable process and approval handoff; `codex exec` for bounded jobs and CI repair; **Codex Goals** where available for evidence-based iterative continuation; alternatively supported OpenAI Agents API sessions and self-hosted execution.
- Create a fresh bounded worker/thread only after saving the current checkpoint and selecting a specific scope; resume prior thread when safe. Own worktree/branch or no-overlap policy per worker, optimistic concurrency on SHAs, explicit merge queue, CI verification and rollback.
- Prevent unbounded "agent loops": watchdogs, heartbeats, cancellation, per-task credit/time ceilings, retry caps, quarantine on repeat failure, duplicate-event idempotency, external-provider outage fallback, and post-run reconciliation.
- Never bypass authentication, sandboxes, repository protections, protected deploy policies, service provider terms or approval controls to achieve speed or continuity.
- Historical rate/credit estimates are unmeasured hypotheses. Collect real Codex/API costs and useful-work quality before fixing budgets.

## 5. Work and Chat — supported surfaces versus unsupported UI promises

### 5a. ChatGPT Work / Workspace Agents
- When a ChatGPT Workspace Agent is configured, shared and API-trigger-enabled, ZERO may trigger that **approved Workspace Agent** from the persistent backend with a valid scoped access token, stable event ID, optional `conversation_key`, retries under the same `Idempotency-Key` and configured output destination. Confirm the result by inspecting the destination, not by treating HTTP 202 as work completion.
- ChatGPT Work also supports user-configured scheduled/event-based tasks. Integrate those when available under actual workspace permissions and approvals.
- **These mechanisms are NOT a general API for silently opening and controlling arbitrary consumer Work UI chats**. Do not conflate Work, Workspace Agents, the ChatGPT consumer interface and Codex.
- If Workspace Agents/API channels/workspace permission are unavailable, record `BLOCKED_EXTERNAL_CAPABILITY`; delegate equivalent authorized research/analysis to ZERO's own Agents API workflow instead, without misreporting that ChatGPT Work ran.

### 5b. Chat / context rollover
- ZERO's own chats must use durable session IDs and a canonical compact handoff manifest, rather than rely on the limited context of one ChatGPT conversation.
- A new supported **OpenAI Agents API** session may be created and populated with the verified handoff and referenced artifacts; a previous agent session can be resumed if supported. ChatGPT consumer UI "New chat" creation is separate and must NOT be assumed automatable without verified official capability.
- Handoff contract: `objective; approved contract version; priority; repo+branch+immutable SHA; uncommitted/stash state (only when measured); completed gates and evidence; outstanding failures and blockers; available credentials/capabilities (never secret contents); next action; approvals; cost/timing; pending external effects; idempotency key; prior session/thread reference`.
- Save handoff before context truncation, worker shutoff, provider switches and requested new thread. Verify reconciliation **after** resume; provide a human-readable continuity view without asking founder to retype the entire plan.
- Preserve important distinctions: observed vs inferred, accepted vs passing test, obsolete vs current, fake/demo vs live, credit exhausted vs objective complete, and task attempt vs externally confirmed effect.

## 6. Autonomy and escalation boundaries

- The founder may opt into a governed **AUTO-RUN** mode with explicit project/repository/service scopes, role grants and renewable rate/spend limits; this authorization is not a blanket waiver of banking, advertising, money, external messages, destructive data, privileged credential handling or production deploy approvals.
- ZERO may auto-execute/read/test/plan within these policies and propose repairs/PRs. High-risk changes, irreversible actions, permission expansions, migrations and production deploys remain gated by existing founder/company approval matrices.
- Loss of authorization, missing credentials/provider access, hard budget limit, exhausted quota, ambiguous requirement, real security risk and absence of independent acceptance evidence stop affected actions safely. Maintain safe unrelated work and alert with an exact blocker.
- No claim of "endless" running through exhausted credits, API limits or an unavailable external provider. **Continuity means no loss of accepted source state and automatic resumption when eligible**, not unlimited free or unsupervised compute.
- Parallel workers must not cross enterprise tenant, department or per-user authorization boundaries. ZERO does not receive blanket read access to all tenant secrets and customer data.

## 7. Founder Control Panel — transparent automatic governance

Live, usable (not decorative) console with:
- Progress and gate statuses for P0-A/P0-B/P0-C and each frozen master run; actual PR, SHA, CI/regression, benchmark, demo/live-provider and deployment states.
- Which Codex/Workspace Agent/Agents API worker is running, queued, blocked, retrying, waiting approval or completed with outcome evidence.
- Current next action, blockers, dependencies, last real checkpoint, predicted remaining time **based on observed throughput**, usage and cost per workstream/provider, reserve thresholds and rate limiting.
- Visible pause/resume, authorized reprioritization, spend cap, worker control, reviewed change requests and immutable evidence links.
- A short proactive report on meaningful incidents, milestones and blockers, not a claim of persistent work when none is running.

## 8. Mandatory acceptance matrix (ALL initially UNVERIFIED)

| ID | Required live/replayable evidence | State |
|---|---|---|
| RA-001 | Service runs 24/7 independent of ChatGPT/Work/Codex conversational windows and founder workstation, with observable heartbeat, durable queue and hosted fallback. | UNVERIFIED |
| RA-002 | Fresh boot reconstructs exact repo/branches/PRs/local state (where accessible), canonical run/acceptance evidence and current deployment, without conflating past snapshots and actual state. | UNVERIFIED |
| RA-003 | Each task generated from correct frozen Run/P0 contract, with exact requirement IDs, source commit, dependencies, priority, permitted actions, proof criteria and credit/time limit. | UNVERIFIED |
| RA-004 | Codex official supported SDK/app-server/CLI/Agents mechanism automatically starts, resumes, stops and records bounded coding sessions; produces safe branch/PR, targeted tests, full CI and independent evidence. | UNVERIFIED |
| RA-005 | Actual configured ChatGPT Workspace Agent API trigger or configured Work event/schedule completes an authorized workflow with verified destination and scoped audit. Unsupported direct UI control accurately labelled blocked. | UNVERIFIED |
| RA-006 | Automatic ZERO agent session/thread rollover preserves all critical context, commits, permissions, blockers and next actions; repeated rollover/restart does not lose accepted work or duplicate side effects. Consumer ChatGPT UI automatic chat opening must be separately validated if claimed. | UNVERIFIED |
| RA-007 | Synthetic injected failed CI, deployment/release halt, stalled worker, model outage, rate limit, credit exhaustion and provider refusal produce bounded repair/retry/escalation with no false PASS. | UNVERIFIED |
| RA-008 | Benchmark engine compares actual current specialist references by feature and applies all hard quality gates, including voice, social/empathy, live integrations, zero-downtime, native devices, security and enterprise authorization. | UNVERIFIED |
| RA-009 | Automatic run closure requires 100% of applicable mandatory gates with immutable evidence and approvals; missing live/external proof remains UNVERIFIED/BLOCKED, even when code/CI passes. | UNVERIFIED |
| RA-010 | Following accepted Run n, supervisor begins only authorized Run n+1 scope, preserving accepted history; no automatic Run 8 or redoing Run 1. | UNVERIFIED |
| RA-011 | Run Control Panel displays verified progress, workers, budgets, credits, blockers and immutable evidence accurately to founder on supported desktop/mobile and survives restart. | UNVERIFIED |
| RA-012 | Adversarial security/authorization/parallel concurrency and stop/resume/rollback tests prove no self-elevation, unapproved deployment, cross-tenant leaks, secret leakage, inflated completion status or infinite high-cost loops. | UNVERIFIED |

## 9. Dependency / handoff into existing master runs

- **Immediate P0-A/Run 2**: minimally useful read-only run-status/evidence checker + durable ledger/handoff and safe Codex task proposal. Does **not** imply full Run 4 accepted.
- **Run 3**: production-grade durable data, disaster recovery and cross-node consistency to support 24/7 control-plane persistence.
- **Run 4**: complete governed autonomous self-implementation, orchestrated coding workers, controlled release operations, convergence to full control panel.
- **Run 6**: full platform red-team/performance/reliability acceptance.
- **Run 7**: real customer/data, real provider, independent end-to-end acceptance.
- Product-specific blocking gates remain authoritative; never narrow previous Zero hard quality, voice, 7 commercial products or founder visual contract.

## 10. Official vendor interfaces validated in October 2026

- OpenAI Codex platform supports `codex exec`, Codex SDK and Codex app-server for application orchestration: https://developers.openai.com/blog/codex-as-a-platform
- Codex Goals describe persistence/continuation across turns subject to approvals, budget and real proof: https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex
- OpenAI Agents API supports asynchronous start and resume of agent sessions: https://developers.openai.com/api/docs/guides/agents-api/sessions
- Workspace Agent saved workflows can be externally triggered, if feature enabled, via scoped token/API channel, and verified in destination (not equivalent to opening arbitrary Work UI chat): https://developers.openai.com/cookbook/examples/chatgpt/workspace_agents/workspace-agents-api-trigger
- ChatGPT Work has scheduled and event-based task features under access controls: https://help.openai.com/en/articles/20001275

**Codex next action:** Recover true current state and compare this new binding contract with `docs/run2/AUTHORITATIVE_CONTRACT.md`, Run-2 acceptance matrix, P0-A/P0-B, existing orchestration, automation and the pending ZERO/Enterprise documentation PRs (#24/#22). Reconcile `RA-001..RA-012` without weakening, replacing or marking existing gates PASS. Produce a measurable run-control implementation plan, scope-specific cost telemetry and blocked capability proofs. **Do not claim that this document starts autonomous Codex, Work or Chat processes.**
