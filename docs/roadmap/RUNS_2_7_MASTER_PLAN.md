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
- Work: complete independent run-level audit and red-team review.
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
4. Work independent technical/product/red-team audit;
5. Codex fixes accepted audit gaps;
6. full CI;
7. Work recheck on the frozen candidate;
8. final CI;
9. merge/release/deploy only with explicit authorization;
10. mark the run complete;
11. start next run from the verified release.

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
- lead/source/enrichment outcomes;
- outreach/reply/meeting outcomes;
- negotiation history and realized deal outcomes;
- CRM interaction/outcome telemetry;
- geospatial/navigation/route-quality observations where lawful;
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
- Work independent audit.

## Planning active engineering
**70–160 hours**

## OpenAI credit planning band
**15,000–40,000 credits**

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

## D10. AI Lead / Sales Machine
- ICP/TAM modeling;
- multi-source lead discovery/enrichment;
- intent/timing signals;
- scoring/prioritization;
- personalized compliant outreach;
- automated follow-up;
- reply/objection classification;
- qualification/nurture;
- appointment booking;
- calendar/routing;
- CRM synchronization;
- attribution and revenue learning;
- lawful-basis/consent/opt-out/suppression/deliverability controls;
- dynamic benchmarks against current best lead-data, enrichment, engagement, AI-SDR, conversation-intelligence and scheduling specialists.

## D11. ZERO Negotiation Intelligence
- sales and procurement negotiation;
- learn from authorized past/future negotiations;
- structured offer/concession/outcome memory;
- multi-variable trade-offs;
- hard commercial floors/ceilings;
- explicit authority and approval thresholds;
- live copilot plus autonomous bounded negotiation;
- email/chat/voice support where authorized;
- outcome measurement and learning;
- no fabricated leverage, deadlines, authority or cross-tenant leakage;
- dynamic benchmark against current strongest autonomous negotiation and conversation-intelligence specialists.

## D12. Best-in-Class Visual / Agentic CRM
- premium modern visual system;
- customizable table/card/board/pipeline views;
- drag-and-drop;
- relationship graph;
- full interaction timeline;
- call/meeting intelligence;
- embedded ZERO;
- automatic capture/enrichment;
- pipeline hygiene;
- next-best actions;
- deal risk/forecast support;
- suggestive/autonomous modes;
- desktop/mobile/accessibility/performance evidence;
- benchmark enterprise depth separately from visual/agentic UX.

## D13. Cross-module Growth + Revenue Orchestration
A single ZERO objective can safely coordinate:
Finance → inventory → CRM → Lead/Sales → Negotiation → Website → Photo → Video → SEO → Ads → Analytics → Calendar.

## D14. Industry Demo Factory
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
- Work audit.

## Planning active engineering
**260–600 hours**

## OpenAI credit planning band
**60,000–170,000 credits**

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
- Foundly Navigation AI and Driver Intelligence;
- own Foundly map/navigation UX and ZERO conversational layer;
- provider-agnostic lawful map/geocoding/routing/traffic backends;
- turn-by-turn guidance, ETA, alternatives and rerouting;
- realtime traffic/incidents/closures/roadworks;
- CRM/calendar/customer-visit route planning;
- multi-stop optimization;
- parking/fuel/EV charging stops;
- arrival/late notifications;
- lawful jurisdiction-aware speed-camera/section-control and road-hazard alerts;
- location privacy, battery/data budgets and low-connectivity behavior;
- geography-specific benchmark evidence against Google Maps/Waze/Flitsmeister-class behavior;
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
- Work independent audit.

## Planning active engineering
**140–340 hours**

## OpenAI credit planning band
**30,000–90,000 credits**

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

## F8. Revenue/Navigation abuse and safety
- unlawful/spam outreach;
- consent/opt-out failures;
- fabricated personalization;
- contact-data provenance failures;
- negotiation floor/ceiling bypass;
- manipulative/deceptive negotiation behavior;
- confidential negotiation leakage;
- accidental calendar/customer communication;
- navigation distraction;
- location privacy leakage;
- illegal camera/radar alert behavior by jurisdiction;
- incorrect ETA/route confidence;
- stale incident/camera alerts;
- unsafe rerouting;
- business-route permission leaks.

## F9. Competitive benchmark closure
Re-run current strongest competitor/model benchmarks shortly before release.

No stale competitor list is accepted.

## F10. Localization/accessibility
Complete the production surfaces and native-speaker/assistive-technology evidence required by the product contract.

## Run-6 closure
No material unresolved critical/high defect.
All accepted exceptions documented with explicit owner/risk/decision.

## Planning active engineering
**130–300 hours**

## OpenAI credit planning band
**30,000–85,000 credits**

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

