# Native financial sales histories in the priority demos

Automotive and E-commerce now generate native invoices, journals and internal payment records after their shared Finance configuration. Every effect uses the existing guarded Finance preparation/execution contract. No financial records are inserted directly. The universe confirmation binds the entire fictional input graph; current module, capability and native role checks remain mandatory on each action and read.

| Default September 2026 scenario | Automotive | E-commerce |
| --- | ---: | ---: |
| Complete generated graph nodes | 5,929 | 4,019 |
| Native sales invoices | 140 | 180 |
| Draft / posted / partially paid / paid invoices | 28 / 28 / 28 / 56 | 36 / 36 / 36 / 72 |
| Native internal payment records | 84 | 108 |
| Balanced journal entries | 196 | 252 |

These counts describe these exact new graphs, not acceptance percentages or public market transactions. Retained older reservations keep their original fingerprints, counts and native records. No existing tenant receives an unconfirmed graph upgrade.

E-commerce invoices use `COMMERCE_INVOICE_CREATE`: the real owned Sales order, readable CRM contact, locked line amounts and seeded legal entity are resolved by the ordinary production contract. Linked orders retain `INVOICE_LINKED`; that status is not a payment claim. Returned orders, cancellations, reserved orders and selected fulfilled orders awaiting billing remain distinct. Returns do not silently become credits or refunds. A remaining unbilled fulfilled order can be billed through structured ZERO after seeding.

Automotive uses ordinary `INVOICE_CREATE` with confirmed synthetic input, guarded current references to its actual Sales opportunity, CRM person and vehicle, and the person's fictional billing address. The invoice retains those native IDs in `demo_source`. This is a scenario-source association, not a new production Automotive sale-to-invoice workflow. The sale amount is explicitly treated as fictional net consideration with an explicit scenario rate; neither public vehicle valuation nor statutory tax correctness is asserted.

The four invoice states provide unpaid, partially paid and paid examples. The native ledger reconciles receivables to posted invoice balances, bank-account debits to internal recorded receipts, and revenue-account credits to posted invoice net amounts. Drafts create no journals. Economic invoice/payment dates use the historical scenario; native creation, posting, audit and receipt timestamps use actual execution time. Every amount uses the existing integer/rational money contracts. No bank transfer, provider settlement, bank reconciliation or external message is performed by seeding.

## Recovery and current authority

The engine retains only owner/universe/node/input identity and the original native preparation source hash in `demo:finance-preparations`. It never rebuilds a different preparation for an uncertain original request. The stable native request retrieves the original receipt after an interrupted cursor write. Finance verifies the receipt and all current effects. The demo checkpoints immediately before and after each mutable command, so a later posting or payment cannot invalidate replay of an earlier command in the same acknowledged prefix.

Only an already prepared action's exact invoice or order dependency may have been changed by that action itself. Such recovery still requires the original native request, current access and an unchanged native receipt result. Other dependencies retain full current hash checks. Unexecuted preparations with a changed source fail closed. A changed committed invoice, ledger account, revoked capability, substituted preparation or changed unversioned payment fails without advancing the cursor. Payment records have a null native revision plus full-record hash; the engine invents no revision.

The server's existing outer transaction atomically commits preparation metadata, native effects and the demo cursor to encrypted storage. A final commit failure restores all of them. The isolated fault preload now targets only that request's final core-state commit: earlier authentication/background persistence and unrelated response events cannot consume its fault. This changes test injection, not production persistence.

## Evidence and limits

Frozen source: `4204035645920374334fc9988bca05419b4fd711`, tree `4daa6cb5f169b767b2de20ebfe1c8e36329bde51`. The unchanged frozen source passes 104 focused native/demo/ZERO cases, fourteen corpus cases and three native suites; the main selection takes 189.592 seconds. The exact completed selection and hashes are recorded in `evidence/20260927-demo-finance-transactions/transactions-frozen-results.json` and the existing checkpoint register. Both full default graphs pass native execution. Bounded real E-commerce HTTP additionally forces setup/posting commit failures, checks rollback across encrypted restarts, destroys a committed payment reply, rejects the stale cursor without duplicating payment, resumes, and then invoices/posts/pays a remaining generated order through structured ZERO.

Preceding complete CI 273 passes published tree `7c11d2ccaa3de19abb64ba9892908139c526c5f9` with 1,880 ZERO and 14 corpus cases; CI 274 passes published tree `053bbb9d11458eca26c5680a59a183011cf5f102` with 1,886 ZERO and 14 corpus cases. The checkout merge, published head, exact tree, parents and raw logs are retained. Those runs do not prove this newer source's full regression.

The initial reduced E-commerce test fixture omitted literal-ID commerce predecessors; its five failures are preserved and the fixture now retains its actual bounded commerce chain. Two HTTP assertions inspected only the API's default first page; explicit pagination corrected the evidence. A later fault-injection attempt returned 200 because the old global fault did not target the final boundary; that failed attempt is retained, and the request-bound final-commit fixture now verifies actual 507 rollback. These are not hidden or counted as passes.

Still open: purchase/expense/COGS and approval histories, credit allocation and refunds, correction/cancellation chains, Automation/Analytics history, complete module controls, real source freshness and forecast/valuation validation, independent natural-language/social/empathy/voice quality, full encrypted default-load measurements and actual desktop/iPhone/Android/HTTPS/download acceptance. No demo is fully accepted or delivered by this checkpoint. These two demos remain first; the preserved remainder of Run 2 resumes only after full demo acceptance.
