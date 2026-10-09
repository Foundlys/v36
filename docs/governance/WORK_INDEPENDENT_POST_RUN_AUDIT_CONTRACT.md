# FOUNDLY OS — INDEPENDENT CHATGPT WORK AUDIT AFTER EACH MASTER RUN

**Founder directive:** 2026-10-09  
**Contract class:** mandatory release governance / independent final audit  
**Status:** REQUIREMENT RECORDED — Work audit execution and workflow setup not yet proven  
**Repository:** `Foundlys/v36`  
**Scope:** Frozen Runs 1–7, with no new Run 8. Run 1 remains accepted/frozen unless a subsequent regression invalidates affected accepted evidence. The next relevant audit occurs when the active Run 2 is submitted as a candidate for completion.

## Absolute process ownership

- **CODEX BUILDS:** implementation, corrections, affected tests, full regression, production/browser/provider/voice/device evidence where required, and a complete immutable handoff dossier.
- **CHATGPT WORK AUDITS:** independent, adversarial post-run assessment against **ALL applicable founder-approved hard requirements**, quality rules, benchmarks, evidence criteria and prior accepted functionality. Work does not merely summarize Codex's own PASS claims.
- **FOUNDER APPROVES:** the human founder personally reviews Work's results after **each** master run and explicitly authorizes closure/transition to the next run. Work's PASS recommendation is **not** the founder's final approval.
- **NOT THE CANCELLED SUPERVISOR:** do **not** reactivate PR #26 / issue #27 or build an extra continuously running ZERO development supervisor, automated Codex/Work/chat self-orchestration, or automatic consumer UI chat creation. This requirement is a **bounded audit checkpoint after each run**; existing production ZERO and autonomous business capabilities remain in scope.

## Trigger and state transition

1. Codex completes candidate work **inside the current run**, with branch, PR, exact immutable code/tree SHAs, changes, deployment truth and full acceptance matrix.
2. Run status becomes `READY_FOR_INDEPENDENT_WORK_AUDIT` (NOT `PASS/ACCEPTED`). Create a read-only audit snapshot and package referenced source artifacts; freeze candidate SHAs.
3. **Work** audits that exact candidate via connected GitHub and available live systems, independently reproducing risk-weighted tests. It must validate the current authoritative roadmap and the *complete* set of hard requirements, including later founder amendments (enterprise access, ZERO intelligence/empathy/voice/speed, local-first, independent 24/7 and controlled zero-downtime).
4. Work returns evidence-linked row-by-row `PASS | FAIL | BLOCKED_EXTERNAL | UNVERIFIED | NOT_APPLICABLE_WITH_REASON`, along with severity and whether evidence is direct, independently reproduced or only Codex-reported.
5. `FAIL/BLOCKED/UNVERIFIED` on any mandatory applicable gate means **NOT ACCEPTED**. Return the findings to Codex for correction **in the same run**; after an updated candidate Work performs a fresh audit and regression spot checks. A live-provider, device, voice, benchmark or external access blocker may not be mislabeled PASS.
6. Only if every applicable mandatory gate passes on the exact candidate, Work can issue `INDEPENDENT AUDIT PASS — FOUNDER APPROVAL REQUIRED`.
7. Founder reviews and makes the final decision. Only explicit approval records `RUN N ACCEPTED`; then the next frozen run may start under the normal authorization process. Never auto-start Run 8.

**Important:** Work cannot yet be silently started from this ChatGPT conversation. The founder may invoke Work mode at each checkpoint; a native approved Workspace Agent trigger may be configured as a separate *audit-only* workflow if access permits. That does not imply a general ability to open/control arbitrary ChatGPT chats or resurrect the cancelled autonomous supervisor. Lack of Work permission/integration is a visible workflow blocker, not a bypass.

## Which Work model?

**Primary recommendation for the final deep audit:** **GPT-6 Astra**, using the highest sensible available reasoning effort, **if available in the user's Work model picker**. OpenAI describes Astra as its strongest model for complex coding/research/analysis/problem-solving.

**Preparation / large evidence inventory / targeted secondary pass:** **GPT-6.1 Sol** at an appropriate high effort setting if available, especially to balance detailed document/code reading with credits. This is not an automatic claim that Sol is inferior on every subtask.

**Fallback if Astra is inaccessible:** use the strongest model actually available in Work (prefer GPT-6.1 Sol high thinking where enabled), record precise model/version/effort, and state material capability limitations. Do not fabricate access to Astra.

**Model selection is dynamic:** use the best model/effort for the actual audit scope at the time; updated models may replace these preferences. Do not trade off evidence completeness against credits or select a weaker model solely to make a difficult run appear to pass.

Official model guidance (verified on 2026-10-09):
- https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex
- https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex

## Mandatory audit coverage

