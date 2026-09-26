# Bounded native demo seed persistence

CI 270 failed on the published E-commerce checkpoint: the bounded real HTTP E-commerce seed/billing case exceeded the fixture's 15-second request timeout during the full test suite. The run ended with 1,839 passing ZERO cases and one failure; the corpus command did not run. The same earlier immutable source had passed locally with concurrency 2. Both outcomes and the complete failing CI log remain retained. This failure is not counted as a complete pass and no timeout was increased.

## Work and durability boundaries

The existing `limit` is now explicitly a maximum number of nodes per request. A monotonic 1,000 ms work budget yields after the current native command and its real checkpoint. Returned batch metadata reports actual applied nodes, requested limit, elapsed time and the yield reason. Callers continue from the current server cursor, including after a lost response. A single native operation, manifest validation, final persistence and notification work may exceed the soft work budget; this is not a hard latency guarantee.

In the actual server, each advance uses an opt-in synchronous transaction over the existing memory, record, decision, task, event and worker-state maps. Every native module/role/object check, exact revision, idempotency receipt, synthetic provenance and audit step still executes. Intermediate persist calls are deferred. The complete node prefix and engine cursor are then encrypted, fsynced and atomically renamed together using the existing writer. No successful response is returned before that durable boundary.

A native exception or failed final write restores the maps and prior dirty state. The current derived-fact cache is retired on rollback so it cannot show events from the discarded candidate. Earlier committed prefixes stay present. A process loss before the durable boundary leaves the preceding disk snapshot; a lost response after commit is recovered from the new cursor. Adapters without the outer transaction keep the already tested native per-command/checkpoint recovery path.

The transaction accepts synchronous internal callbacks only and rejects reentry. It does not wrap ordinary customer operations, alter the global file format, replace fsync/atomic rename, grant permissions or bypass the isolated-empty-demo gate. The HTTP runtime applies it only through the private demo-engine adapter. There is no client flag that enables deferred persistence for another operation.

## Event delivery and cache correctness

Canonical events and their notification outbox commit with the underlying records. Platform subscriber delivery is deferred while the outer boundary is active. After successful persistence, the normal native notification flusher runs in bounded groups. Delivery failure leaves a retryable outbox state and cannot roll back already committed business effects. Delivery is at least once; event IDs and native receipts remain the identity, not a claim of exactly-once network delivery.

An actual HTTP fixture forces the final encrypted rename to fail, checks zero acknowledgement and unchanged native records, restarts and explicitly retries. A second failure occurs after warming the real Analytics fact cache, immediately before a CRM lead event. The subscribed SSE client receives no uncommitted event, the funnel and lead count stay unchanged, and the same client receives the successful event after retry. Actual prior-prefix preservation, private at-rest encryption and stale-cursor refusal remain checked.

The existing real E-commerce lost-reply/restart/order/invoice/posting/internal-payment test remains in place. Its cursor checks now use actual acknowledged progress instead of assuming the requested upper limit was completely processed.

## Measurements and remaining work

The full 3,575-node E-commerce graph is being measured through the actual encrypted HTTP runtime, followed by the fourteen Dutch conversation scenarios. Separate runs retain the earlier per-command persistence and the batch implementation, with incremental cursor/timing reports and content-free file-I/O counts. The benchmark uses the same fixed scenario, all nine module entitlements and no model provider. Other local regression work may overlap; these are local diagnostic measurements, not isolated load, phone or end-user latency guarantees. Final results and exact source identities belong in checkpoint-tests.json only after completion.

Complete Finance/Automation/Analytics histories, correction/refund paths, complete commerce/Finance action controls, full model/social/voice acceptance, source freshness/valuation and desktop/HTTPS/physical-device delivery remain open. This persistence correction does not accept a finished demo.