### G6. Real Lead / Sales Machine
- real authorized target definition;
- real lead discovery and source provenance;
- compliant outreach;
- real replies;
- real qualification;
- real meetings booked to connected calendars;
- real opportunity/revenue attribution;
- opt-out and suppression behavior verified.

### G7. Real Negotiation / CRM
- real authorized negotiation scenarios;
- commercial guardrails;
- negotiation audit/replay;
- measurable deal outcome;
- learning retained without tenant leakage;
- real CRM capture, next actions, pipeline and visual workflows.

### G8. Real Navigation / Driver Intelligence
- actual supported routes;
- route/ETA comparison against current benchmark products;
- live rerouting/incident tests;
- lawful driver alerts;
- CRM/calendar visit routing;
- location privacy and low-connectivity evidence.

### G9. Real creative
- image;
- video;
- product/brand fidelity;
- publication;
- rights/provenance.

### G10. Real Analytics/outcomes
Prove:
- source correctness;
- actual business metric;
- recommendation;
- execution;
- measured result;
- uncertainty.

### G11. Continuous learning
Demonstrate that the outcome becomes governed reusable knowledge and changes future recommendations/benchmarks without bypassing release controls.

### G12. Autonomous implementation
Prove the intended lifecycle:
**SELL → AUTHORIZE → DISCOVER → UNDERSTAND → DESIGN → IMPLEMENT → TEST → VERIFY → DEPLOY → OPERATE → MONITOR → RECOVER → OPTIMIZE → PROVE OUTCOME**

## Run-7 closure
Requires:
- real external evidence;
- no false LIVE state;
- explicit human/customer approvals;
- real rollback/recovery;
- value/outcome evidence;
- Work final audit.

## Planning active engineering
**110–270 hours**

## OpenAI credit planning band
**25,000–75,000 credits**

---

# H. TOTAL PLANNING ENVELOPE

## Active engineering
Run 2: 25–60 h
Run 3: 70–160 h
Run 4: 260–600 h
Run 5: 140–340 h
Run 6: 130–300 h
Run 7: 110–270 h

**Total: approximately 735–1,730 active engineering hours.**

This is not calendar time. Agentic parallel work, improved local hardware, reusable infrastructure and future model improvements can reduce active execution substantially. New defects, provider limitations, customer access and quality corrections can increase it.

## OpenAI credits
Run 2: 6k–18k
Run 3: 15k–40k
Run 4: 60k–170k
Run 5: 30k–90k
Run 6: 30k–85k
Run 7: 25k–75k

Raw subtotal:
**166,000–478,000 OpenAI credits.**

Recommended planning envelope after allowing for audit/rework overlap:
**approximately 165,000–500,000 OpenAI credits.**

This includes intended Codex implementation and Work audit activity at planning level.

It does **not** include:
- Google/ByteDance/Adobe/other AI generation API cost;
- cloud hosting;
- databases;
- Railway or other infrastructure;
- domains;
- ad spend;
- customer hardware;
- licenses;
- external data providers.

There is no honest finite mathematical maximum because future failures, changed model prices, new provider requirements, map/traffic-data coverage and customer acceptance cycles are unknown. **500k is the conservative planning ceiling for the currently defined scope, not a guaranteed hard cap.**

Claude is intentionally excluded from the execution plan. Independent run-level review is performed by Work, backed by GitHub/CI, benchmark suites, deterministic security tooling and real acceptance evidence.

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
13. let Work audit completed runs rather than build in parallel;
14. preserve benchmark/eval suites so independent review does not repeat discovery;
15. keep Chat as cockpit, not implementation duplicate.

---

# J. FINAL PROGRAM ORDER

**RUN 2**
Finish current ZERO + Automotive/E-commerce acceptance.

↓ Work audit

**RUN 3**
Enterprise data + PostgreSQL + Digital Twin + outcome/benchmark substrate + DR.

↓ Work independent audit

**RUN 4**
Autonomous Control Plane + Continuous Learning + Website + Photo + Video + Analytics + SEO + Ads/Growth + Lead/Sales + Negotiation + best-in-class CRM.

↓ Work independent audit

**RUN 5**
Mobile/workforce/voice/device experience + Foundly Navigation AI/Driver Intelligence for the complete OS.

↓ Work independent audit

**RUN 6**
Full-stack red team + current competitor benchmarks + security + performance + reliability + cost/sustainability.

↓ Work independent audit

**RUN 7**
Real providers + real data + real customers + real outreach/appointments + real bounded negotiation + real navigation + real publishing + real outcomes + autonomous implementation acceptance.

↓ final Work independent audit

**THEN**
Continuous industry-pack expansion and real-customer scale.

No foundational Run 8.
