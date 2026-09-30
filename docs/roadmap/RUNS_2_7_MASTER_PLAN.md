# FOUNDLY OS — MASTER RUN PLAN 2–7

Status: **AUTHORITATIVE PLANNING CONTRACT FOR EXECUTION AFTER CURRENT RUN-2 CONTINUATION**

Created: 30 September 2026 (Europe/Amsterdam)

Companion requirements:
- `docs/roadmap/FOUNDLY_AI_OS_HARD_REQUIREMENTS.md`
- `docs/run2/AUTHORITATIVE_CONTRACT.md`
- `docs/run2/ACCEPTANCE_MATRIX.md`
- `docs/run2/DEMO_UNIVERSE_ACCEPTANCE.md`
- `docs/run2/DEMO_DELIVERY.md`

This plan preserves the seven-run roadmap. It does not introduce Run 8.

The planning estimates below are conditional engineering-budget ranges, not promised calendar delivery dates. Automated test/CI wait, provider outages, device access, reviewers, customer access and third-party approval can extend elapsed time without representing active engineering time.

---

# A. EXECUTION OPERATING SYSTEM

## A1. Source of truth

Technical truth order:

1. actual repository/worktree;
2. Git commit/tree;
3. PR state;
4. acceptance matrix;
5. frozen evidence;
6. CI;
7. deployed/runtime evidence where authorized;
8. conversation summaries only as historical context.

Never reverse this order.

## A2. Build/review responsibilities

### Run 2
- Codex: primary builder.
- GitHub/CI: technical proof.
- Chat: owner status/cockpit.
- Work: independent full-run audit after Codex believes Run 2 is complete.
- Claude is intentionally not inserted mid-Run-2.

### Runs 3–7
- Codex: primary implementation engineer.
- GitHub/CI: source of truth.
- Claude Opus 5.5 or strongest approved independent equivalent at execution time: technical/red-team reviewer.
- Work: complete independent run-level audit.
- Chat: owner cockpit/status/decision log.

No two agents should concurrently author the same active implementation branch by default.

## A3. Standard checkpoint loop

For every meaningful gap:

**RECOVER STATE**
→ reproduce failing/open requirement
→ implement minimal correct change
→ targeted tests
→ native/integration/HTTP/browser/device tests as applicable
→ freeze source/tree
→ rerun selected evidence on unchanged source
→ commit/publish
→ full CI
→ independent review when scheduled
→ fix findings
→ re-run CI
→ update matrix/evidence
→ continue immediately.

A checkpoint passing is not the same as a complete run.

## A4. Run closure loop

When Codex believes a run is complete:

1. freeze candidate release;
2. full regression;
3. all run-specific evals;
4. Claude technical audit (Runs 3–7);
5. Codex fixes;
6. full CI;
7. Work complete run audit;
8. Codex fixes any accepted audit gaps;
9. final CI;
10. Work recheck;
11. merge/release/deploy only with explicit authorization;
12. mark the run complete;
13. start next run from the verified release.

---

# B. RUN 2 — ZERO COGNITIVE, AGENTIC & GLOBAL INTELLIGENCE

## Objective
Finish the current authoritative Run 2 exactly as already contracted.

Do not inject the new Creative/Growth implementation into Run 2.

## Current priority
Automotive + E-commerce complete demo acceptance first.

Hard scope already includes:
- ZERO cognition/context/social intelligence/empathy;
- multilingual behavior;
- voice;
- Finance/CRM/Sales/Procurement/etc.;
- demo universes;
- provenance;
- recovery/idempotency;
- current permissions;
- current-source authority;
- market/trend/value/revenue scenarios;
- browser;
- desktop;
- iPhone;
- Android;
- HTTPS;
- install/download;
- accessibility/performance;
- complete evidence.

## Immediate continuation
Continue the financial correction/return chain without losing completed product/inventory/order/invoice controls.

Then close remaining demo/module/quality/device gates.

## Closure gate
No Run-2 completion until:
- both priority demos accepted;
- all Run-2 matrix gates resolved;
- full CI;
- Work audit;
- audit gaps repaired;
- final review.

## Planning active engineering
**25–60 hours remaining** based on the current Codex throughput and open evidence-heavy quality/device gates.

## OpenAI credit planning band
**6,000–18,000 credits**

This is a planning envelope, not a usage guarantee.

---

# C. RUN 3 — ENTERPRISE DATA, DIGITAL TWIN, POSTGRESQL & DISASTER RECOVERY

## Objective
Replace prototype-scale persistence/data assumptions with a production-grade enterprise data substrate capable of supporting the autonomous Creative/Growth future.

## Required workstreams

