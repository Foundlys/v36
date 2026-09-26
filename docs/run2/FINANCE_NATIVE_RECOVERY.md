# Native Finance and confirmed ZERO actions — 26 September 2026

This is a bounded production-contract checkpoint for the priority Automotive and E-commerce demos. It does not close Finance, either complete demo, the nine-module delivery block, natural/voice ZERO quality or the remaining Run-2 gates.

## Native changes

Invoice, journal, payment, reconciliation, credit-note creation, approval, account, period and chart operations now commit their subordinate records, audit, request receipt and pending native events together. An atomic persistence failure restores every declared bucket before an event can be published. Nested payment journals cannot commit or replay separately from their parent payment. Native signatures bind the operation and complete request with stable property order; generated invoice line IDs do not change request identity.

Invoice posting and fully paid payment receipts can be read again after their source status or fiscal period changes. They explicitly describe the **original committed result**, not the current invoice. Current permissions precede receipt access. Strict request keys are not truncated. Native receipts are retained past the previous 10,000-row eviction boundary; the 100,000-row/64-MiB bounds reject additional work rather than remove old proof. The existing chart response remains an array on replay.

Native event delivery uses the committed event ID and original actor. A missing acknowledgement or failed acknowledgement persist leaves the event queued; replay retries that same ID. This proves native canonical ingestion, not every subscriber or a reconstructed historical event. Pending events currently retry with subsequent transaction-wrapped writes or confirmed-request execution/recovery; a complete operator/background retry lifecycle remains open. Legacy keyless calls are atomic but cannot distinguish a retry from a separately intended payment; confirmed ZERO actions always require their retained request ID.

Decimal quantities and user-supplied tax rates use rational arithmetic and per-line half-up rounding to a minor unit. Unsafe totals and decimal inputs that cannot be retained exactly are refused. The policy calculates the supplied rate; it does not certify statutory tax treatment. One bank observation cannot fund two invoices. A credit note cannot silently become an incoming sales payment: a separate credit allocation/refund workflow is still required.

Earlier native receipts remain stored. Legal-entity/bank compatibility requires their retained fields to match. Incompatible historical invoice/journal/payment signatures fail closed; no unsafe migration or invented historical success is performed. Other Finance operations outside the listed transactions and any pre-existing partial legacy ledger need their own acceptance.

## Confirmed action contract

Native routes are POST `/api/finance/invoice-actions/preview`, `/execute` and `/recover`.

| Operation | Native effect | Current required capabilities |
| --- | --- | --- |
| INVOICE_CREATE | Create one draft with its actual lines | finance:invoices |
| INVOICE_POST | Post the selected draft and complete native journal | finance:invoices, finance:ledger |
| PAYMENT_RECORD | Record an internal payment observation and its journal | finance:invoices, finance:ledger, finance:payments |

Preview accepts `{operation,input}` and returns source hash, readiness, blockers and a typed amount/currency summary. Confirmation binds the exact input and source hash, a request ID, literal `confirm:true` and reason. A changed source requires a new preparation. Missing or ambiguous periods, missing account mappings, invalid invoice totals, required purchase approval, incompatible currency and consumed bank sources remain blockers.

Execution atomically retains the original result. Recovery returns that original result and the current invoice, lines, payment and journal separately, with a comparison flag. A missing request is durably marked NOT_APPLIED; its delayed original cannot subsequently execute. Recovery performs no financial command. Action receipts are private, encrypted with the normal data store and omitted from generic context/list/export paths.

Each operation has PREVIEW, EXECUTE and RECOVER tools in the existing structured ZERO `finance_action` route. Tool exposure follows current capabilities. ZERO retains only a source-free action reference, reports no newly performed action on replay, and does not list an abandoned recovery as execution. PAYMENT_RECORD is a user-recorded internal booking: it does not move money or verify bank settlement.

## Evidence and limits

The immutable implementation is `869c7d025e75b34cb8b051d1919a3dbbbf6adbea`, tree `efb03484f36e20ce65ea1ba9198e3e4e66085c0f`. Exact suite outcomes, hashes and durable compressed logs are recorded in `checkpoint-tests.json` under `finance_native_recovery_20260926`.

Permanent tests exercise native atomic persistence faults, payment/journal consistency, receipt retention/corruption, exact cents, chart replay, current authority and original/current results. Real HTTP uses the actual identity, composition and encrypted store; it destroys committed replies, restarts the process, revokes a session while a body is pending, and closes an unseen request while its authorized original HTTP body is still incomplete. ZERO and native HTTP share the same confirmations and receipts. Unit persistence/event fault adapters remain explicitly separate from actual HTTP evidence.

The preceding complete CI 267 passed published head `20611e4ea36f9c03684db4d432834d58824d46f6`, tested merge `96847c8c4e12f6c645ac67f507ef3b7d7bfd7fab`, both tree `bbd15478211c624c60480ec62560426a3353607d`. Its complete log is retained; it does not cover these new Finance changes.

Next: connect real CRM/commerce order sources to Finance, finish partial credit/refund and remaining module histories, implement the complete localized preparation/confirmation/recovery controls, and prove natural/voice ZERO and actual device workflows. Desktop packaging, reachable HTTPS delivery, physical iPhone/Android installation and complete seed performance remain open. Prior completed work, failures and interrupted verification are preserved. Automotive and E-commerce are delivered first; only then does the preserved remainder of Run 2 resume.


## Native CRM/order/Finance continuation — ef92929

The actual CRM-contact/order/invoice link now passes the exact unchanged local checkpoint (1833 ZERO, 14 corpus, thirteen involved native scripts). CI 268 is complete and tree-verified for the preceding Finance publication. See [COMMERCE_FINANCE_LINK.md](COMMERCE_FINANCE_LINK.md) and checkpoint-tests.json for atomicity, current rights, original/current results, actual lost HTTP reply, encrypted restart and retained failures. Newly linked orders use INVOICE_LINKED without a posting or payment claim; the earlier UNPOSTED-only description remains historical. Credit/refunds, cancellation corrections, ECOMMERCE registration, full seed/UI, natural/voice ZERO, downloads and physical devices remain open. No complete demo is accepted or delivered. The existing matrix, completed work and remaining Run 2 are retained; work continues immediately on the priority demo block.
