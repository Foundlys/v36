# Foundly OS — P0-B Enterprise Organization, Identity & Access Contract

**Document state:** HARD REQUIREMENT / IMPLEMENTATION AND ACCEPTANCE OPEN  
**Recorded:** 2026-10-09  
**Scope:** all seven independently sellable commercial modules (CRM, SEO Machine, SEA, Mail, Calendar, E-mail Marketing, Live Analytics), the Website Builder supporting SEO, the shared Foundly Core, ZERO, and the enterprise management/control surfaces.  
**Priority:** P0-B — required before claiming a product is enterprise-ready/sellable to organizations with 100+ employees.  
**Authority:** explicit founder requirement. Preserve the frozen seven master runs; do not create Run 8 or restart accepted Run 1. Codex is responsible for implementation; this document records requirements, not proof of completion.

## Non-negotiable rule

Every customer organization has its own organizational hierarchy and strictly isolated workspace. Every employee signs in to their own Foundly account and receives the modules, information, dashboards, actions, ZERO abilities and approval authority that are explicitly permitted for **that user in that organization's current context**.

**Authentication is not authorization. A visible button is not a permission. ZERO is not a privileged bypass.** Founder private Agency data are never available to customer tenants or their administrators.

Effective decision must consider at minimum:
`IDENTITY × TENANT × ROLE × ENTITLEMENT × CAPABILITY × PERMISSION × ORGANIZATIONAL SCOPE × DATA/RECORD/FIELD SCOPE × POLICY × RISK × APPROVAL × PROVIDER STATE`

Default deny; minimum privilege; separation of duties; no self-grant of authority.

## Organizational structure

- Model **organization/legal entity → business unit/location → department → team/subteam → employee**, allowing multiple memberships, cross-functional teams, dotted-line reporting and delegated management without forcing a single rigid hierarchy.
- Organization administrators may create, rename, move, deactivate and reorganize authorized units. Preserve historical ownership, grants and business records through reorganizations.
- Per user: identity, lifecycle, membership, roles (standard and custom), effective grants, explicit denials, module/license eligibility, reporting manager, delegated powers, approval limits and policy exceptions. Ensure changes are versioned, auditable and revocable.
- Role samples (not hard-coded limits): tenant owner, company admin, IT admin, CEO, director, department head, team lead, employee, finance approver, HR restricted user, auditor and external contractor.
- IT admins can administer infrastructure/identities only within assigned scope; they do **not** implicitly read HR, finance, salaries, privileged documents or all employee data. Senior management likewise is not automatically unrestricted.
- Permission scopes may be organization-wide, business unit, department, team, self, assigned records, or explicitly enumerated resources. An employee may have different scoped roles in different departments.

## Entitlements, data controls and delegated administration

- Subscription/license entitlements are independently enforced for each purchased commercial module and for permitted seat/usage limits; modules can be sold standalone or in bundles. Module presence does not create data privileges.
- Distinguish at least: discover/view, create, update, delete, export, share, approve, publish, spend, configure, administer, delegate, execute and connect. Scope by entity, record, field, organization and contextual rules where relevant.
- Sensitive fields, HR and financial records, customer assignments, attachments, search results, saved filters, exports, reporting, dashboards and notifications must apply the same server-side authorization controls.
- Corporate reporting and cross-module joins must not reveal restricted individual records via aggregations, snippets, summaries, caches, recommendations or inferred ZERO answers.
- Delegated managers may manage only assigned teams and permitted functions. Explicit denies prevail; no privilege escalation through membership changes, inherited groups, API headers or autonomous agents.
- Workflows and approvals must support approval chains, financial limits, separation of duties and changing memberships; risk-sensitive actions require explicit standing authorization or a fresh approval.

## Enterprise identity and lifecycle

- Production-ready SSO via documented OIDC and/or SAML integration, enterprise MFA policies, verified identity and optional just-in-time provisioning only under controlled tenant policy.
- SCIM user/group provisioning/deprovisioning and controlled mapping to company departments, groups, roles and entitlements; safe reconciliation for transfers, leaves, contractors and multiple memberships.
- Tenant- and device-safe sessions; enforced expiration and revocation. Disable/deprovision and permission removal must block **the next protected action** immediately, including queued jobs and ZERO actions; access tokens and session caches must not silently retain powers.
- Privileged admin actions require hardened authorization, audit, and appropriately strong authentication. No shared account as a substitute for attributable human identity.

## ZERO: strictly employee-authority-aware

- ZERO receives only authorized, minimum-needed context and memory for the authenticated active user/tenant/role and current source permissions; no cross-tenant, cross-user or restricted-role memory leakage.
- Every ZERO read, search, voice interaction, tool call, automation and write checks effective authorization server-side **at execution**, not only when the user requests it.
- On queue retry, delayed execution, worker resume, provider callback, scheduled runs and permission change, re-evaluate the real initiating principal, current permissions and tenant; the scheduler/worker's service identity must never silently provide broader authority.
- ZERO cannot create entitlements, elevate its own privileges, bypass approvals or spend beyond tenant/user/workflow limits.
- Permission denials are clear and privacy-safe; no leaking existence or sensitive data via refusals, errors, timing, suggestions or model responses.

## Employee experience and company administration

- Personalized, accessible employee Home and navigation, showing only purchased and authorized modules, tasks, records, KPIs, notifications, actions and ZERO capabilities.
- Authorized enterprise Control Panel for organization hierarchy, employee/group/department management, roles/rights, templates, audit, subscriptions, seats, AI/usage budgets, connectors, approval workflows and operational status.
- Enforce exactly the same decisions across web/mobile, API, data access, exports, ZERO tools, search and background workers. UI hiding alone does not count.
- Localization, usability, keyboard/touch accessibility and intuitive multi-team workflows meet the applicable Foundly quality/competitive benchmarks.

