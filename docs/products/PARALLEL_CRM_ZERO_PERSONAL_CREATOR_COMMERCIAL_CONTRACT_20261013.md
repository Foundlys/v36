# FOUNDER DIRECTIVE — THREE PARALLEL COMMERCIALLY SELLABLE PRODUCTS, ONE ZERO + CORE
**Date:** 2026-10-13
**Status:** APPROVED PRODUCT SCOPE / DOCUMENTATION ONLY — IMPLEMENTATION, PROVIDER ACCESS, TESTS AND RELEASE NOT ACCEPTED.
**Source of truth:** Foundlys/v36 plus all applicable previously founder-approved hard quality contracts and immutable run acceptance evidence. This is an additional product-packaging decision, **not a request to restart Run 2, change frozen master-run order, build a detached ZERO variant or start a new Run 8**.
**Current checkpoint:** Run-2 PR #21 remains OPEN/DRAFT on published GitHub branch (not merged). Main's last verified Railway deployment is the earlier main commit; do NOT conflate remote Run-2 work with live product capabilities.
**Delegation:** Codex develops, tests and packages; independent ChatGPT Work critically reviews every applicable post-run and product-specific acceptance gate, and the founder alone accepts deployment/commercial readiness. Cancelled separate ZERO development-run supervisor remains cancelled.

## 1. Three products, launched in parallel only after the authorized Run-2 foundation

**SKU A — Foundly ZERO AI Personal Manager (GENERAL / CONSUMER / PROFESSIONAL)**
- A complete, **standalone and independently usable personal AI manager**, not restricted to influencers, business users or the Creator Industry Pack.
- Personal email and real authorized Calendar/task/appointment workflows, natural voice, personal memory, reasoning, context, empathy/social intelligence, proactive evidence-based advice, document/content understanding, dependable human approval and execution receipts, phone/desktop interfaces.
- Optional business and WhatsApp channels are **capabilities with explicit permissions**; never claim general private WhatsApp-account control. Personal user can chat with ZERO over an officially eligible WhatsApp third-party agent channel where platform access is approved, but personal conversations with other people are not exposed by that interface. See [WhatsApp integration policy](../integrations/WHATSAPP_PERSONAL_AND_BUSINESS_ZERO_CONNECTOR_CONTRACT_20261013.md).
- Uses full accepted universal ZERO cognition/voice/social contracts; no cut-down, weaker independent creator/personal model. Personal memories are private; separate explicit consent is needed to share with CRM/business/agency.
- Usable across self-employed individuals, families/adults, students/adults, professionals, freelancers, busy workers, creators, entrepreneurs and appropriate other market segments, but **only the verified functionality of the paid SKU is marketed**.

**SKU B — Foundly CRM (COMPLETE / STANDALONE / PROFESSIONAL + ENTERPRISE)**
- The **full independently sellable** Foundly CRM. Must meet all applicable existing founder-approved CRM/product quality bars, measured against relevant current competitors rather than superficially relabeling incomplete native modules.
- Full lead/customer/contact/company relationship and timeline, Customer 360, deduplication/import/export, custom fields/objects, pipelines, opportunity qualification, sales stages, activity/tasks, teams, territories and assignments as applicable, quotes/proposals and required approvals, conversation histories, calendar/mail, officially available business WhatsApp, sequences/automation, native ZERO end-to-end assistant, forecasting/reporting/dashboards, configurable permissions/tenant isolation, GDPR/export/deletion, data provenance, reliability/backup/recovery, mobile/browser functionality, product billing/onboarding and operational support.
- CRM is genuinely usable **without requiring a Creator subscription**. CRM may have optional commercial module integrations, but no fundamental CRM workflow is disabled merely to upsell an unrelated Foundly module.
- Enterprise/team features inherit full applicable P0-B organization/role/department/row/field/approval/SSO/SCIM/MFA requirements where agreed. Security/identity must be verified with genuine account/browser adversarial tests, not simulation only.
- Use existing canonical `crm-core.js`, `crm-objects.js`, `crm-standalone.js`, `crm-automation-actions.js` and shared capability/communication engines. Do not fork source-of-truth CRM or create a new parallel customer database. Existing competitive ledger currently reports `sellable:false`, `standalone_acceptance:PARTIAL`, three CRM capabilities `BELOW_PARITY`; file presence is NOT product acceptance.

