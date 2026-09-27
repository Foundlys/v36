# CONTINUE THE EXISTING FOUNDLY OS RUN 2 — NEW CHAT, SAME AUTHORITATIVE RUN

This is a NEW CHAT only because the previous Work session became unreliable/stuck.

THIS IS NOT A NEW RUN.

Continue the SAME authoritative execution:

RUN 2 — ZERO COGNITIVE, AGENTIC & GLOBAL INTELLIGENCE MASTERBUILD

DO NOT restart Run 2.
DO NOT restart from Phase 0.
DO NOT rebuild Run 1.
DO NOT broadly reorient the repository.
DO NOT repeat already completed work.
DO NOT discard unpublished/local work.
DO NOT use the previous chat's last visible response as repository truth.

The goal is to recover the REAL current execution state, preserve every valid published and unpublished change, continue from the exact first unfinished requirement, and autonomously finish Run 2 to the full agreed Foundly quality and acceptance contract.

Repository / PR / CI / test truth overrides stale chat prose.

================================================================
1 — CANONICAL ENVIRONMENT
================================================================

Canonical repository:

Foundlys/v36

Current authoritative Run-2 PR:

PR #21

Before making ANY implementation change, inspect and reconcile the actual live state:

- current repository/worktree;
- current branch;
- local HEAD;
- origin/main;
- relevant remote Run-2 branch;
- PR #21 actual HEAD;
- staged changes;
- modified tracked files;
- relevant untracked files;
- stashes;
- unpublished local commits;
- pushed commits;
- latest CI runs;
- targeted test results;
- full regression status;
- ZERO evaluation results;
- corpus/evaluation results;
- evidence/checkpoint files;
- migrations/config changes made during Run 2;
- runtime/deployment changes, if any.

PRESERVE unpublished work before any reset, checkout, clean, merge, rebase, restore or other destructive action.

No destructive reset.
No force push.
No discarding newer valid work.
No credential mutation.
No fabricated provider/runtime evidence.
No production mutation unless explicitly allowed by the Run-2 contract.

If repository truth is newer than any checkpoint described below:

PRESERVE THE NEWER STATE AND CONTINUE FROM IT.

Do not roll back just to match this prompt.

================================================================
2 — LATEST KNOWN PUBLISHED BASELINE
================================================================

Latest known published checkpoint before the most recent unpublished/local hardening:

405e7d8

Validation at that checkpoint:

- 679 ZERO tests PASS
- 14 evaluation/corpus cases PASS
- CI 212 PASS

At that stage the pending/waiting-run recovery was already hardened substantially.

Confirmed behavior included:

- resubmitting/retrying a request no longer resumes a waiting step;
- a durably retired/closed request remains closed;
- storage failure leaves no half-applied reservation;
- after server restart, a waiting run remains unchanged;
- after request retirement, a delayed ZERO request cannot start/resume/advance the run;
- recovery metadata contains no private content;
- permissions are revalidated;
- stale/late responses are ignored;
- 41 targeted recovery controls PASS.

Do NOT rebuild this already completed hardening unless an actual current regression proves it is broken.

================================================================
3 — MOST RECENT LOCAL WORK — CRITICAL CONTINUATION POINT
================================================================

AFTER checkpoint 405e7d8, another REAL regression was discovered:

OLDER / LEGACY ZERO INVOCATION AND RETRY PATHS COULD STILL RESUME A WAITING RUN WHEN THE REQUEST WAS REPEATED.

That additional defect has ALREADY been:

- reproduced;
- fixed;
- covered by permanent regression tests.

Most recent known local state:

- 21 new permanent targeted tests PASS;
- the fix was saved as a local checkpoint;
- the source tree was intentionally frozen;
- the FULL ZERO SUITE WAS RUNNING ON THAT EXACT FROZEN TREE when the previous session became unreliable/stuck.

THIS IS THE FIRST STATE YOU MUST RECOVER.

Do NOT assume the full suite failed.
Do NOT assume it finished.
Do NOT immediately rerun everything.

First inspect whether the existing run has a final result.

If it completed:
- record the actual result;
- do not duplicate the full run unnecessarily.

If it was interrupted without a final result:
- resume/redo only the unfinished validation needed for that exact frozen tree.

Do not change the source tree until the evidence state of that checkpoint is understood.

