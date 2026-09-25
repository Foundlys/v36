# Same Run 2: explicit native resumption and durable request recovery

Source `eb9b127be850d9ba483f76fd824e5fd5f400a9d9`, tree `b18abd655869f059aae95bf8ee174d4ca355b0ac`: 774/774 ZERO tests, 14/14 corpus cases and all 31 native workflow suites PASS. Twenty-six permanent tests were added for this checkpoint; 82 related focused tests also pass.

A real HTTP reproduction showed a repeated legacy native execute body advancing a due waiting run. Legacy native HTTP execution now has a durable identity and retries only observe its run. A separate preview and explicit reason-confirmed resume binds the original owner, immutable workflow, exact run/step, activation revision, recovery revision and original inputs. One request cannot spend a later wait or retry attempt. Early confirmations remain consumed after their wait expires.

The browser stores only scoped recovery metadata before dispatch. Lost replies, reload and encrypted restart can recover the exact request without execution. Absent requests close durably; delayed original bodies cannot execute later. Current role/capability, EIO rollback, stale responses and eight locales have targeted coverage. The actual HTTP server now serves the new component, with a permanent exact-content regression. Initial missing-method, cookie-fixture and real 404 failures remain in evidence. Existing native continuation tests retain their effect/restart assertions and explicitly review each new resumption.

Activation/pause predecessor CI 217 completed full regression on the exact published tree. The incomplete prior local npm log remains NON-CONCLUSIVE. Publish this resume source plus evidence to the same PR #21 and verify its own full CI. Do not attribute CI 217 to this newer source.

Continue with native result-recovery request/locale controls and the remaining Run 2 gates. This checkpoint is not global acceptance. No production/main merge, deployment, credentials or Run 3 action.

CI 218 is now **PASS**: run `36152660195`, job `108129517279`, published head `2d778ee1081e13f54c85d70bba1fee97c4aa3e2d`. CI merge `fc28c69492a74600ae134450f03517b43135fabb` has the same tree `739084ba33ba4d0b5d006e84a914fa195273523c`. The complete npm log reaches 774 ZERO PASS / zero failures and all 14 corpus cases PASS.