**WA-001 — Scope reconciliation:** identify current run contract, versions, changes and all hard acceptance matrix rows, including newer approved P0 founder/enterprise/ZERO decisions. Confirm nothing was silently removed. Record pre-existing accepted baselines and prior-run regressions.  
**WA-002 — Repository truth:** verify real branch/PR/HEAD/tree, changed/tracked/untracked/stashes where accessible, merge state and production version; identify any missing/unpublished work without pretending browser GitHub shows local worktrees.  
**WA-003 — Code and regressions:** independently review implementation, architecture, appropriate unit/integration/end-to-end tests, full CI and controlled reproducible regressions on the audited immutable SHAs.  
**WA-004 — Security and enterprise identity:** verify tenant/user/department/field/record entitlement boundaries, delegated administration, ZERO authority, SSO/MFA/SCIM if applicable, approvals, secrets, privacy/GDPR and adversarial negative tests.  
**WA-005 — ZERO cognition / social / voice:** independently evaluate contextual accuracy, memory, reasoning, action verification, empathy/social intelligence, emotional prosody, agreed legal voice directions (male/female, modes, eight languages), interruption and authentic provider/device proof where in scope.  
**WA-006 — UX, demos and devices:** verify approved 1:1 founder spatial/3D/4D visual baseline, real desktop/iOS/Android experience, accessibility, localization and downloadable/installation evidence where the run requires it.  
**WA-007 — Competition and quality:** verify current actual best competitor per relevant specification, benchmark method and independent comparable outputs, not model marketing claims or screenshots; maintain every preapproved quality bar.  
**WA-008 — Operations and reliability:** verify independent 24/7 critical production, local RTX 5090 workstation role, backups/DR, failover, queues, idempotency, controlled zero-customer-visible-downtime release tests where relevant, incidents and provider outages.  
**WA-009 — Real world effects:** verify live provider contracts, real data/source freshness, production readiness, multi-user load/performance p50/p95/p99, receipts and truthful separation of synthetic/demo outputs from real execution.  
**WA-010 — Time, credits and costs:** compare actual Codex/Work/model usage, cost, elapsed active work and waits to current forecasts; flag unmapped invoices/unknown prices; estimate remaining remediation effort without pretending guesses are measured facts.  
**WA-011 — Risk and defect register:** identify critical/high/medium/low defects, evidence gaps, security/privacy blockers, release/rollback risks; generate concrete narrowly scoped Codex remediation tickets for unfinished gates.  
**WA-012 — Final impartial verdict:** only after all applicable hard gates pass; otherwise `RUN N NOT ACCEPTED`; deliver signed-off review-ready independent final report, NOT automatic founder acceptance.

## Required Work deliverables

A complete independent output bundle per candidate:
1. **One-page executive verdict:** run/date, reviewed PR+SHA, actual production version, audited model and effort, PASS/NOT ACCEPTED, key evidence and severity-ranked critical issues.
2. **Full crosswalk** of each authoritative requirement ID to implementation artifact, test/live proof, observed result, reviewer notes and PASS/FAIL/BLOCKED/UNVERIFIED.
3. **Competitive benchmark report** per relevant specification, with comparable test conditions and dates.
4. **Security/privacy/authorization and performance findings**, including severe adverse-case evidence.
5. **Regression and release/deployment report**, including true source vs deployed version and known unsupported devices/provider gaps.
6. **Remediation dossier for Codex:** exact failing gate, reproduction, expected behavior, fix constraints, urgency and retest instructions.
7. **Founder decision page:** `WORK_RECOMMENDS_ACCEPT` or `WORK_REJECTS`, with explicit `FOUNDER_APPROVAL_PENDING`. No unsupported run closure.
8. **Immutable references** (GitHub PRs/SHAs, CI ids, test artifacts, audit timestamp, results and objective evidence). A file attachment or screenshot without verifiable content is not proof.

## No false claims or scope removal

- No hard requirement may disappear via a new summary, a shortened list, a skipped test, an arbitrary PASS percentage or an unmeasured model-quality claim.
- Work must not accept a demo as full production, a green CI as live-device/voice-provider proof, 99.9% uptime as the previously agreed zero-downtime release goal, or a local PC being left on as independent customer availability.
- Missing proof means UNVERIFIED; external restrictions mean BLOCKED with exact owner, dependency and possible workaround, and prevents overall acceptance if mandatory.
- Prior docs-only PR #22 (enterprise organization access) and PR #24 (ZERO full intelligence/social/voice/speed) need to be reconciled as applicable project requirements; neither is silently assumed merged or implemented.
- **Credit and schedule consequence:** Work audits consume actual Work credits and elapsed audit time. The existing 623k commercial / 873k combined software estimates already include broad QA assumptions, but no independent measured post-run Work audit cost. Track separately per run first; do not double-count or assert a fixed cost without telemetry.
- All Work findings are reviewed by the founder. **Codex remains sole developer; Work remains independent auditor**, unless the founder later explicitly changes this responsibility boundary.

## Status and implementation instruction

This docs-only change creates an explicit mandatory process, but **does not execute Work, enable event triggers, alter code, change release permissions or deploy anything**. Open a separate tracked issue for Codex to implement the Run->Work audit-ready handoff, artifact export and no-closure-before-founder-approval release gate using supported integration paths. Preserve existing seven master runs and all accepted checkpoints.