================================================================
4 — REQUIRED WAITING-RUN BEHAVIOR
================================================================

ALL ZERO execution/invocation paths — modern and legacy — must obey the same contract.

A retry, replay, resubmission, reload or recovery request MUST NOT resume or advance a waiting run merely because the client repeated the request.

Required semantics:

1. If the exact request already has an authoritative durable result:
   - return/read that exact result.

2. If the request is legitimately waiting:
   - read the waiting state;
   - do not execute it;
   - do not resume it;
   - do not advance it.

3. If the request was never executed and recovery should abandon it:
   - durably retire/close that exact request identity.

4. After retirement:
   - delayed copies of the original request must be rejected;
   - they must NEVER start, resume, advance or mutate the run.

5. Enforce exact:
   - request identity;
   - run identity;
   - step identity;
   - authoritative state.

6. Reject:
   - forged steps;
   - mismatched runs;
   - mutated confirmation payloads;
   - contradictory success responses.

7. Revalidate current:
   - tenant;
   - user;
   - role;
   - module;
   - capability;
   - approval;
   - access rights.

8. Storage failure must not leave partial recovery state.

9. Late/stale responses must not mutate a newer UI/view/request state.

================================================================
5 — COMPLETE THE CURRENT CHECKPOINT FIRST
================================================================

For the 21-test legacy waiting-run fix:

Verify, where applicable:

- legacy ZERO invocation retry;
- modern ZERO invocation retry;
- repeated request;
- waiting state remains waiting;
- exact prior-result replay;
- request retirement;
- delayed original request after retirement;
- lost HTTP response;
- reload/recovery;
- encrypted server restart;
- storage failure;
- access revocation;
- role changes;
- exact run/request/step binding;
- no duplicate document creation;
- no duplicate workflow execution;
- no duplicate event/action creation;
- stale/late result rejection.

Then run the required:

- targeted tests;
- relevant native tests;
- real HTTP tests;
- workflow regressions;
- ZERO suite;
- all 14 corpus/evaluation cases;
- broader/full regression where required.

Do not weaken assertions to get green tests.

If a fixture is actually defective, fix the fixture while preserving the intended behavioral assertion.

================================================================
6 — PUBLISH THE EXACT TESTED TREE
================================================================

When the current local fix is genuinely validated:

1. identify the exact tested tree;
2. checkpoint/commit exactly that tree;
3. publish it to the SAME PR #21;
4. verify local tree == PR tree;
5. run/inspect CI on exactly that commit;
6. keep failed CI runs honestly in the evidence trail;
7. do not mix later edits into the tested checkpoint.

A test result only proves the tree that was actually tested.

================================================================
7 — NEXT KNOWN OPEN CODE GAPS
================================================================

Once the legacy waiting-run recovery is closed, continue DIRECTLY with the already-known remaining workflow-action gaps:

A. MANUAL EXECUTION CONTROLS

B. SHARED APPROVAL CONTROLS

C. APPROVAL CONFIRMATION / RECOVERY

D. ACTIVATION CONFIRMATION / RECOVERY

E. any remaining EXECUTE / APPROVE / ACTIVATE recovery paths

These must receive the SAME mature guarantees already established elsewhere:

- exact request binding;
- idempotency;
- immutable confirmation payload where required;
- lost-response recovery;
- browser reload recovery;
- encrypted durable acknowledgment;
- restart recovery;
- no duplicate mutation;
- no changed payload after uncertain response;
- exact native confirmation required;
- no stale success;
- current permission revalidation;
- role/access changes respected;
- abandoned screens cannot execute later actions;
- stale/late responses blocked;
- storage failure rolls back safely;
- never-executed requests can be durably retired;
- retired requests can never execute later.

Use permanent targeted tests.

Use real HTTP/storage/restart tests where meaningful.

================================================================
8 — RUN 2 MUST NOT STOP AFTER THESE WORKFLOW FIXES
================================================================

These workflow fixes are only the current continuation point.

After them, continue autonomously through ALL remaining open requirements of the authoritative Run-2 contract.

Do NOT stop simply because the current Phase-8 screens are green.

Do NOT ask for routine confirmation.

================================================================
9 — AUTHORITATIVE RUN-2 OBJECTIVE
================================================================

