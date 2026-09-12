# Explicit mail authentication

SMTP submission/authentication supports verified implicit TLS on port 465 and mandatory STARTTLS on port 587. Read-only IMAP supports verified implicit TLS on port 993. Both select an explicitly configured SASL mechanism: `PLAIN` (the legacy default) or `XOAUTH2`. They never negotiate a password fallback after an OAuth failure. All DNS answers must be ordinary public IPv4/IPv6 destinations; the selected address and connected peer remain pinned. Current permissions and configuration are rechecked throughout each operation.

The existing encrypted tenant email configuration and connector setup fields accept the following separate values:

| Setting | SMTP field | IMAP field |
| --- | --- | --- |
| Server | `smtp_host` | `imap_host` |
| Port | `smtp_port` | `imap_port` |
| Account username | `smtp_user` | `imap_user` |
| Mechanism | `smtp_auth_method` | `imap_auth_method` |
| Password for PLAIN | `smtp_password` | `imap_password` |
| Access token for XOAUTH2 | `smtp_access_token` | `imap_access_token` |
| Token expiration for XOAUTH2 | `smtp_access_token_expires_at` | `imap_access_token_expires_at` |

Token expiration must be a real, canonical UTC timestamp with milliseconds, `YYYY-MM-DDTHH:mm:ss.sssZ`, strictly in the future. Tokens are bounded to 4096 characters and validated as bearer-token syntax; delimiters and whitespace are refused. XOAUTH2 does not select or transmit a configured password. The legacy configuration shape stays unchanged when the mechanism is omitted. Existing SMTP environment variables retain precedence; optional `SMTP_AUTH_METHOD`, `SMTP_ACCESS_TOKEN` and `SMTP_ACCESS_TOKEN_EXPIRES_AT` apply the same explicit selection. No runtime credentials were changed in this continuation.

Token acquisition, consent and automatic refresh are **not implemented by this transport increment**. An expiration supplied in configuration is a local upper bound, not independently verified provider validity. A revoked or insufficiently scoped token fails the actual provider exchange even before that date. Tokens, grants or scopes from another connector are never borrowed. A legitimate authorized mail grant and provider acceptance remain external prerequisites; broader OAuth onboarding/refresh remains code work.

XOAUTH2 sends one encoded initial response. SMTP error challenges receive an empty acknowledgement followed by failure, even if the server subsequently reports success. IMAP uses an initial response when supported, otherwise a bounded continuation exchange. Error challenges receive an empty acknowledgement; repeated challenges and a success after an error are refused. Tokens are never repeated as a response to an error. Expiration is checked before connecting, before credentials and at subsequent authorization boundaries. Authenticated status expires at the earlier of the token expiration and the existing fifteen-minute proof lifetime. Passive status never opens a connection. Expired/incomplete credentials cannot present trustworthy current authentication or mailbox coverage.

Authentication-only SMTP tests issue no MAIL/RCPT/DATA. Approved submission still requires the existing exact source/account/recipient review, current designated reviewer, separate confirmation and durable DATA boundary. Final SMTP acceptance is distinct from delivery. IMAP remains EXAMINE/BODY.PEEK only. Neither authentication nor a mailbox copy establishes final delivery.

Local evidence includes actual IPv6 TLS/STARTTLS socket fixtures, exact XOAUTH2 wire exchanges, error and expiry cases, real HTTP sessions, token rotation during body/adapter waits, encrypted restart and secret-free projections. These are isolated fixtures, not a live provider account test. Provider onboarding/refresh, other required authentication mechanisms, receipt reconciliation and browser acceptance remain open.

Primary protocol references, retrieved 2026-09-11: [Google's XOAUTH2 mechanism](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol) defines the bearer exchange and error acknowledgement; [RFC 4954](https://www.rfc-editor.org/rfc/rfc4954.html) defines SMTP authentication. Provider-specific grants and scopes must be obtained through the legitimate provider flow.
