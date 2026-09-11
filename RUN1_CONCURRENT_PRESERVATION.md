# Run 1 concurrent execution preservation

Phase 24 remains active. No new masterbuild was started.

This work continues from published Analysis checkpoint f995c0022472eb9f4c7a841706332dccb481c3dc. Older dirty attachment worktrees were preserved. Calendar source was restored from same-run records because its former local files/log/manifest were absent from the restored environment.

The first recovered-source full regression exited zero but three source files changed during execution. That receipt is retained as evidence of a completed command, not as PASS for the changed tree. A new calendar-external.js also appeared. These changes were captured at local preservation commit 847d32827d568478d84fbed1bce9ce47e173ea2c. An isolated worktree then prevented overwriting the concurrent writer.

During the isolated continuation, another execution stream committed/published Calendar checkpoint 1225a069316eed37b06aa3332a8b33355c9e7356 to PR15 and began Finance cash-scenario work in /workspace/scratch/foundly-run1-calendar-resumed. Its unpublished composition-runtime.js, module-access-contracts.js, platform-api.js and finance-cash-scenarios source/tests were observed and left untouched. The PR and that worktree are not targets for this preservation operation.

The isolated source adds durable READING/FAILED/COMPLETE reconciliation receipts, exact request replay without rereading a provider, account-fingerprint selection, guarded bounded Google reads/refresh, all-day and offset/IANA occupancy, rejection of unverified ends, bounded retained observation history with NOT_RETURNED semantics, source-private exports, native conflict/slot/preview revision checks and separate native/ZERO read/disable controls. Disabling is explicit and local; it neither disconnects Google nor deletes provider events. Previous observations remain retained. Differences must be reconciled with the newer published Calendar implementation before promotion; do not replace the newer tree wholesale.

CALENDAR_ISOLATED_EVIDENCE.json records a new full regression with actual exit 0, 375 matching source hashes and 21 passing configuration profiles. The frozen seven source files match the authoritative baseline. No live account, browser, delivery, production or superiority evidence is claimed.

FINANCE_PERIOD_REPRODUCTION.json records a real isolated defect: an overlapping OPEN fiscal period allows posting within a CLOSED period. It was not fixed during the frozen Calendar test and must not be waived. finance-core.js remains unchanged. The other stream's separate out-of-horizon cash forecast defect and remaining recorded Finance/Marketing/Procurement/CRM gaps remain in scope.

This preservation branch is not a replacement PR, release, deployment or final acceptance result. Resolve ownership of the concurrent execution streams before moving PR15 or continuing overlapping integration edits. Main, credentials, OAuth configuration, Railway and production were not changed.