## 24/7 operation, local-first and independence

- The founder's Ryzen 9 9950X3D2 / RTX 5090 32 GB / 128 GB RAM / 6 TB NVMe workstation runs 24/7 as a **local AI worker**, not the sole commercial production dependency.
- Critical customer access, durable data, enterprise identity, API, mail scheduling, task queues, security/risk controls and live workflows must continue in an independent production environment when the workstation, home power, internet or GPU is unavailable.
- Use local inference preferentially **only if measured quality, safety, privacy and reliability meet the task-specific best-available benchmark**. Otherwise use permitted specialist providers/independent fallback.
- Controlled releases, migrations and repairs require a demonstrated objective of **zero customer-visible downtime**, with rolling/blue-green/canary readiness, rollback and intact sessions where applicable; do not claim immunity from every catastrophic outage.
- Idempotent recovery, durable jobs, backups, failover, monitoring, audit and disaster-recovery rehearsals are required. Never silently double-send email, double-spend, double-publish, duplicate payments or trading orders after reconnect/restart.

## Acceptance gates (all must be evidence-backed)

| ID | Mandatory acceptance evidence | State |
|---|---|---|
| ENT-001 | Real tenant with >=100 provisioned users; representative 100–500 account hierarchy across departments, business units and teams; multiple memberships and custom roles work end to end. | UNVERIFIED |
| ENT-002 | Server-side matrix proves organization/department/team/individual permissions for every sellable module and operation, including explicit deny, fields, records, exports and cross-module joins. | UNVERIFIED |
| ENT-003 | Actual SSO/MFA, SCIM provisioning, transfer, deprovisioning, session revocation and delegated management validated against authorized test identity provider(s). | UNVERIFIED |
| ENT-004 | ZERO, memory, search, voice, agents, provider calls and background jobs cannot exceed initiating user's current permissions in normal, delayed, revoked and adversarial cases. | UNVERIFIED |
| ENT-005 | Signed-off strong tenant isolation and founder-private isolation; no cross-tenant data leakage across API, data, cache, logs, analytics, media and admin surfaces. | UNVERIFIED |
| ENT-006 | Per-user Home, department dashboards, enterprise administration, purchased-module access and permission denials verified through real browser/device scenarios. | UNVERIFIED |
| ENT-007 | Authorized module/seat/usage/budget licensing independently enforced for all seven commercial modules plus applicable Website Builder entitlement. | UNVERIFIED |
| ENT-008 | Repeatable load and concurrency tests against >=100 simultaneous active users, representative 100–500 user organizations, realistic data sizes and adversarial permission changes; measured latency/error rates and documented capacity limits. | UNVERIFIED |
| ENT-009 | Independent production availability, workstation-loss failover, durable resume/retries, backups, restore and no duplicate side effects; controlled deployment with no customer-visible interruption demonstrated. | UNVERIFIED |
| ENT-010 | Full security/privacy review: threat model, audit/review, sensitive fields, access revocation, encryption, data retention, export/deletion, GDPR contractual and processor controls. | UNVERIFIED |
| ENT-011 | Full end-to-end real provider integrations for each sellable product, including receipts/evidence of authorized external effects; no simulated success marketed as live. | UNVERIFIED |
| ENT-012 | Competitive benchmark per functional specification, complete relevant regression and successful enterprise customer acceptance. No 'enterprise-ready' or 'better than best' claim without evidence. | UNVERIFIED |

The statuses above concern **complete commercial acceptance**, not a claim that the existing foundation is absent. Existing tenancy, member/session and permission components and relevant tests must be reused and reconciled. No gate becomes PASS based solely on source presence, CI green, mocked providers, health/readiness or user-interface screenshots.

## Execution boundaries and planning

- P0-A Founder Private Agency + Single Control Panel remain the founder's first priority. P0-B enterprise commercial products develop in parallel when feasible, without exposing founder data and without redefining or resetting previous accepted work.
- The documented seven master runs remain canonical. Pull required security/reliability prerequisites forward into P0-B as needed; this does not mean Runs 3–7 are formally accepted.
- Current budgeting assumption (not a commitment): within the prior commercial 623,000-credit central scenario, 80,000 credits were notionally allocated to enterprise identity/organization/roles/audit; the aggregate 809,900 credits included 30% reserve. These are **unmeasured estimates** requiring Codex telemetry and a gap assessment before recalibration. Do not assert fixed costs or delivery guarantees.
- The first enterprise product may sell only after **its** mandatory product and cross-cutting enterprise acceptance gates pass. The entire seven-product enterprise line is 'complete' only when all seven products and shared contracts pass.
- Preserve production/data/credentials; no code implementation or deployment is authorized by this documentation-only change.

## Existing reference contracts

- `docs/run2/AUTHORITATIVE_CONTRACT.md` on Run 2 branch — ZERO-TRUST autonomy and permission-aware ZERO.
- `IDENTITY_ACCESS_DESIGN.md` — existing scoped tenant/member identity and remaining live SSO/MFA validation gaps.
- `COMPOSABLE_IMPLEMENTATION_INVENTORY.md` — reusable module/entitlement boundaries and remaining tests.

**Change-control instruction to Codex:** integrate ENT-001..ENT-012 into the appropriate P0-B enterprise acceptance ledger; preserve all previous acceptance rows and implementation checkpoints. Treat every unverified item as release-blocking until actual evidence exists.
