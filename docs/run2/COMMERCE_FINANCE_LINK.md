# Native CRM, commerce order and Finance link

The confirmed COMMERCE_INVOICE_CREATE action resolves an actual owned Sales order, a currently readable CRM contact and the selected native Finance legal entity. The caller selects their IDs, invoice number and explicit dates. Prices, quantities and supplied tax rates come from the locked order lines; customer and supplier billing fields come from the selected native sources. A later catalog price does not rewrite an order. Public reference prices are not accounting evidence.

Preparation returns the exact derived draft and a source hash. A changed order, customer, legal entity or duplicate-number state requires new preparation and confirmation. Missing billing data, incompatible currency, returned order lines, prior invoicing and mismatched totals prevent execution. This version accepts a bounded single-line CRM billing/address string; generalized structured addresses and other tax regimes remain separate work.

The draft invoice, its lines, Sales order link, native audits, both event outboxes and the confirmed request receipt commit together in the existing encrypted store. The adapters must share the actual transaction buckets. An injected persistence failure rolls all of them back; events are delivered only after the commit. The Sales order is labelled INVOICE_LINKED, which does not assert posting, settlement or payment. Its original free-text customer reference remains separate from the confirmed CRM contact ID and revision. Private CRM billing text is not copied into the Sales order.

PREVIEW, EXECUTE and RECOVER are available through the existing Finance native API and structured ZERO finance_action route. Execution and recovery require current Finance and Sales write authority, Finance ledger read and CRM contact read authority. CRM write is neither required nor granted. Module composition controls tool visibility. Current order/product visibility and contact authority are checked before an original linked receipt is released. Recovery retains the original draft alongside current invoice/order/contact observations. It does not recreate a financial command. An absent recovery permanently retires its request ID so a delayed original cannot execute.

Linked-order cancellation is refused until an explicit financial correction exists. Stock returns remain native stock operations with RETURN_REVIEW_REQUIRED on the linked order. They do not silently generate a credit, refund, incoming payment or external settlement. Partial credit allocation/refunds, complete cancellation handling and their controls remain open.

## Evidence

The exact immutable source and tree, full ZERO/corpus/native results, retained failed attempts and compressed log hashes are recorded under commerce_finance_link_20260926 in checkpoint-tests.json.

Six unit cases exercise locked order pricing, CRM/supplier selection, atomic rollback, restart/replay, changed source hashes, current ownership/capabilities, separate original/current results, linked returns/cancellation, absent-request retirement, adapter mismatch and CRM read without write. Unit event and persistence adapters are explicit fixtures.

One real HTTP case uses actual CRM, Sales, Finance, identity, composition and encrypted storage. It prepares via ZERO, rejects a changed CRM source, destroys the committed billing reply, restarts the server, recovers one invoice/order link, and then posts and records a payment through native ZERO. The actual reports contain net revenue 303 and VAT 64 minor units for a gross 367 fixture order. The retained original draft and current paid invoice are distinct. Revoking CRM capability hides/denies the bridge while the Sales order exposes no private billing snapshot. No real payment or message is sent.

The full composition matrix also checks Finance-only, Finance+CRM, Finance+Sales and Finance+CRM+Sales visibility through actual server configuration and encrypted restart. Its first attempt retained an outdated assumption that every Finance tool is standalone; the corrected expectation keeps the cross-module dependencies explicit and preserves the failed log.

## Delivery scope

This proves a native confirmed cross-module transaction in a GENERAL tenant; it does not by itself register the ECOMMERCE pack or complete either priority demo. Full financial/workflow histories, credit/refund corrections, localized user controls, natural-language and voice quality, current market valuation, complete seed performance, downloads and physical iPhone/Android/desktop installation remain open. The preceding Finance CI 268 passed on the published tree and is preserved separately. Automotive and E-commerce with all nine modules and ZERO remain the first delivery block; all earlier work stays retained.