**SKU C — Foundly Creator V1 (INFLUENCERS / TALENT / AGENCIES)**
- Existing approved Creator V1 scope stays binding: full ZERO personal creator manager, real publisher/first-party data and trends, historical creator post Content DNA, evidence-backed DAILY/WEEKLY recommendations, scripts and plans, safe personalized email autopilot, sponsor Brand Deals CRM, invoice/deadline/calendar planning, user-supplied previously produced asset references, lawful social import/post/publishing and verified outcomes.
- Creator reuses shared ZERO, CRM, email/calendar/social components under correctly scoped entitlements; does NOT need a separate inferior ZERO or independent parallel CRM.
- **Professional Video Editor, Photo Editor and future proprietary video foundation model remain OUT of Creator V1**; preserved for later Foundly Marketing under issue #32. Creator V1 acceptance keeps exactly original active CR-001/002/003/004/008/009/010/011/012/013/014.
- Creator's customized Brand Deals, rate cards, media kit and audience analytics are a specialized **Creator Industry Pack**, available independently as a product bundle while the underlying shared CRM remains independently purchasable.

## 2. One shared platform, commercial separation

```
                   FOUNDER PRIVATE AGENCY (P0-A; private)
                              |
   multi-tenant Foundly Core + full accepted universal ZERO cognition/voice/memory
        + identity/permissions + policies + event/audit + local-first routing
        + Communication + Calendar + Automation + CRM records + Analytics
                              |
           Shared connectors / consent / message/action receipts
                Gmail | Microsoft | WhatsApp Business*
                       | other permitted providers
                              |
       +----------------------+----------------------+
       |                      |                      |
ZERO Personal Manager     Foundly CRM          Foundly Creator
personal private SKU      team/business SKU   creator industry pack
```

*Official platform eligibility and action scope vary by personal/Business WhatsApp channel, phone number, territory, approval and Meta API entitlement. NO support claim without actual provider-evidenced end-to-end implementation.

- Each customer can purchase one SKU and later add or remove others without forced duplicate purchase, accidental shared private memory, duplicated source records or hidden access between personal and business.
- Support one identity with distinct **personal vault**, **business organization(s)** and **creator/talent workspaces**; explicit, revocable cross-space handoff and fine-grained delegated roles. The customer can export and delete personal data subject to law and contractual retention.
- Shared ZERO reasons over *authorized* capabilities, and independently revokes right to access a source mid-operation. Never allow tool calls, retrieved content, other tenants, untrusted mail or WhatsApp to change authorization rules.
- Sellability is **per product**. Each has independent complete acceptance evidence and can be piloted or released only when its required gates, cross-module impact and founder approval are demonstrably complete; no other unfinished product is silently advertised as included.
- Personal/founder ZERO "full production contract" is the same quality target across profiles. Vary the licensed tools, managed data, UI and billing, not the demanded intelligence.

## 3. FULL CRM independent release acceptance — all UNVERIFIED