Run 2 must transform ZERO into the production-grade cognitive, agentic and global operating intelligence of Foundly OS.

Scope includes:

- natural conversation;
- intent resolution;
- ambiguity handling;
- long-context behavior;
- personalization;
- social intelligence;
- contextual professional humor;
- multilingual reasoning;
- multi-step planning;
- causal/business reasoning;
- uncertainty;
- contradiction detection;
- proactive insights;
- outcome recommendations;
- layered memory;
- context assembly;
- model routing;
- degradation/fallback;
- specialist agents/subagents;
- permission-aware capability discovery;
- deep cross-module reasoning;
- governed research;
- knowledge/regulation refresh;
- Stack Discovery V1;
- global localization;
- hyper-realistic ZERO voice;
- Demo Universe Engine V1;
- Automotive Demo Universe V1;
- Automotive Industry Data & Knowledge foundation;
- permanent ZERO evaluation;
- universal search;
- attention intelligence;
- data quality;
- AI/runtime economics;
- security;
- privacy;
- performance;
- accessibility;
- responsive behavior;
- final regression;
- CI;
- deployment/runtime verification where permitted;
- final evidence matrix and verdict.

================================================================
10 — RUN-2 PHASES
================================================================

Preserve the authoritative phase model:

0. state recovery / baseline
1. competitive discovery
2. ZERO evaluation baseline
3. memory / context assembly
4. model routing / orchestration
5. cognitive / social ZERO
6. governed research / knowledge refresh
7. Stack Discovery V1
8. full localization
9. hyper-realistic voice
10. Demo Universe Engine V1
11. Automotive Demo + knowledge
12. complex cross-module acceptance
13. UX / accessibility / responsive acceptance
14. adversarial / security / performance / cost acceptance
15. full regression / CI
16. release / deployment verification where permitted
17. final evidence / verdict

DO NOT restart phases already proven complete.

Inspect evidence and continue with the first actually open requirement.

================================================================
11 — PHASE 8 GLOBAL LOCALIZATION LAW
================================================================

If any Phase-8 localization work remains, it must be fully closed.

Required locales:

- nl-NL
- en-GB / core English
- de-DE
- fr-FR
- es-ES
- da-DK
- nb-NO
- sv-SE

Foundly-owned UI must localize.

Customer-entered content must remain literal.

Provider/source/customer names must remain literal where appropriate.

Internal identifiers and machine IDs must remain stable.

Locale switching must preserve:

- current object;
- current tab;
- current workflow step;
- search text;
- unsaved user input;
- forms;
- selected state;
- valid source/customer data.

Locale switching must NOT:

- unnecessarily refetch;
- trigger actions;
- clear valid state;
- restore stale data;
- mutate business state;
- change unknown into zero;
- change missing into empty success;
- reinterpret customer content.

Do not close localization merely because a string-count scan is low.

Prove actual user-facing behavior.

================================================================
12 — HYPER-PERFECT QUALITY LAW
================================================================

WORKING != COMPLETE.

PASS requires evidence across:

- capability depth;
- intelligence;
- correctness;
- UX;
- visual quality;
- psychological usability;
- accessibility;
- performance;
- reliability;
- security;
- privacy;
- permissions;
- auditability;
- interoperability;
- composability;
- maintainability;
- localization;
- recoverability;
- scalability;
- operability;
- economics;
- data quality;
- outcome evidence.

Never fabricate:

- LIVE
- CONNECTED
- READY
- REALTIME
- SYNCED
- VERIFIED
- ACCEPTED
- PRODUCTION READY

Unknown != zero.

Missing != empty success.

Configured != connected.

Credentials != provider success.

Stored records != proof of current sync.

Fetched provider data != Customer Truth.

================================================================
13 — CUSTOMER TRUTH / PROVIDER TRUTH
================================================================

Customer-owned operational reality is authoritative for customer-owned objects unless a governed mapping explicitly says otherwise.

External/provider data may:

- enrich;
- validate;
- supplement;
- classify;

but must NEVER silently overwrite Customer Truth.

Maintain clear provenance where applicable:

- PROVEN
- CUSTOMER_CONFIRMED
- INFERRED
- UNKNOWN
- BLOCKED

Demo provenance must remain distinguishable:

