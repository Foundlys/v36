# Foundly OS v4.2.0 — Production Hardening Release

## Mandatory production gates

Production now fails `/api/ready` until all core controls are proven:

- `FOUNDLY_PUBLIC_BASE_URL=https://v36-production.up.railway.app`
- a Railway Volume is mounted at `/data` and `FOUNDLY_DATA_DIR=/data`
- `FOUNDLY_ENCRYPTION_KEY` is configured
- `FOUNDLY_ADMIN_USERNAME` and `FOUNDLY_ADMIN_PASSWORD` are configured
- OAuth callback variables exactly match the v36 production URLs

`/api/health` is intentionally a minimal public liveness route. `/api/ready` is a secret-free readiness route. All UI, data, connector, worker and diagnostic routes require authentication in production. Tenant/dealer identity is taken only from trusted server configuration, never from request headers or bodies.

Runtime connector URLs are HTTPS-only in production, protected against private/link-local targets and optionally restricted by `FOUNDLY_CONNECTOR_ALLOWED_HOSTS`. Add an official provider hostname to that allowlist before enabling a new runtime connector.

Foundly OS v4.2.0 is a production-hardening build. It keeps the 12-engine interface and the 93-provider base registry, but replaces the remaining demo-like behavior with persistent state, post-connect bootstrapping, real sync ingestion, a command orchestrator and actual worker execution.

## What is fixed in this build

### OAuth and integrations

- Google, Meta, LinkedIn and TikTok use durable opaque OAuth states stored on disk. OAuth state is one-time, expires after 15 minutes and no longer depends on a signing secret remaining identical between the start and callback request.
- Meta uses `/api/connect/meta/callback`; Google uses `/api/google/oauth/callback`.
- OAuth token storage is refused if no Foundly/Google encryption key is configured. Production credentials are not intentionally written unencrypted.
- After a successful OAuth callback Foundly immediately performs a provider bootstrap instead of only displaying “connected”.
- Meta bootstrap loads ad accounts, Facebook Pages, campaign metadata and last-30-day account insights where the granted permissions allow it.
- Google bootstrap loads accessible Ads customers, campaign performance where accessible, GA4 summary data when `GA4_PROPERTY_ID` exists, Search Console properties/performance and upcoming Calendar events when those services/scopes are available.
- LinkedIn/TikTok account data is ingested after a successful connection.
- Integration status has one runtime source of truth. Runtime-added custom connectors are included in `/api/connectors` as well as the fixed 93-provider base registry.
- SYNC now ingests returned connector data into Foundly instead of only saying that a request succeeded.
- Google/Meta/LinkedIn/TikTok SYNC uses the dedicated provider integration layer. Generic connectors use their configured runtime sync endpoint.
- Google service cards can TEST, SYNC and disconnect the central Google connection correctly. Meta/Facebook/Instagram share one Meta connection as intended.

### Autonomous command execution

`POST /api/core/command` is now the main command path.

A command can:

1. determine the relevant Foundly engine(s);
2. execute supported internal actions (CRM lead creation, follow-up tasks, appointment requests);
3. synchronize relevant connected providers for analysis/search commands;
4. use live OpenAI web search when the request clearly needs current external information and an OpenAI key exists;
5. merge live connector results, persistent Foundly data and web research;
6. return an answer plus explicit `actions`, `syncs`, sources and execution metadata.

Foundly distinguishes between work it actually executed and advice. It does not claim that an external write happened when the provider write endpoint is not implemented/configured.

### Persistence

Previously the main engine records, memory and decisions lived in process memory. v4.2.0 persists:

- module records;
- AI memory;
- decisions/executions;
- task queue;
- real system events;
- worker state;
- OAuth tokens;
- connector credentials;
- runtime connector profiles;
- OAuth state.

For Railway, attach a persistent Volume at `/data` and set:

`FOUNDLY_DATA_DIR=/data`

Without a persistent Railway Volume, any disk-based application can still lose runtime files during container replacement.

### Worker

`POST /api/workers/tick` now performs actual work. It processes queued internal tasks and automatically synchronizes eligible connected providers that have not recently been synchronized. A background worker also runs on `FOUNDLY_WORKER_INTERVAL_MS` (default 300000 ms / 5 minutes).

### Interface

- The old simulated “background activity” feed is removed. The event panel displays real server events from `/api/events`.
- SOCIAL maps correctly to the backend `social_media` engine and GOOGLE maps correctly to `google_ads`.
- Module questions and the global command bar both use `/api/core/command`.
- OAuth returns to the Integration Control Center, refreshes status and shows how many records were bootstrapped.
- VERBIND, TEST, SYNC, PROFIEL, ONTKOPPEL, CONTROLEER ALLES and SELF CHECK all have explicit handlers.
- Unsupported actions are disabled rather than pretending to work.

## Railway deployment

1. Replace the old project files with this package.
2. Attach a Railway Volume mounted at `/data`.
3. Use `RAILWAY_VARIABLES.txt` as the Raw Editor template and insert the real credentials directly in Railway.
4. Make sure the OAuth redirect URIs in Google/Meta/LinkedIn/TikTok exactly match the Railway URLs.
5. Deploy.
6. Railway should log: `Foundly OS v4.2.0 ONLINE op poort 8080`.
7. Open `/api/health` for the local health check.
8. Open `/api/diagnostics/config` for configuration diagnostics.
9. Open Foundly → Integraties → CONTROLEER ALLES.

## Important provider reality

The 93 base connectors are integration profiles, not 93 credentials magically included with Foundly. A provider that requires partner/API access still requires the actual provider credentials and, where relevant, the official endpoint contract. Foundly now handles that state honestly: configured, connected, unavailable, missing endpoint, or failed health check.

This build deliberately avoids scraping or pretending that a partner API exists where no authorized API access is configured.

## Tests

Run:

```bash
npm test
```

The smoke suite verifies:

- server and UI JavaScript syntax;
- v4.2 local health;
- 93 base connectors;
- durable one-time OAuth state and replay rejection;
- custom runtime connector create/test/sync/ingest;
- command execution and internal actions;
- worker task execution;
- persistent state across a full server restart;
- all 12 engine status routes;
- primary UI button/action wiring;
- removal of the old fake activity stream.