### C1. PostgreSQL production foundation
- normalized/intentional schema boundaries;
- migrations;
- versioning;
- tenancy;
- permissions;
- locking/concurrency;
- transactional guarantees;
- connection management;
- read/write scaling strategy;
- indexes;
- query budgets;
- auditability.

### C2. Digital Twin
A permission-aware representation of:
- organization;
- identities;
- roles;
- locations;
- customers;
- suppliers;
- products/assets;
- inventory;
- finance;
- marketing;
- websites;
- campaigns;
- content;
- analytics;
- workflows;
- providers;
- outcomes.

### C3. Enterprise event/data layer
- durable events;
- replay;
- deduplication;
- ordering where required;
- outbox/inbox;
- source identity;
- provenance;
- temporal facts;
- supersession;
- retention.

### C4. Asset/content graph
Foundation for:
- pages;
- components;
- images;
- videos;
- campaigns;
- ads;
- SEO entities;
- generated assets;
- versions;
- source/model provenance;
- usage rights.

### C5. Continuous Learning data foundation
Store:
- benchmark observations;
- competitor capability observations;
- model/version benchmarks;
- content outcomes;
- SEO outcomes;
- ad outcomes;
- website outcomes;
- latency;
- cost;
- failure;
- user feedback;
- accepted corrections.

### C6. Search/vector/semantic foundation
- governed semantic indexing;
- deletion;
- reindex;
- current permissions;
- provenance;
- freshness;
- source authority.

### C7. Disaster recovery
- backup;
- restore;
- point-in-time recovery;
- tenant-safe restore;
- encryption;
- corruption handling;
- documented RPO/RTO targets;
- restore drills;
- regional/provider failure strategy.

## Run-3 closure
No PASS without:
- migration/rollback evidence;
- representative load;
- permission boundaries;
- disaster recovery drill;
- data integrity;
- failure injection;
- Work audit;
- Claude technical audit.

## Planning active engineering
**60–140 hours**

## OpenAI credit planning band
**12,000–35,000 credits**

---

# D. RUN 4 — AUTONOMOUS SELF-IMPLEMENTATION, CONTROL PLANE & CREATIVE/GROWTH FACTORY

This becomes the largest construction run.

## Objective
Turn the Run-3 enterprise substrate into Foundly’s autonomous implementation and business/creative/growth operating layer.

## D1. Control Plane
- tenant implementation planning;
- capability composition;
- environment/config versioning;
- deployment plans;
- policy/risk;
- credentials/approvals;
- rollback;
- observability;
- human intervention boundaries.

## D2. Continuous Competitive Learning Engine
Implement the governed:
**Discover → Observe → Benchmark → Learn → Gap → Build → Test → Compare → Measure** cycle.

Must feed all major capabilities.

## D3. AI Website Builder
Build the complete native capability described in the hard-requirements contract:
- generation;
- visual editing;
- responsive;
- CMS;
- forms;
- e-commerce;
- SEO;
- Analytics;
- Ads;
- CRM;
- accessibility;
- publishing;
- versions/rollback;
- ZERO operation.

## D4. AI Photo Studio / Image Intelligence
- editor;
- generator;
- converter;
- batch;
- model routing;
- masks/layers;
- production/e-commerce/social/Automotive workflows.

## D5. AI Video Studio
- professional editable timeline;
- transcript workflows;
- automatic edits;
- captions;
- dubbing;
- sound;
- reframe;
- brand templates;
- export.

## D6. AI Video Generation Orchestrator
- frontier-provider registry;
- current Seedance/Veo-class benchmarks;
- dynamic routing;
- reference consistency;
- audio/video;
- extension;
- provider failover;
- provenance/cost/rights.

## D7. AI Analytics
- cross-module business analytics;
- natural language;
- funnels/cohorts/attribution;
- anomalies;
- forecast;
- recommendations;
- outcome measurement.

## D8. SEO Machine
- technical;
- content;
- programmatic;
- AI-search visibility;
- continuous optimization;
- governed automatic publishing.

## D9. AI Advertising/Growth Engine
- market/performance intelligence;
- creative generation;
- image/video/landing page generation;
- media planning;
- publishing;
- optimization;
- bounded budget autonomy;
- profit/margin-aware decisions.

## D10. Cross-module Growth Orchestration
A single ZERO objective can safely coordinate:
Finance → inventory → CRM → Website → Photo → Video → SEO → Ads → Analytics → Sales.

## D11. Industry Demo Factory
The same engine must produce coherent industry-specific experiences without customer forks.

