# FOUNDLY ZERO — OFFICIAL WHATSAPP BUSINESS + PERSONAL AGENT INTEGRATION: SCOPE / ELIGIBILITY / ACCEPTANCE
**Founder directive:** 2026-10-13
**Status:** HARD product requirement, OFFICIAL PROVIDER FEASIBILITY / LIVE ENTITLEMENT STILL UNVERIFIED.
**IMPORTANT:** Founder wants ZERO to be able to **actually manage authorized WhatsApp communication** as part of general ZERO Personal Manager and Foundly CRM, and to support diverse user groups. This contract explicitly distinguishes the two fundamentally different official WhatsApp access mechanisms. **No claim of arbitrary control of users' private WhatsApp chats.**
**No production app implementation, provider account access, deployment, merge, login or training performed by recording this file.**

## A. Official interface A — WhatsApp Business Platform Cloud API

**Purpose:** real business WhatsApp communication for Foundly CRM, creator business account/agency (where allowed), freelancers and commercial customer-support/sales teams. Not access to a user's ordinary private WhatsApp Messenger chats.

**Proof available:** Meta's official WhatsApp Business Platform Postman workspace confirms Cloud API programmatic incoming/outgoing messaging, Business Management API, webhooks, Flows and Embedded Signup; official business API requires a Meta business portfolio/WhatsApp Business Account and business phone number. Registering a connector and verifying the phone-number metadata is NOT a working messages connector.

**Implemented work required:**
1. Correct app and provider onboarding: Meta business portfolio, specific authorized business number, WABA, Cloud API scopes/app review, user/business-initiated sign-up and eligibility. Support Business App co-existence only when that actual exact number/account is confirmed eligible. Never misdescribe consumer personal WhatsApp Messenger as the WhatsApp Business API.
2. Per-business encrypted credentials/token refresh where supported, identity binding and right to remove access, signed webhooks, webhook verification + durable dedup/order, replay/auth/tenant checks, provider account lifecycle and budget/failure state.
3. Receive/reconcile only authorized incoming service messages, message templates, media and permitted message metadata; preserve correct business/creator/CRM contact association and opt-in/retention/legal basis.
4. ZERO full personal-style, social/empathy-aware response engine prepares useful contextual replies and real native actions through existing entitlement checks. **Pre-authorized low-risk business correspondence may be auto-sent**; business contracts, sponsor terms, pricing commitments, money, legal claims, personal/sensitive disclosure and untrusted requests require appropriate explicit approval. All model-produced action instructions are untrusted until server-authorized.
5. Durable outbound send queue and receipt / state mapping: `DRAFT`, `APPROVAL_REQUIRED`, `APPROVED`, `QUEUED`, `PROVIDER_ACCEPTED`, `DELIVERED`, `READ` only if actually observed, `FAILED`, `UNKNOWN`. A provider acknowledgment is never silently called delivered. Reconcile uncertain sends to avoid duplicates.
6. Enforce current 24-hour customer-service window, applicable template classifications and opt-in/marketing policy. Send only approved template messages when required; throttle spam and enforce region/business quality and account limits.
7. Update CRM business-contact timelines, deal follow-ups, service queues and associated calendar bookings only under per-contact and organization permissions. Do not blend WhatsApp messages into a private founder vault or consumer personal inbox without separate consent/rights.
8. Billing/tariffs: The WhatsApp Business Platform uses message/category/region dependent pricing. **Since 2026-10-01 service replies and utility templates inside the open customer window may incur per-message charges, subject to allowances and other exceptions**. Meta, BSP/provider and other integration fees are distinct from Codex/Work development credits and from ZERO model token fees. Recheck official rate cards per market at each purchase/invoice; avoid an unverified claim that replies are universally free.
9. Provider restrictions: WhatsApp business channels are for commercial use, not a general-purpose bulk-chat relay. Official 2026 AI-provider terms prohibit certain general-purpose AI distribution as the primary service **except stated EEA/Brazil number conditions**; this exception does not grant unrestricted public API access, private-chat access or worldwide distribution. Obtain current legal/platform assessment and app review before promising any AI messaging use case. Do not use WhatsApp Business message content for training/improving a general-purpose ZERO model in violation of WhatsApp data restrictions.
10. Genuine implementation must work on actual supported phone/account, approved provider app, authorized region, real inbound and outward controlled end-to-end messages, correctly processed revocation, failover, webhook replay and accounted costs. Configured environment variables and a phone profile probe are only foundations.