- LIVE_PROVIDER
- PUBLIC_VERIFIED
- DERIVED_ESTIMATED
- SYNTHETIC_DEMO

Never present estimated or synthetic data as live truth.

================================================================
14 — ZERO-TRUST AUTONOMY
================================================================

ZERO, agents and workflows may NEVER:

- self-escalate;
- bypass tenant isolation;
- bypass entitlements;
- bypass module access;
- bypass capability checks;
- bypass approvals;
- reuse stale authorization;
- fabricate provider success;
- weaken security to complete a task;
- overwrite Customer Truth from provider data;
- mutate a waiting run merely because recovery/retry was requested.

Permissions/configuration must be revalidated around meaningful asynchronous boundaries, including:

- provider calls;
- DNS;
- storage waits;
- delayed responses;
- replay;
- restart;
- reload;
- long-running tool calls;
- workflow waits.

================================================================
15 — IDEMPOTENCY / RECOVERY / DURABILITY LAW
================================================================

For every relevant mutation:

- exact retry is safe;
- lost response is recoverable;
- duplicate mutation is prevented;
- newer state cannot be overwritten by an older retry;
- changed confirmation input cannot replace the original payload;
- deleted secrets cannot be resurrected;
- failed persistence cannot masquerade as success;
- partial writes must roll back where atomicity is required;
- restart recovery must return the authoritative durable state;
- corrupted storage must fail safely;
- non-executed request can be retired;
- retired request can never execute later;
- activity/event delivery must not be marked complete before durable acknowledgment where required.

================================================================
16 — STACK DISCOVERY V1 HARD GATE
================================================================

Do NOT declare Run 2 PASS unless Stack Discovery V1 satisfies the authoritative acceptance contract.

It must handle difficult heterogeneous environments and preserve:

- provenance;
- confidence;
- freshness;
- permissions;
- contradictions;
- current configuration;
- provider/tool identity;
- UNKNOWN/BLOCKED state;
- safe partial discovery;
- recovery.

No happy-path-only acceptance.

================================================================
17 — VOICE HARD GATE
================================================================

ZERO voice is first-class.

Where required, prove:

- male and female options;
- Executive mode;
- Conversational mode;
- Briefing mode;
- natural interaction;
- low latency where feasible;
- interruption/barge-in;
- context continuation;
- correct names;
- brands;
- industry terms;
- numbers;
- currencies;
- dates;
- non-robotic cadence.

English target:

refined British adult male, low/mid-low, calm, intelligent, cinematic, professional and naturally conversational with subtle dry humor.

Use Foundly's own legally usable voice identity.

No unauthorized voice cloning.

If external credentials/provider/runtime prevent final proof:

complete all code-testable work and classify the unresolved part honestly as BLOCKED_EXTERNAL.

Never fake voice evidence.

================================================================
18 — DEMO UNIVERSE / AUTOMOTIVE HARD GATES
================================================================

Run 2 requires:

- Demo Universe Engine V1;
- Automotive Demo Universe V1;
- Automotive Industry Data & Knowledge foundation.

The demo must prove coherent cross-module behavior, not just isolated UI screens.

Automotive provider/customer/demo provenance must remain truthful.

================================================================
19 — UX / ACCESSIBILITY / RESPONSIVE ACCEPTANCE
================================================================

Target at least WCAG 2.2 AA where applicable.

Prove relevant:

- keyboard use;
- focus behavior;
- accessible labels;
- responsive behavior;
- status clarity;
- error clarity;
- degraded-state clarity;
- reduced motion where applicable;
- locale-switch safety;
- no misleading success;
- preservation of user work.

================================================================
20 — SECURITY / PRIVACY HARD GATE
================================================================

Red-team the affected surfaces for:

- tenant escape;
- module/capability bypass;
- object-level authorization;
- stale authorization;
- encoded identifier bypass;
- alternate-route bypass;
- role changes;
- permission revocation mid-request;
- unauthorized linked-object disclosure;
- stale private-data restoration;
- unauthorized exports;
- replay attacks;
- request-identity collisions;
- mutated confirmation payloads;
- storage corruption;
- delayed request execution.

No in-scope security defect may be waived merely to finish the run.

================================================================
21 — PERFORMANCE / RELIABILITY / COST ACCEPTANCE
================================================================

Test relevant:

