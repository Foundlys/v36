# Same Run 2: exact shared approvals

Current published baseline 7b7f8df passes CI 215 full npm regression. The earlier restart fixture correction passes CI 214. CI 213 remains a recorded failure.

Shared approvals now have an immutable reference, atomic grant/receipt/audit reservation, non-executing replay/reconciliation and durable absent-reference closure. Original native callers also cannot use repeated approval as a due-run resume. Current authority applies before replay. Reload recovery remains visible when the run has left the approvals list. Private content is absent from browser metadata. Eighteen new permanent tests and 55 focused controls PASS; all 13 involved native regression suites PASS. Real HTTP confirms dropped response, encrypted restart, held bodies, EIO and revoked roles.

Frozen source `84e832614d11084f191045826b63ddc29a1d5178`, tree `ccc79d604d4f65e8462f7d4f5b426f973ebf9aa8`: 729/729 ZERO tests and 14/14 corpus PASS. Publish the identical tree and inspect its own CI. Then continue activation confirmation/recovery and explicit resume/result-recovery controls, followed by every remaining authoritative acceptance gate. Broad matrix remains unchanged; no main, production, credentials, deployment or Run 3 action.
