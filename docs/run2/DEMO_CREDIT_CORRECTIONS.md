# Full credit corrections for the priority demos

The normal Finance and ZERO contracts now support creating a full source-bound credit draft, posting it separately and recovering the exact original request. Both generated priority demos include one posted credit awaiting allocation. This is an internal financial correction; it performs no bank refund, physical return, cancellation or automatic invoice allocation.

The initial regression reproduced four defects/gaps: a credit draft inherited its source invoice's posting/payment fields; an unposted source was accepted; generic credit creation could bypass its original invoice/amount/counterparty; and there was no source-bound confirmed credit action. The retained `credit-initial.log.gz` records those failures. The correction copies billing facts and line references only, requires an actual posted native sales invoice and its unreversed journal, reserves the full amount against existing linked credit documents, and rejects changed customers, currency, line amounts, tax codes or product/project/cost-center references.

The new `CREDIT_NOTE_CREATE` action exposes preview, execute and recover through the same guarded native Finance action protocol and through ZERO in both Automotive and E-commerce. Explicit dates and the complete input/source hash are required. Native current role and invoice/ledger capabilities are checked on every attempt. Replay returns the original credit draft separately from its current posted state. It does not claim that a later posting happened during replay. The ordinary generic `INVOICE_CREATE` action directs credit requests to this explicit original-invoice contract.

Native invoice validation also rejects caller-supplied posting, payment, approval, identity and audit fields. Native creation generates those fields. Credit posting rechecks the original invoice, lines, prior credits and source journal; reversing the original journal after preparing a credit prevents posting it. Existing records are not rewritten or migrated. Credit routes currently support the exact full original amount; partial credit issuance remains explicit remaining work, not an inferred refund or arbitrary negative invoice.

An open credit is now reported as payable to the recorded customer, not as another positive customer receivable. The source invoice remains in its actual state until separate allocation. A credit against a paid invoice creates no outgoing payment record by itself. Receipts, journals, credit outstanding amounts and the original customer obligation remain independently inspectable.

## Generated scenarios and evidence

| New default graph | Automotive | E-commerce |
| --- | ---: | ---: |
| Graph nodes | 5,931 | 4,021 |
| Sales invoices | 140 | 180 |
| Additional full credit notes | 1 | 1 |
| Internal payment records | 84 | 108 |
| Balanced journal entries | 197 | 253 |

The correction scenario uses an unpaid posted sale: one full credit is created and posted, and both the original receivable and customer credit stay open pending explicit allocation. Sales-order links, physical stock and bank evidence are unchanged by that financial operation. All values and organizations remain labelled synthetic; native audit time is actual execution time. Older confirmed graphs retain their exact earlier manifest and counts.

Frozen source: `58da9e3a071db44abdb3fe20a90268dc92309a83`, tree `b28d89a07fcc11c43141dfc4603bea4b1d203770`. The unchanged source passes 146 focused Finance/demo/ZERO cases, fourteen corpus cases and nine native suites. The main selection takes 183.174 seconds. Exact completed checks and raw-log hashes are in `evidence/20260927-demo-credit-corrections/credit-frozen-results.json` and `checkpoint-tests.json`. Tests cover both complete native default graphs, credit-create/post lost cursor recovery, balanced revenue/receivables/cash, protected input fields, exact full-source money and line identity, over-credit refusal, source reversal and persistence rollback. Real HTTP/ZERO cases for both packs destroy a committed credit response, restart encrypted storage, recover the original draft without duplicates, post it, recover its original/current states and deny it after capability revocation. These use structured native actions without a live model or voice provider.

Preceding CI 275 is complete and successful for published `87df5b8d246ef14755937a028f4172aea99662bf`, exact tree `11e8626c5015c99a04cb232514aca40a01e231c6`, with 1,897 ZERO and 14 corpus cases. Its checkout merge, parents and raw log are retained. That full run precedes this newer credit source, whose own full CI is separate.

## Remaining demo work

Next are explicit credit allocation and internal refund records with source-bound recovery, then partial credit/return/cancellation chains, purchase/expense/COGS and approval history, Automation/Analytics history and full module controls. Natural language, social/empathy and voice quality require their own independent evidence. Real source freshness, forecasts/valuation, full encrypted default-load measurement and actual desktop/iPhone/Android/HTTPS/download acceptance remain open. No complete demo or broad Run-2 gate is accepted here. The user's order remains: finish both priority demos against all hard requirements first, then resume the preserved remainder of Run 2.