| ID | Mandatory verifiable quality gate | Status |
|---|---|---|
| CRMS-001 | Complete actual production multi-tenant organizations/users, login, onboarding, entitlement subscription, custom roles and narrow record/field/team permissions; enterprise SSO/MFA/SCIM where in agreed enterprise tier. | UNVERIFIED |
| CRMS-002 | Leads, contacts, companies, people, opportunities, deals, related activities, notes, attachments, history and full Customer 360; accurate create/edit/search/filter/merge and consistent lifecycle. | UNVERIFIED |
| CRMS-003 | Complete configurable sales pipelines, stages, deal qualification, assignments, follow-up, tasks and dashboards; mobile/browser evidence, no duplicate or lost updates. | UNVERIFIED |
| CRMS-004 | Custom field/object schema, required values and version changes, current record security, data import/export/dedupe and correct migrations without loss. | UNVERIFIED |
| CRMS-005 | Real mail/calendar integrations (Gmail/Microsoft and required channels), consented activity/thread matching, actual send/receive/booking receipts and recovery. | UNVERIFIED |
| CRMS-006 | Approved and actual WhatsApp Business message operations mapped into CRM and ZERO, if offered as a CRM feature: official API + Webhook + opt-in/template/fee boundaries + revocation + human override; no ordinary personal-account chat access. | UNVERIFIED |
| CRMS-007 | Actual native ZERO assists lead analysis, sales workflows, drafting/reviews/authorized action execution with no unauthorized contractual promises or fabricated provider outcomes. | UNVERIFIED |
| CRMS-008 | Actual quotations/proposals and commercial approvals at the applicable CRM tier, tasks, automation/sequences, handoffs, durable delivery/no duplicate/replay, safe external workflows. | UNVERIFIED |
| CRMS-009 | Permission-safe reporting, forecasts, attribution, commercial summaries, actual sourced/defined KPI semantics and uncertain-data handling. | UNVERIFIED |
| CRMS-010 | Production security/GDPR/consent/retention, configurable integrations, provider secret handling, backups/restore, operational rollback/24x7 independent cloud availability as required, load p50/p95/p99. | UNVERIFIED |
| CRMS-011 | Independent task-matched current benchmark vs relevant HubSpot, Pipedrive, Salesforce/Dynamics/Attio where applicable, including feature breadth, workflow quality, user effort, ZERO action correctness, accessibility and pricing transparency. | UNVERIFIED |
| CRMS-012 | Genuine multi-user tenant, device and live-provider full E2E pilot, no hard acceptance FAIL/UNVERIFIED, independent Work evidence and explicit founder commercial release approval. | UNVERIFIED |

**Existing documentation**: CRM's competitive ledger and Run-2 acceptance matrix remain authoritative evidence; this list adds a consumer-facing SaaS/enterprise sellability crosswalk, not a waiver of other approved gate IDs.

## 4. FULL ZERO PERSONAL MANAGER independent release acceptance — all UNVERIFIED

| ID | Mandatory verifiable quality gate | Status |
|---|---|---|
| ZPM-001 | Independent consumer/professional self-serve signup, paid/free entitlements, account recovery and safe device sessions on actual mobile/desktop. | UNVERIFIED |
| ZPM-002 | Full accepted ZERO intelligence, multi-step agentic reasoning, personal context/memory, social/empathy, voice languages and mode selection without downgraded quality. | UNVERIFIED |
| ZPM-003 | Real authenticated personal Gmail/Microsoft inbox access, accurate own-style safe low-risk autorespond, approval for high-impact messages, send receipts, no duplicates. | UNVERIFIED |
| ZPM-004 | Actual calendar account read/write, bookings/tasks/recurrences/time zones, reminders/proactive briefs across user devices with real receipts and no conflict. | UNVERIFIED |
| ZPM-005 | Consent-scoped personalized daily/weekly planning, task prioritization, schedule-aware attention with actual event and message sources, factual uncertainty and deadline safety. | UNVERIFIED |
| ZPM-006 | Correctly signed official WhatsApp **third-party-agent chat with ZERO** only in enabled regions where onboarding is authorized; **no other private chats** read/controlled, and supported Business WhatsApp account features only if explicitly separately permitted. | UNVERIFIED |
| ZPM-007 | Privately scoped personal vault and distinct business/creator profiles; permissioned selective sharing, delete/revoke/export, no cross-user/model-training leakage. | UNVERIFIED |
| ZPM-008 | Stable official integrations and bounded high-risk actions (financial/legal/contracts/personal data/third parties) with preview/approval, retries, idempotency and transparent action results. | UNVERIFIED |
| ZPM-009 | Independently assessed speech, privacy, responsiveness, accessibility/locale, real iOS/desktop UX, p50/p95/p99 costs and competitor task completion. | UNVERIFIED |
| ZPM-010 | Representative pilot of ordinary (non-creator) users across at least 3 segments shows verifiable task success/value and sustainable support/token/connector operating cost, independent Work audit and founder release approval. | UNVERIFIED |

