# Foundly OS v4.3.0 verification report

## Source truth and provenance

- Engine status exposes only sources applicable to that engine and counts a source as connected only when its real provider probe succeeded.
- Configured-but-unverified connectors are listed separately and never contribute to the live-source count.
- The Foundly Data Layer is described as normalized cache/persistence, separate from external providers, historical internal data and derived intelligence.
- Ingested records carry structured provenance (`source_id`, `source_name`, `source_kind`, `method`, `provider_verified`, timestamps). Generic API ingest is explicitly unverified until a provider-backed sync/probe establishes it.
- UI subagents display their currently verified source names or state that no verified external source exists; they no longer claim an independent datasource.

Date: 2026-09-03

## Locally proven

- syntax and startup
- persistent OAuth state and replay rejection
- encrypted persistence and restart recovery
- runtime connector probe/sync/ingestion contract
- core actions and persisted worker execution
- retry scheduling and dead-letter-compatible job model
- UI/backend route contract
- production authentication enforcement
- trusted tenant context (client tenant headers ignored)
- SSRF host/scheme/private-network guard
- secret-free diagnostics and liveness
- Railway readiness fails when a separate persistent mount cannot be proven
- production Basic Auth start plus public Meta/Google/LinkedIn/TikTok callbacks
- restart survival between OAuth start and callback
- hashed, HMAC-bound, tenant-bound state transactions and safe transient retries
- encrypted token persistence, live-probe contract and bootstrap ingestion

Run `npm test` for the full deterministic suite.

## Not claimed by local tests

Real provider connectivity is never inferred from environment variables. Meta, Google, LinkedIn, TikTok and automotive providers remain external blockers until their production credentials, callback registrations, permissions/partner access and live probes succeed. `/api/ready`, `/api/integrations/status` and the Integration Control Center are authoritative after deployment.
