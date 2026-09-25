# Same Run 2 recovery — 25 September 2026

The new chat restored an older local checkout: a0eb386, tree 597fd2398410c217ae299ce0f9345b1f3d76c88a. Tracked/index changes and stashes were absent; the untracked Python cache and unrelated worktrees were left intact. A preservation branch retains that entire local history. Fetch and a normal merge recover published PR 21 head db6dd86, tree 1cf8f2fe24d611f32c12780782da4b35610aa5ed; the merged local tree is identical. Main stays e8142578. No prior test process or newer unpublished source checkpoint is available in this restored filesystem.

The published evidence records full ZERO 700/700 and corpus 14/14 PASS on frozen source 76d01d4. This supersedes the attachment's still-running status; that completed suite is not repeated merely for recovery. CI 213 (36139289432, job 108084869223) subsequently FAILS with ZERO 699/700. Its one failure was independently reproduced locally: the HTTP restart fixture assumes restarting and logging in consumes the entire one-second delay. A fast restart invalidates that assumption before recovery is called.

The fixture now waits for the actual stored next_wakeup_at, with an explicit finite timestamp and one-second bound. It still asserts the delay is due, recovery preserves WAITING_TIME, no document is created, and a separately requested native resume creates exactly one document. No production source, assertion, provider timeout or CI budget is weakened. The failure remains part of the record. Corrected-tree validation is pending.

Continue shared manual execution, recovery/approval/activation controls and the remaining authoritative acceptance matrix after publishing the corrected tested tree. Run 2 remains unaccepted. No main merge, deployment, runtime, credential or Run 3 change.

Corrected frozen source `4e963888726f10a883fc9daf5330967229cea01a`, tree `3ad64f201583b0c9b05d1caa6e183665cf2be558`: 28 focused controls PASS; full ZERO 700/700 and 14/14 corpus PASS, process exit 0. Exact-head full regression CI remains required.