- large datasets;
- pagination;
- counts beyond page limits;
- concurrency;
- repeated requests;
- provider delay;
- provider outage;
- storage failure;
- lost response;
- restart;
- stale data;
- workflow waiting;
- event durability;
- model-routing economics;
- AI cost governance;
- graceful degradation;
- fallback behavior.

Do not weaken individual test timeouts or assertions just to make CI green.

================================================================
22 — APPROVED VISUAL BASELINE
================================================================

The approved main Foundly dashboard is a FROZEN visual baseline.

Do NOT:

- redesign it;
- restyle it;
- simplify it;
- reinterpret it.

Only make necessary changes for:

- correctness;
- security;
- localization;
- accessibility;
- compatibility;
- integration;
- performance;

while preserving the approved visual identity.

================================================================
23 — TESTING / EVIDENCE DISCIPLINE
================================================================

For each real defect:

1. reproduce it where practical;
2. create permanent regression coverage;
3. fix the underlying cause;
4. run targeted tests;
5. run affected native/API/UI tests;
6. run relevant ZERO/corpus tests;
7. run broader/full regression where required;
8. freeze the tested tree;
9. publish exactly that tree;
10. verify CI against that tree;
11. preserve failed and successful evidence honestly.

Do not claim evidence from a different tree.

Do not quietly discard failures.

================================================================
24 — AUTONOMOUS EXECUTION
================================================================

Continue autonomously.

Do NOT ask me for confirmation between normal phases.

Do NOT stop after every checkpoint.

Do NOT stop merely because Phase 8 becomes green.

When one requirement is genuinely closed:

move immediately to the next open Run-2 requirement.

If a true external dependency blocks something:

- classify it honestly;
- complete all internally testable work;
- continue other independent gates;
- preserve the blocker in the final evidence.

Do not downgrade a code defect into an external blocker.

================================================================
25 — FINAL RUN-2 ACCEPTANCE MATRIX
================================================================

Before completion, produce an evidence-backed matrix covering at minimum:

- ZERO cognition;
- memory/context;
- model routing;
- agents;
- research;
- knowledge refresh;
- Stack Discovery;
- localization;
- voice;
- Demo Universe;
- Automotive;
- cross-module intelligence;
- manual execution;
- approval;
- activation;
- permissions;
- tenant isolation;
- idempotency;
- lost-response recovery;
- browser reload recovery;
- restart recovery;
- stale-response protection;
- Customer Truth;
- provider/source truth;
- accessibility;
- responsive behavior;
- security;
- privacy;
- performance;
- reliability;
- cost governance;
- regression;
- CI;
- deployment/runtime evidence where permitted.

Every material item must be explicitly:

PASS

FAIL

BLOCKED_EXTERNAL

UNVERIFIED

No "mostly done".

================================================================
26 — FINAL VERDICT
================================================================

Run 2 may finish ONLY with exactly one of:

RUN 2 PASS

RUN 2 PARTIAL / NOT ACCEPTED

RUN 2 BLOCKED BY CODE DEFECT

RUN 2 CODE COMPLETE WITH EXTERNAL ACCEPTANCE BLOCKERS

Do not invent another verdict.

DO NOT proceed to Run 3 unless the authoritative Run-2 contract genuinely permits RUN 2 PASS.

================================================================
27 — EXECUTE NOW
================================================================

Start by recovering repository truth.

Do NOT restart the architecture work.

Do NOT restart completed phases.

Do NOT redo the hundreds of already-passing tests merely for orientation.

First determine the result/state of the frozen local checkpoint containing the:

21 NEW PERMANENT LEGACY WAITING-RUN REGRESSION TESTS.

Preserve that work.

Finish its evidence.

Publish the exact tested tree.

Then continue immediately through:

- manual execution controls;
- shared approval confirmation/recovery;
- activation confirmation/recovery;
- remaining Phase-8 surfaces;
- every still-open hard gate;
- final regression;
- CI;
- deployment/runtime verification where permitted;
- final evidence matrix;
- final verdict.

Continue until the SAME authoritative Run 2 is genuinely complete.

The objective is NOT to make Run 2 appear finished.

The objective is to make Foundly Run 2 genuinely HYPER-PERFECT, evidence-backed, production-grade and accepted according to the agreed Foundly OS contract.