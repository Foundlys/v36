# Tenant identity continuation

The deployed administrator authentication and credentials remain unchanged. An
additive tenant directory is implemented in the existing encrypted Core
store. Nothing in this increment creates a production account or sends an
invitation. The current deployment's trusted tenant context remains authoritative;
client tenant IDs, role headers and account claims cannot select a tenant.

Only the existing Founder/Super Admin/composition administrator can invite and
change directory members. A one-use, 24-hour invitation proves possession of the
issued enrollment secret, not verified email ownership or external SSO. Members
choose their own password. Passwords use salted scrypt (N=131072, r=8, p=1), with
bounded concurrent hashing. Random invitation and session secrets are stored as
SHA-256 digests. Plain passwords and secret tokens never enter ordinary records,
audits, exports, ZERO context or provider traffic. Expired session-only entries may
be pruned; member and access audit history remains retained.

Session cookies must be Secure in production, HttpOnly and SameSite=Strict.
Cookie-authenticated writes and login/enrollment require the configured canonical
Origin. Membership changes invalidate previous sessions. Request identity must
remain isolated across asynchronous work, and current roles must be resolved
again at operation boundaries. Background execution may use only an active
directory member's current principal, never the scheduler's broader principal.

Full `npm test` passed, including real HTTP sessions for two fixture members,
concurrent request isolation, operation-boundary revocation, private Core and
ZERO separation, current-owner scheduling/queues, rollback and encrypted
restart. Access transitions use the existing restricted Core audit. This proves
the tested implementation; it is not a production deployment or browser sign-in
acceptance claim. SSO, MFA, verified
email delivery and live browser acceptance are not established by local fixtures.

Sources checked 2026-09-09: [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html),
[Node crypto](https://nodejs.org/api/crypto.html), and
[Node asynchronous context tracking](https://nodejs.org/api/async_context.html).