## 5. Build/release execution AFTER Run 2, with nonduplicative shared work
1. **Precondition:** Run 2 fully accepted by independent Work + founder. Founder Private Agency remains P0-A, enterprise P0-B, and existing seven canonical master runs remain authoritative. This contract does not authorize Run-2 acceptance or jump to next master run.
2. **First shared workstream:** verify what the Run-2 baseline actually delivers; complete common account/auth/payment/security, full ZERO product packaging, personal/business vault isolation, notifications, integration and permissions, transparent metering. QA must independently test shared code once against every affected SKU.
3. **Parallel product lane CRM:** close every necessary native CRM feature, live integration and competitive gap; self-contained B2B/B2C business-tier SaaS acceptance.
4. **Parallel product lane ZERO Personal:** independent full ZERO manager, consumer account UX, mail/calendar/tasks/voice and optional officially eligible personal-agent chat channel, no requirement to purchase CRM.
5. **Parallel product lane Creator:** preserve Creator V1 scope and use the same shared services; do not restore video/photo editors or video foundation training.
6. **Shared WhatsApp adapter workstream:** official Business Cloud API for business phone/account; separate eligible third-party-agent integration for talking **to** ZERO in WhatsApp, which NEVER grants access to ordinary personal chats. See integration contract. Rollout conditional on actual authorization; classify unavailable features BLOCKED_EXTERNAL, never PASS.
7. **Independent product sellability:** evidence-linked per-SKU acceptance, pilots, adversarial boundary tests, real provider results, competitor benchmarks and founder explicit approval. Never claim one product is complete because another feature-silo CI is green.

## 6. Financial truth / no double counting

- The last documented preliminary **Creator V1 after Run-2** estimate was **365,000 credits** (474,500 with one 30% reserve) at **assumed** €0.028/credit, **not measured**. It already includes important shared foundations / integration work; **do not add a full CRM build and personal manager estimates as if all shared pieces were net-new**.
- This multi-SKU expansion adds genuine full standalone CRM closure, personal consumer accounts/UX, WhatsApp Business provider work, potential WhatsApp 3P agent access and additional integration/security/QA. **A revised deduplicated credit estimate requires actual frozen source comparison and Codex telemetry**, split into common platform work, *incremental* CRM, *incremental* Personal Manager, *incremental* Creator, official Business WhatsApp, conditional WhatsApp 3P and evidence/Work QA.
- Explicitly report initial build credits separately from later WhatsApp delivery fees, Meta/BSP message charges, per-user model/API inference, account/provider verification, independent hosting, security reviews and sales/marketing/operations.
- High-quality local-first inference/caching is the default economic preference **only when measurable quality, privacy, latency, availability and reliability gates remain intact**. No customer-grade 24/7 availability tied solely to the private workstation.

## 7. Dependencies and scope to preserve
- Later **Foundly Marketing Video Editor, Photo Editor and proprietary video model** remain deferred together (issue #32), not silently reintroduced for General ZERO/CRM/Creator.
- Existing enterprise organization/permissions PR #22 and deep ZERO voice/cognition PR #24 must be reconciled with the current accepted roadmap without claiming they are already merged.
- Exact creator contracts remain in Creator PR #30 and issue #31.
- **CODEx builds, Work audits, founder alone accepts. No extra ZERO development-run supervisor.**

**No implementation/change to product code, runtime, CI, plan, deployment or model accounts is requested or approved through this docs-only contract.**