**Repository reality — on Run-2 remote HEAD at contract creation:**
- `foundly-registry.js` declares a WhatsApp connector with `messaging` and `webhook` capability metadata.
- `server.js` `probeWhatsApp()` checks configured API credentials, queries a Meta Graph business-phone number metadata endpoint, and marks account connectivity when the lookup succeeds.
- No independently identified complete Cloud API send/receive+webhook+CRM/ZERO business action chain or real tested production provider receipts at this checkpoint. Therefore `WHATSAPP_BUSINESS_MESSAGING_PRODUCTION` remains **UNVERIFIED**.
- Existing Communication owns mail/inbox protocols; do not infer that email `communication-zero.js` automatically implements WhatsApp.

## B. Official interface B — WhatsApp 3P Agents (chat WITH ZERO on personal WhatsApp)

**Purpose:** a personal user can optionally talk *to their own ZERO assistant* **inside an approved WhatsApp third-party-agent chat** where the Meta feature and developer onboarding are available.

**Verified provider-public scope (2026):**
- WhatsApp has published Terms of Service for Third-Party Agents, updated **2026-08-25**, and a help page for adding/chatting with third-party agents.
- User may connect up to 5 agent accounts. The service is **only available in limited countries/accounts**; provider onboarding, developer access and rollout to Dutch users are **NOT VERIFIED**. This interface is feature-flagged `BLOCKED_EXTERNAL` until proven.
- **Crucial**: agent can only read messages the user **sends to that agent's own chat**. It **CANNOT access other personal conversations** or groups, cannot be used as an official API for controlling the user's ordinary WhatsApp Messenger identity and sending messages as that user to unrelated recipients.
- Third-party agent conversations are **not the same end-to-end-encrypted user-to-user conversations**: WhatsApp's agent terms state providers receive/process user messages in unencrypted form and need explicit privacy disclosures; the user's other private chats remain encrypted.
- Permitted ZERO actions from **inside** agent chat can still schedule a calendar item, prepare an email, inspect authorized CRM or tasks, and send an allowed action via the **separate valid official connected provider**; the WhatsApp chat itself never grants general CRM or personal conversation rights.

**Required fallback for consumer users:** Full-featured Foundly ZERO mobile/desktop app remains the primary interaction and source of control. If 3P Agents are unavailable, users may share/paste content voluntarily and receive an approved *draft* for sending in their private WhatsApp chats; no automated read/reply of unrelated personal WhatsApp messages. Never propose an unofficial WhatsApp Web/QR scraping or a stealth messaging bot as equivalent to formal integration. Do not describe the agent-only WhatsApp presence as 'manages all my personal WhatsApp chats'.

## C. WhatsApp support matrix — capability, not marketing fantasy

| Requested behavior | Business Cloud API on customer's authorized WABA | User's normal personal WhatsApp Messenger with an eligible 3P Agent |
|---|---|---|
| User converses directly with ZERO via WhatsApp | Only as permitted by current business/AI messaging terms and app review | Potentially yes, in the agent's dedicated chat when eligible |
| ZERO reads that connected channel's incoming messages | Yes, for consented business number messages actually delivered to the app webhook | ONLY messages user sends to ZERO's agent chat |
| ZERO can draft and actually send replies on that number | Yes, within explicit business policy, auth, pricing and official API limits | Agent may respond **to user in agent chat**, not send as user into other private chats |
| ZERO summarizes unrelated private 1:1/group chat history | No | **No** |
| ZERO can automatically send replies from user's normal private number to friends | No | **No** |
| ZERO links permitted business contacts to Foundly CRM | Yes, when contracts/consent allow and records map correctly | Only specifically user-shared inputs under separate valid CRM permissions |
| ZERO can write calendar/task/CRM based on a chat instruction | Yes, via independent Foundly authority and external integration | Yes, where action scope and permissions independently allow |
| Business template/window/pricing restrictions | Yes | Not the same Business messaging flow; 3P agent eligibility/terms apply |
| Global availability promised | **No**, depends on local business/country/Meta entitlement and usage policy | **No**, currently limited rollout |

## D. Legal/security/technical release blockers

