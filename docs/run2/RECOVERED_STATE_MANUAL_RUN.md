# Same Run 2: native manual execution

Native manual requests now require exact preview and confirmation. The production controls use the same validated run-result and metadata-only reload recovery contract as ZERO. Repeated or uncertain manual requests only read retained state and cannot resume a due wait; separately requested resume remains separate. Changed input after uncertainty cannot create another document. Locale switching preserves inputs and full literal review; both entrypoints share the input lock.

Eleven new permanent tests; 53 focused controls PASS. All affected native suites PASS. Frozen source `b1ca39b0a6da4bf798e51b2db79d5301d2533271`, tree `9364625518cb165e8a1e35cf325b9d0f48ff1d5c`: 711/711 ZERO and 14/14 corpus PASS. Real HTTP tests prove encrypted restart, lost response, terminal closure of held requests, storage rollback and mid-body current capability. Initial regression and localization failure remain recorded. Exact-head full npm CI is required after publication.

Next: shared approvals, explicit resume, recovery and activation confirmation/reload. Wider 125-row matrix remains unaccepted. No main/production/credentials/deployment or Run 3 change.
