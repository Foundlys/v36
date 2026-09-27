# Explicit credit allocation and internal refund history

Both priority demo generators now execute full native credit creation, separate posting and explicit settlement. One unpaid sale is settled against its exact original credit. One paid sale receives a separate internal outgoing refund booking against its full posted credit. Neither operation sends money or establishes bank/provider settlement. The original sale retains actual incoming payments; credit allocation and outgoing refund records have their own amounts, dates, source references and receipts.

`CREDIT_ALLOCATE` and `CREDIT_REFUND_RECORD` use the existing Finance preview/execute/recover contract, current invoice/ledger/payment capabilities and exact confirmed source hash. ZERO exposes the same native actions for Automotive and E-commerce. Preparation validates both documents, original invoice identity, currency/entity, integer cent conservation, current open balances, actual unreversed source/payment/refund journals and their balanced lines, open periods and unique active account mappings. A refund cannot exceed recorded receipts available on its economic date minus already recorded refunds. Unknown dates, extra control inputs and wrong original invoices are rejected.

An allocation reduces both open balances and adds no journal or payment. An internal refund reduces the credit balance and posts its own balanced receivables/bank journal. Invoices use SETTLED/PARTIALLY_SETTLED when credits contribute to closure, preserving the distinction from actual incoming payments. Reports include the statuses and expose internal outgoing refund history; collection and subsequent payments retain correct partial balances. New optional balance fields remain compatible with existing records without a bulk rewrite.

Native persistence and event delivery remain atomic. Allocation and refund receipts compare the original credit, related original invoice, settlement and any journal to the current records. A new internal read-only inspection rechecks all effects after execution without flushing events, retiring an unknown request or posting anything. Demo acceptance now uses that check even when a payment node returns its updated invoice for the next credit operation. Previously confirmed payment-entity graphs remain supported and retain their exact request/manifest identity. Lost demo cursors may reuse only their own originally prepared mutable dependencies; unrelated dependencies and current rights still require fresh checks.

## Native generated history

| Default graph | Automotive | E-commerce |
| --- | ---: | ---: |
| Nodes | 5,935 | 4,025 |
| Sales invoices | 140 | 180 |
| Full posted credit notes | 2 | 2 |
| Incoming internal payments | 84 | 108 |
| Balanced journal entries | 199 | 255 |
| Explicit allocations | 1 | 1 |
| Internal outgoing refunds | 1 | 1 |

Organizations and monetary scenarios remain synthetic, with actual native audit timestamps separate from economic scenario dates. A financial correction does not imply a physical return, cancellation, provider payment or change to a previously linked commerce order.

## Evidence and its limits

Frozen source `cd7e91dbfb1401c3b81b42dcf40f1df61fa88ce7`, tree `2b4c22868003e15b9c4892d0aff36e6b3a2ce7e7`: 162 focused Finance/demo/ZERO cases, 14 corpus cases and nine involved native scripts pass, with a clean unchanged checkout before and after. Main selection: 193.843 seconds; corpus: 3.077; native scripts together: 9.223. Exact commands, completion summaries and log checksums are retained in `evidence/20260927-demo-credit-settlements/settlements-frozen-results.json` and `checkpoint-tests.json`.

The selection executes both complete native default graphs and reconciles cash, receivables, revenue and tax ledger effects. Focused cases cover unpaid/partially paid/paid sources, source reversal/corruption, partial allocation followed by payment, refund caps and dates, stale confirmation, persistence rollback, original/current result separation and current authority. Both packs run real structured HTTP/ZERO allocation and refund actions with destroyed committed responses, encrypted restart, exact replay without duplicates, source-free conversation retention and capability revocation. The bounded real E-commerce seed also covers storage failure and lost payment acknowledgement before subsequent native ZERO billing. This does not establish full encrypted default-load performance, natural model/social/empathy/voice quality or real-device installation.

CI 276 passed the preceding full-credit publication `3b12b7f0c0fae1ee6f8b6567f987308fcd10b377`, exact head and checkout tree `135c861f6a32ce03ec42843a51ac52e810f864f0`, with 1,912 ZERO and 14 corpus cases. Checkout merge `bc08826baabedcb03f7a6f832e1346c84858cd8a` has the verified publication as a parent; the raw log and hash are retained. It ran from 08:11 to 08:28 UTC. This newer settlement source requires its own full CI after publication.

## Remaining work and sequence

Next: usable native/ZERO Finance action controls with exact confirmations and recovery, as part of complete module UI. Partial credit issuance, explicit return/cancellation financial chains, purchase/expenses/COGS, approval and Automation/Analytics histories remain open. Independent natural/social/empathy/voice review, broad source freshness and forecast/value validation, full encrypted performance measurement and usable desktop/phone/HTTPS/download delivery remain acceptance work. No finished demo or broad Run-2 gate is accepted. Complete Automotive and E-commerce first, then continue the preserved Run-2 remainder.