- Verify actual **2026-09-23 WhatsApp Business Platform Terms**, the current AI-provider addenda and exact relevant Meta account contract before production. The older Business Solution Terms (2026-03-06) include primary-purpose AI restrictions and a stated EEA/Brazil-registered-number exception; newer specific service terms/policies may also apply. Do not assume prior text proves every planned use is presently approved.
- Explicit purpose and customer opt-in for incoming/outgoing messages, provider template classification, GDPR business/private separation, consent log, retention/deletion export, adequate account and Meta onboarding and correct third-party data processing disclosures.
- No storing other tenants' chats, no cross-SKU leakage, no use of Business Solution Data to train/improve generic LLMs, no model access to raw provider secrets. Retain only allowed data for business operation and evidential receipts subject to documented retention.
- Identity / business numbers / third-party agent account link / WABA templates and billing must be source-verified. Production safeguards: webhook authentic/authenticity, idempotence, state machine, exact recipient checks, rate budgets, opt-out, injection-resistant attachment parsing, unread/unknown outcome honesty, independent external provider fallbacks.
- Do not market global "personal WhatsApp automatic control" because no official provider path was established for it.
- Do not claim personal WhatsApp is available to an arbitrary ChatGPT plugin: a product-level Meta account/agent authorization is separate from a consumer ChatGPT plugin.

## E. Mandatory provider acceptance gates — all UNVERIFIED until live evidence

| ID | Mandatory acceptance evidence | Status |
|---|---|---|
| WHA-001 | Actual approved WhatsApp Business API account/number/business onboarding with correct Meta permissions and compliant terms, and verifiable provider state. | UNVERIFIED |
| WHA-002 | Genuine inbound signed webhook messages linked to one authorized account/contact; dedupe/restart, no privacy/tenant leaks. | UNVERIFIED |
| WHA-003 | ZERO accurately classifies, composes, risk-checks and policy-governs messages in authentic thread context; no forged commercial commitment. | UNVERIFIED |
| WHA-004 | End-to-end allowed template and window-compliant OUTGOING messages with accurate recipient, provider accepted/sent/delivered states, durable reconciliation and no unintended duplicate. | UNVERIFIED |
| WHA-005 | CRM business contact, task, calendar and deal integration, actual authorized source receipts and role-appropriate separation. | UNVERIFIED |
| WHA-006 | Revocation, account unlink, compromised token, wrong-tenant/number, unknown provider outcome, abusive content, injection, timeout and webhook replay safe. | UNVERIFIED |
| WHA-007 | Real 2026 rate/category/region/message fee metering and upper budget controls plus explicit provider limitation/consent feedback. | UNVERIFIED |
| WHA-008 | Separate 3P agent developer platform onboarding and actual eligible personal user chat (if available), with privacy/region/unencrypted-agent disclosures; explicitly cannot read/control user's unrelated personal chats. | UNVERIFIED / CONDITIONAL PROVIDER |
| WHA-009 | Correct unsupported personal WhatsApp fallback and nondeceptive UX: drafts/share-by-user, never promised background personal-chat access. | UNVERIFIED |
| WHA-010 | Current platform legal terms, Meta AI-provider/business provider data-use policies and release app review independently signed off. | UNVERIFIED |
| WHA-011 | Genuine multi-user desktop/iPhone/browser/real business number negative and competitor workflow tests; p50/p95/p99, quotas, privacy/GDPR, accessibility and localization. | UNVERIFIED |
| WHA-012 | Independent ChatGPT Work assessment and founder approval before marking any WhatsApp surface fully production-ready. | UNVERIFIED |

**Product release policy:** If WhatsApp Business is sold/advertised as an included CRM feature, WHA-001..007/010..012 are blocking. 3P Agents WHA-008 is **conditional on platform availability** and may be offered as an **optional region-gated channel**, not an unverified blanket promise or fallback excuse. If the founder later makes universal 3P support mandatory everywhere, the release is externally blocked until those countries are genuinely supported. Foundly ZERO Personal Manager can otherwise be independently usable via native app.

## F. Canonical current vendor/public references (checked 2026-10-13)
- Meta official WhatsApp Business Platform API/Cloud API, Embedded Signup, Business Management and Flows: https://www.postman.com/meta/whatsapp-business-platform/overview
- Official Cloud API Getting Started requires Meta business portfolio, WABA and business phone number: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api
- WhatsApp official current Business Platform Terms effective 2026-09-23: https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-Platform?lang=fil
- WhatsApp older Business Solution Terms last modified 2026-03-06, primary AI-provider use and EEA/Brazil exceptions: https://www.whatsapp.com/legal/business-solution-terms
- WhatsApp official 3P Agent terms last updated 2026-08-25: https://www.whatsapp.com/legal/third-party-agents-terms
- WhatsApp official agent user help, only agent chat and limited regions: https://faq.whatsapp.com/1050934623978152
- Meta WhatsApp official Cloud API webhook examples: https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference
- WhatsApp billing change from 2026-10-01 confirmed by multiple provider updates; obtain current official in-region ratecard from Meta before quoting money: https://developers.facebook.com/docs/whatsapp/pricing
