# Dedicated Google mail authorization — Phase 24 continuation

This is an implementation checkpoint in the existing run. It does not close Phase 24, assert comparative parity, or authorize a deployment. All provider exchanges in regression are labelled isolated fixtures. No legitimate account consent, credentials, provider mail, or production configuration was changed.

## Current behavior

The existing encrypted email connector accepts `mail_auth_source=GOOGLE_OAUTH`, `mail_oauth_client_id` and the secret `mail_oauth_client_secret`. The native Communication Messages workspace exposes **Google-mailtoegang** with explicit request, refresh and local disconnection controls. Blank/default or explicit MANUAL preserves the existing PLAIN/manual-XOAUTH2 configuration. An unknown source cannot fall back to a password.

Google mail uses its own grant in encrypted Core scopes `communication:mail_oauth_states` and `communication:mail_oauth_grants`. It never reads or replaces the general Google connector grant. SMTP and IMAP use fixed Gmail hosts, verified provider email, and XOAUTH2. The callback is the configured HTTPS public origin followed by `/api/communication/mail-oauth/callback`; caller-supplied hosts and redirect URLs are not accepted. Actual deployment credentials and provider callback registration remain operator/provider work.

Starting consent requires an active tenant member, current Communication/inbox write and Core connector-management rights, exact configuration binding, reason, confirmation and action key. A 15-minute random state and S256 PKCE challenge bind the initiating member, tenant, configuration and existing grant revision. The callback requires the same member's current authenticated session as well as the state. It does not use an unauthenticated bootstrap identity. A fixed no-store/no-referrer public return page displays no query values and performs no authorization. Its script clears the code/state from the address bar, keeps them only in page memory, and waits for an explicit same-origin POST from the initiating session. This preserves existing SameSite=Strict cookies. The protected POST applies current principal/origin/composition policy; success returns to `/communication`. The return script refuses duplicate query parameters. A completed exact callback replay does not exchange the authorization code again.

A new authorization requests the actual Gmail IMAP/SMTP mail scope plus OpenID email/profile. It is accepted only after the token response explicitly includes mail scope, a real bounded positive expiry, Bearer access token and offline refresh token, and the fixed OpenID userinfo endpoint confirms a verified email and subject. Missing grant data is unavailable. A failed replacement preserves the previous complete grant. Processing/uncertain authorization codes cannot be reused automatically.

The token and userinfo transport uses fixed Google HTTPS endpoints, DNS-pinned ordinary public IPv4/IPv6, new TLS connections, verified certificates and numeric peer equality. Secret form data and Authorization headers are not sent until TLS/peer checks pass. Redirects, private or mixed DNS, stale authority, oversized/invalid/incomplete responses and timeouts fail closed. Provider error payloads are not copied to user errors or audit.

Active SMTP authentication, approved submission and explicitly requested inbox receipt can renew expiring tokens. Passive status never renews or connects. A retained action replay never refreshes or sends again. Revision, review/source/current principal and capacity checks precede refresh, and the operation rechecks them after the await. A refresh may retain only previously verified scopes if the refresh response omits scope; it still requires a real new expiry and matching verified provider identity. Concurrent refresh in this runtime uses one exchange. Uncertain or interrupted durable refresh state stays unavailable and requires fresh consent rather than claiming a usable grant.

Exact sender approval binds the stable grant ID, verified subject/email and configuration, not the rotating access token. Rotation therefore preserves the approved account identity, while account replacement or configuration changes invalidate it. Native/ZERO submission still uses the same designated source-bound internal approval and separate send confirmation.

Local disconnect removes usable local tokens and invalidates pending callback/refresh writes. It explicitly does **not** revoke the external Google grant. Private tokens, verifiers and state are excluded from generic Data, audit and owned exports. The grant owner's export can include safe historical authorization metadata.

## Verification boundaries

`communication-google-oauth-transport-test.js` uses actual isolated IPv6 TLS sockets/certificates. Service, real native HTTP session/encrypted restart and production DOM handler tests use explicit provider fixtures. Tests cover current role/configuration/disconnect races, one-use callback, incomplete scope/expiry/identity, old grant preservation, rollback, refresh concurrency, unknown source refusal, stable account identity and stale inbox revision refusal before token renewal. Existing SMTP/submission/inbox regressions cover revalidation after preparation and action replay without refresh.

Actual Google application/client registration, user consent, mail routing, live provider acceptance and browser/keyboard/viewport acceptance remain unproven. Token acquisition is not SMTP authentication, an inbox observation, provider acceptance of a message, or recipient delivery. Other providers, richer provider inbox workflows, broader attachment formats/sizes, unknown SMTP outcomes without durable observation, final delivery/bounce reconciliation and remaining module/phase gates stay in scope.

## Primary references checked 2026-09-11

- Google web-server OAuth: https://developers.google.com/identity/protocols/oauth2/web-server
- Google OAuth client PKCE support: https://googleapis.dev/nodejs/google-auth-library/5.5.0/classes/OAuth2Client.html
- Gmail XOAUTH2 and mail scope: https://developers.google.com/workspace/gmail/imap/xoauth2-protocol

These references describe the protocol. They are not evidence that a real provider account has been connected.
