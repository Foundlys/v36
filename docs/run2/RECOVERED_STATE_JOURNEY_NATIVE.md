# Same Run 2: native journey recovery and execution proof

Frozen source `0225146dfc910d51f3def7503686f408c0e161de`, tree `089f18dba18e2019801aed5436ed93e091b3abc7`: all 944 ZERO tests, 14 corpus cases and eight affected native commands PASS. Twenty new tests cover all seven operation families, original/current native side effects, native and ZERO HTTP loss, encrypted restart, held body retirement, persistence rollback and identity revocation. This source needs its own exact published complete CI.

Definition, enrollment, advance, task completion, pause, resume and cancellation now have six-field metadata recovery and bounded private receipts. The original result and native task/draft output remain separate from later current records. Recovery cannot execute a step, resume a journey, complete a task or send a message. Closing an absent request durably blocks its delayed body. Current source and output ownership, access and capability checks still apply. Receipt persistence is atomic with existing native records, history, audit and event queues; legacy results do not gain invented typed proof.

Two reproduced defects are fixed: a definition ID could acknowledge different confirmation reasons, and an old task completion could return a reopened task as a successful deduplicated completion. Exact reason binding and retained task revision proof now prevent those acknowledgements. Native HTTP and ZERO use the same explicit request identity, with original legacy fingerprints preserved. Typed read observations include current request context.

The manifest retains the baseline failures, authorization error-code fixture corrections and two empty redirected unit logs as non-conclusive evidence. Final native unit TAP output and the clean frozen full ZERO/corpus run are complete. Audience controls have exact full CI 227 PASS.

The immediate continuation is the journey production UI: localized controls, scoped browser recovery, strict native outcome verification, source pagination, preserved literal input and pending state, current denial and retired-view safety. Other genuinely open Run 2 gates remain open. No main merge, deployment or Run 3 action.
