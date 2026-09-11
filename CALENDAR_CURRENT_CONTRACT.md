# Current Calendar continuation — Phase 24

Baseline: f995c002. This implementation uses the preserved accessible Calendar work, completed with new reproducible evidence. No inaccessible historical test evidence is reused.

## Native and ZERO creation
Explicit current calendar/timezone selection; strict literal or model-proposed fields; ambiguous times request clarification. Named participants require separate current member selection. Preview has no event effect. Creation requires the exact preview, reason, explicit confirmation and durable operation identity. Current member, calendar and participant access is checked after HTTP/model waits and on replay. Creation, native event and private operation receipt are atomic. Current event updates retain participant access rules and require an accessible calendar/timezone. Production native and ZERO controls retain unsaved input, refuse stale/detached responses and reuse action keys after response loss. No external invitation is sent.

## External occupancy and native scheduling
The explicit external-calendar reconciliation route reads Google Calendar event pages for the selected native calendar and provider calendar ID. All pages must succeed; ambiguous, duplicate, invalid, oversized, inaccessible or looping responses cannot replace the prior observation. Each complete observation contains occupancy only; provider titles, attendee addresses and raw identifiers are not retained. Native records are never overwritten or deleted by reconciliation.

Calendar/account binding, native calendar revision, exact window, source content integrity and fifteen-minute freshness govern native conflicts, slots and booking. Slot and event preview confirmations bind the external observation revision. The confirmed booking path rechecks the current observation. A failed import preserves the preceding observation; stale/uncovered sources are unavailable, not zero busy events. All-day end dates are exclusive and use the provider timezone, including DST duration changes. Native calendars with no external mapping remain usable and explicitly report NOT_CONFIGURED.

Bounds: each observation is one window of at most 31 days, 20 pages, 10000 source records and 8 MiB aggregate JSON; each page is bounded to 4 MiB. These are enforced limits, not claims of global provider completeness. Legacy raw imports remain separate retained observations and do not count as native complete occupancy. External writes, invitations and causality are not claimed.

API source: https://developers.google.com/workspace/calendar/api/v3/reference/events/list (consulted 2026-09-11). The adapter uses singleEvents, showDeleted, timeMin/timeMax and nextPageToken; no incremental sync-token completeness is inferred.

## Evidence
Targeted service, bounded reader, real authenticated HTTP/restart and production synthetic-DOM handler tests pass. The new full regression and source manifest are recorded under .verification/calendar-current-20260911. Actual browser, live provider/account, production and measured competitive superiority remain UNVERIFIED. Phase 24 remains active.
