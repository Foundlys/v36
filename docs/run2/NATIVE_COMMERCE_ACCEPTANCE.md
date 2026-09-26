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