## Run-4 acceptance
Every capability requires:
- dynamic current competitor benchmark;
- parity on core flows;
- evidence-backed Foundly superiority on selected differentiators;
- secure production contracts;
- current authority;
- recovery;
- cost controls;
- quality evals;
- Claude audit;
- Work audit.

## Planning active engineering
**180–420 hours**

## OpenAI credit planning band
**40,000–120,000 credits**

---

# E. RUN 5 — FOUNDLY MOBILE & WORKFORCE EXPERIENCE

## Objective
Make Foundly genuinely usable as a mobile/workforce OS, not a desktop site squeezed onto a phone.

## Workstreams
- iOS application/approved delivery architecture;
- Android application/approved delivery architecture;
- responsive web/PWA where appropriate;
- biometric/device authentication where supported;
- push notifications;
- deep links;
- mobile ZERO;
- voice;
- camera/photo/video capture;
- uploads;
- approvals;
- CRM/Sales/Finance/field tasks;
- creative review/edit;
- SEO/Ads monitoring;
- publishing controls;
- offline/read-only/resumable flows where safe;
- sync conflict handling;
- background behavior;
- device permissions;
- battery/network efficiency;
- accessibility;
- phone/tablet layouts;
- mobile security;
- install/relaunch/recovery.

Professional workflows may use cloud execution with a mobile control surface where full local editing is inappropriate, but parity claims must remain truthful.

## Run-5 closure
- actual iPhone;
- actual Android;
- representative devices;
- accessibility;
- adverse connectivity;
- permission revocation;
- install/update/relaunch;
- Claude audit;
- Work audit.

## Planning active engineering
**70–160 hours**

## OpenAI credit planning band
**15,000–45,000 credits**

---

# F. RUN 6 — FINAL FULL-STACK RED TEAM, SECURITY, PERFORMANCE & RELIABILITY

## Objective
Attempt to break the complete Foundly stack and close all material quality gaps before real-customer final acceptance.

## F1. Security
- auth;
- tenant isolation;
- permissions;
- secrets;
- injection;
- SSRF;
- XSS;
- CSRF where relevant;
- supply chain;
- dependencies;
- file/media handling;
- prompt/tool injection;
- data exfiltration;
- cross-agent privilege;
- connector abuse.

## F2. Autonomous-action abuse
- accidental spend;
- destructive publishing;
- SEO spam;
- hallucinated claims;
- duplicate payments/actions;
- stale approvals;
- fake provider success;
- hidden privilege escalation.

## F3. Creative safety/integrity
- copyright/provenance;
- false product depiction;
- misleading Automotive edits;
- unsafe generated content;
- model/provider policy;
- human approval.

## F4. Reliability
- provider outage;
- queue failure;
- database failure;
- partial writes;
- retry storms;
- restart;
- lost response;
- clock/timezone;
- concurrency;
- disaster recovery regression.

## F5. Performance
- p50/p95/p99;
- seed/load;
- mobile;
- web;
- media;
- rendering;
- upload/export;
- database;
- vector search;
- ZERO;
- multi-agent;
- high concurrency.

## F6. Cost/economics
- token/model cost;
- image/video generation;
- research;
- retries;
- caching;
- storage;
- network;
- budgets;
- tenant limits;
- cost anomalies.

## F7. Sustainability/efficiency
- avoid unnecessary frontier calls;
- local/deterministic paths;
- caching;
- batch;
- media compression;
- resource budgets;
- measurable compute-efficiency proxies.

## F8. Competitive benchmark closure
Re-run current strongest competitor/model benchmarks shortly before release.

No stale competitor list is accepted.

## F9. Localization/accessibility
Complete the production surfaces and native-speaker/assistive-technology evidence required by the product contract.

## Run-6 closure
No material unresolved critical/high defect.
All accepted exceptions documented with explicit owner/risk/decision.

## Planning active engineering
**100–240 hours**

## OpenAI credit planning band
**20,000–65,000 credits**

---

# G. RUN 7 — REAL DATA, REAL CUSTOMER & AUTONOMOUS IMPLEMENTATION ACCEPTANCE

## Objective
Prove the system with authorized real providers, real business data and real customer workflows.

No synthetic demo can close a real-customer gate.

## Workstreams

### G1. Real implementation
- authorize;
- discover stack;
- map sources;
- ingest;
- verify;
- configure;
- deploy;
- rollback;
- recover.

### G2. Real Automotive reference
Where commercially/operationally available, use the intended Automotive/dealer environment.

### G3. Real Website Builder
- real domain;
- real site;
- real publication;
- real analytics;
- conversion measurement.

### G4. Real SEO
- crawl/index;
- content;
- publish;
- monitor;
- actual search/AI visibility changes;
- no ranking guarantees.

