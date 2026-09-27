# Native commerce continuation — not a completed demo

Implementation source `a4327847af82e3da21b3e376e55ce2a10035a66a`, tree `31cadfc5cb24db05f0ba21961b41d885ec541c3e`. The verified follow-up is `4ab780e3ea98b7fd5eb1da2e6b951c858d277767` / tree `66aa03eb54e15b9c1b668d0ba3f59dca8862a2c6`, including the eight-locale section repair and focused model context; 1810 ZERO tests and 14 corpus cases pass.

The production Sales module now owns variant records, a quantity ledger, order reservations, fulfilment registrations, cancellations and partial returns. Commerce requires current Sales write/read access plus `sales:quotes`. Generic record writes cannot bypass these operations. Linked products must remain readable through direct reads, exports and ZERO context. Other Sales capabilities and optional CRM/Finance remain independently composed.

Every write carries confirmation, reason, exact source revisions and an actor-scoped durable request ID. Stock changes, movements, order, outbox, audit and receipt commit together. Failed persistence rolls back all touched buckets. Retry returns the original result alongside the current native state without applying stock twice; unresolved recovery can durably close a request before a delayed retry arrives. Receipt capacity fails closed and does not evict older requests.

Amounts are integer currency minor units, calculated with bounded integer arithmetic. Product prices are explicitly net of tax; the user supplies the rate. Reservations retain the reviewed price/variant snapshot. Return totals are calculated cumulatively so split returns recover the original total, including rounding. Quarantined units do not become available stock. No automatic exchange conversion is performed.

## Current native operations

| Operation | Native route | ZERO operation |
| --- | --- | --- |
| Read/list records | `GET /api/sales/commerce/:entity[/:id]` | `COMMERCE_READ`, `COMMERCE_LIST` |
| Define/update variant | `POST /api/sales/commerce/actions/PRODUCT_SAVE` | `COMMERCE_PRODUCT_SAVE` |
| Record stock received | `POST /api/sales/commerce/actions/STOCK_RECEIVE` | `COMMERCE_STOCK_RECEIVE` |
| Reserve order | `POST /api/sales/commerce/actions/ORDER_RESERVE` | `COMMERCE_ORDER_RESERVE` |
| Cancel reservation | `POST /api/sales/commerce/actions/ORDER_CANCEL` | `COMMERCE_ORDER_CANCEL` |
| Register fulfilment | `POST /api/sales/commerce/actions/ORDER_FULFILL` | `COMMERCE_ORDER_FULFILL` |
| Register partial/full return | `POST /api/sales/commerce/actions/ORDER_RETURN` | `COMMERCE_ORDER_RETURN` |
| Verify/close prior request | `POST /api/sales/commerce/recover` | `COMMERCE_RECOVER` |

The registered entities are `commerce_products`, `commerce_inventory`, `commerce_orders` and `commerce_movements`. HTTP writes require `Idempotency-Key`; ZERO writes accept the same request ID through the existing structured Sales action contract. These are current production capabilities, not a separately scripted demo endpoint.

## Remaining first-delivery work

- Complete the actual E-commerce pack and native UI, including review/recovery controls, all locales and phone/desktop operation. The production pack registry has not yet been expanded to claim completion.
- Bind actual CRM contacts/companies and source revisions. The current free customer reference is explicitly user supplied and not CRM verified.
- Implement exact Finance links, invoices, credits and reconciled reporting through the native services. Existing `finance-core.js` invoice creation performs the duplicate-number check before idempotency replay and includes freshly generated line IDs in its signature; the generic Finance receipt store currently evicts after 10,000 requests. These require fixes and failure/restart proofs before bulk native demo finance generation.
- Extend the ledger to the required location/warehouse, partial fulfilment, procurement/replenishment, discounts, shipping and payment/refund scenarios. Current fulfilment is a user-attested internal registration, not evidence of carrier dispatch. Financial status remains UNPOSTED; payment is never fabricated.
- Seed coherent histories and full Marketing/Calendar/Communication/Automation/Analytics relationships; verify the whole cross-module chain through ZERO.
- Complete natural-language planning, confirmation UX, live model/voice quality, installation, device evidence, packaging, startup and hosted operation before any finished-demo label.

This continuation does not activate providers, send mail, submit payments or deploy a demo. Previous checkpoints and every failed log remain retained.

Recovery metadata follow-up `145e48c`: ten targeted tests and fourteen corpus cases pass. Closing an unseen request returns NOT_APPLIED and no completed-action record through the real ZERO HTTP route; later replay remains blocked and stock is unchanged. The previous full 1810-test run remains explicitly bound to 4ab780e.


## Native Finance continuation — 869c7d0

Atomic invoice/journal/payment/reconciliation recovery and confirmed structured ZERO prepare/execute/recover actions now pass the exact local checkpoint (1826 ZERO, 14 corpus, twelve involved native scripts). The earlier CI 267 is complete and tree-verified. See [FINANCE_NATIVE_RECOVERY.md](FINANCE_NATIVE_RECOVERY.md) and checkpoint-tests.json for source hashes, original/current semantics, failed attempts and limits. Commerce orders remain UNPOSTED until the actual CRM/order/Finance link is implemented. Partial credit/refunds, complete module histories and action UI, natural/voice ZERO, desktop packaging and actual phone/browser delivery remain open. No complete demo has been accepted or delivered. All previous work remains retained; the Automotive/E-commerce delivery block precedes the remaining Run 2.


## Native CRM/order/Finance continuation — ef92929

The actual CRM-contact/order/invoice link now passes the exact unchanged local checkpoint (1833 ZERO, 14 corpus, thirteen involved native scripts). CI 268 is complete and tree-verified for the preceding Finance publication. See [COMMERCE_FINANCE_LINK.md](COMMERCE_FINANCE_LINK.md) and checkpoint-tests.json for atomicity, current rights, original/current results, actual lost HTTP reply, encrypted restart and retained failures. Newly linked orders use INVOICE_LINKED without a posting or payment claim; the earlier UNPOSTED-only description remains historical. Credit/refunds, cancellation corrections, ECOMMERCE registration, full seed/UI, natural/voice ZERO, downloads and physical devices remain open. No complete demo is accepted or delivered. The existing matrix, completed work and remaining Run 2 are retained; work continues immediately on the priority demo block.


## E-commerce native universe continuation — d5244c4

ECOMMERCE registration and a deterministic 3575-node native demo graph now pass the immutable local checkpoint: 1840 ZERO, 14 corpus and thirteen involved native scripts. CI 269 is complete and tree-verified for the preceding CRM/order/Finance publication. See [ECOMMERCE_NATIVE_UNIVERSE.md](ECOMMERCE_NATIVE_UNIVERSE.md) and checkpoint-tests.json for bounded encrypted HTTP replay, structured ZERO billing, retained public-reference attribution and the interrupted first full test attempt. Earlier registration gaps remain as history; the current gaps are full financial/workflow/KPI histories, corrective finance, localized action/recovery UI, full encrypted seed performance and actual delivery. The user also explicitly requires social intelligence, empathy, tone, context and natural/voice ZERO in every demo; these require their own multi-turn quality and listening evidence. No complete demo is accepted, downloadable or installed yet. Automotive and E-commerce stay first; all existing Run-2 work remains retained.
