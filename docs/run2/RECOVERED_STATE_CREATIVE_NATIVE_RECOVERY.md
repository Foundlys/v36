# Same Run 2: native Marketing creative revision recovery

Frozen source `a065c6bab8678d842501aee258def5bbb3403196`, tree `c902b5232a7e3d3fb00768df452cb480c099969e`: all 826 ZERO tests, 14 corpus cases and seven affected native commands PASS. Twelve new permanent tests include real native/ZERO HTTP, lost completed replies, encrypted restart, storage failure and authenticated body waits. Nine missing-feature failures are retained.

The native receipt binds the original actor, source owner, request key/body fingerprint, source revision and restore choice to the exact retained result snapshot. Version, history, audit, outbox and receipt remain in the existing atomic domain transaction. Recovery observes the original applied revision and reports whether the accessible current record is newer; it does not overwrite or re-execute. An absent request can be durably closed, preventing its delayed original version or restore body from applying. Current authority and source/result ownership precede outcome disclosure. Corrupt history and legacy receipts without complete metadata cannot become invented recovery proof. Capacity remains bounded.

The explicit ZERO version/restore request key now matches the native key, while old ZERO turn-derived keys remain compatible. The new recovery operation uses the same native current-permission policy. Receipts stay excluded from generic snapshots.

Published native commit `a12671cdc13020d768a626ed86e6ed90bcb73b0b`, tree `077785582edc196ebb83f21621a63dbd0bd8322b`, has complete full CI 222 PASS (run `36159785842`, job `108153212480`). CI merge `7c3cd3fff8c740d13a27ea12b13b56701c0db160` has exactly the published tree. The complete log confirms 826 ZERO tests and 14 corpus cases; log hash and byte count are retained in the checkpoint manifest.

The subsequent `RECOVERED_STATE_CREATIVE_CLIENT.md` connects the real client to metadata-only recovery and owns its newer evidence separately. This native checkpoint does not claim that newer client CI. All wider unaccepted Run 2 gates remain open; no main merge, deployment, real credentials or Run 3 action.