### G5. Real Ads
- real authorized account;
- explicit budget;
- bounded spend;
- real creatives;
- real publishing;
- real leads/sales/margin;
- optimization evidence.

### G6. Real creative
- image;
- video;
- product/brand fidelity;
- publication;
- rights/provenance.

### G7. Real Analytics/outcomes
Prove:
- source correctness;
- actual business metric;
- recommendation;
- execution;
- measured result;
- uncertainty.

### G8. Continuous learning
Demonstrate that the outcome becomes governed reusable knowledge and changes future recommendations/benchmarks without bypassing release controls.

### G9. Autonomous implementation
Prove the intended lifecycle:
**SELL → AUTHORIZE → DISCOVER → UNDERSTAND → DESIGN → IMPLEMENT → TEST → VERIFY → DEPLOY → OPERATE → MONITOR → RECOVER → OPTIMIZE → PROVE OUTCOME**

## Run-7 closure
Requires:
- real external evidence;
- no false LIVE state;
- explicit human/customer approvals;
- real rollback/recovery;
- value/outcome evidence;
- Claude audit;
- Work final audit.

## Planning active engineering
**90–220 hours**

## OpenAI credit planning band
**18,000–60,000 credits**

---

# H. TOTAL PLANNING ENVELOPE

## Active engineering
Run 2: 25–60 h
Run 3: 60–140 h
Run 4: 180–420 h
Run 5: 70–160 h
Run 6: 100–240 h
Run 7: 90–220 h

**Total: approximately 525–1,240 active engineering hours.**

This is not calendar time. Agentic parallel work, improved local hardware, reusable infrastructure and future model improvements can reduce active execution substantially. New defects, provider limitations, customer access and quality corrections can increase it.

## OpenAI credits
Run 2: 6k–18k
Run 3: 12k–35k
Run 4: 40k–120k
Run 5: 15k–45k
Run 6: 20k–65k
Run 7: 18k–60k

Raw subtotal:
**111,000–343,000 OpenAI credits.**

Recommended planning envelope after allowing for cross-run audit/rework overlap:
**approximately 110,000–350,000 OpenAI credits.**

This includes intended Codex implementation and Work audit activity at planning level.

It does **not** include:
- Anthropic/Claude API cost;
- Google/ByteDance/Adobe/other AI generation API cost;
- cloud hosting;
- databases;
- Railway or other infrastructure;
- domains;
- ad spend;
- customer hardware;
- licenses;
- external data providers.

There is no honest finite mathematical maximum because future failures, changed model prices, new provider requirements and customer acceptance cycles are unknown. **350k is the conservative planning ceiling for the currently defined scope, not a guaranteed hard cap.**

## Claude reviewer budget
From Run 3 onward, Claude is a separate external reviewer cost and is not paid with OpenAI credits.

Keep it bounded:
- review changed code/evidence;
- use caching;
- do not duplicate Codex implementation;
- full-run red-team only at meaningful gates.

---

# I. BUDGET-EFFICIENCY RULES

To stay nearer the lower end of the credit envelope:

1. keep one implementation owner (Codex);
2. use frozen requirements and acceptance matrices;
3. use local powerful hardware for tests/containers/browser/data;
4. target tests before full regression;
5. cache stable context;
6. avoid sending full repository content when retrieval is sufficient;
7. use smaller models for deterministic/simple work;
8. use frontier models only for high-value reasoning/review;
9. do not re-audit closed work without a dependency;
10. preserve evidence and failures;
11. never restart runs after interruption;
12. automate CI and review handoffs;
13. let Claude review rather than co-author;
14. let Work audit completed runs rather than build in parallel;
15. keep Chat as cockpit, not implementation duplicate.

---

# J. FINAL PROGRAM ORDER

**RUN 2**
Finish current ZERO + Automotive/E-commerce acceptance.

↓ Work audit

**RUN 3**
Enterprise data + PostgreSQL + Digital Twin + outcome/benchmark substrate + DR.

↓ Claude audit → Work audit

**RUN 4**
Autonomous Control Plane + Continuous Learning + Website + Photo + Video + Analytics + SEO + Ads/Growth.

↓ Claude audit → Work audit

**RUN 5**
Mobile/workforce/voice/device experience for the complete OS.

↓ Claude audit → Work audit

**RUN 6**
Full-stack red team + current competitor benchmarks + security + performance + reliability + cost/sustainability.

↓ Claude audit → Work audit

**RUN 7**
Real providers + real data + real customers + real publishing + real outcomes + autonomous implementation acceptance.

↓ final Claude technical audit → final Work audit

**THEN**
Continuous industry-pack expansion and real-customer scale.

No foundational Run 8.
