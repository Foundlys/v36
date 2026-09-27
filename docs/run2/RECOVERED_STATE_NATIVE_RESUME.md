# Same Run 2: explicit native resumption and durable request recovery

Source `eb9b127be850d9ba483f76fd824e5fd5f400a9d9`, tree `b18abd655869f059aae95bf8ee174d4ca355b0ac`: 774/774 ZERO tests, 14/14 corpus cases and all 31 native workflow suites PASS. Twenty-six permanent tests were added for this checkpoint; 82 related focused tests also pass.

A real HTTP reproduction showed a repeated legacy native execute body advancing a due waiting run. Legacy native HTTP execution now has a durable identity and retries only observe its run. A separate preview and explicit reason-confirmed resume binds the original owner, immutable workflow, exact run/step, activation revision, recovery revision and original inputs. One request cannot spend a later wait or retry attempt. Early confirmations remain consumed after their wait expires.

The browser stores only scoped recovery metadata before dispatch. Lost replies, reload and encrypted restart can recover the exact request without execution. Absent requests close durably; delayed original bodies cannot execute later. Current role/capability, EIO rollback, stale responses and eight locales have targeted coverage. The actual HTTP server now serves the new component, with a permanent exact-content regression. Initial missing-method, cookie-fixture and real 404 failures remain in evidence. Existing native continuation tests retain their effect/restart assertions and explicitly review each new resumption.

Activation/pause predecessor CI 217 completed full regression on the exact published tree. The incomplete prior local npm log remains NON-CONCLUSIVE. Publish this resume source plus evidence to the same PR #21 and verify its own full CI. Do not attribute CI 217 to this newer source.

Continue with native result-recovery request/locale controls and the remaining Run 2 gates. This checkpoint is not global acceptance. No production/main merge, deployment, credentials or Run 3 action.

CI 218 is now **PASS**: run `36152660195`, job `108129517279`, published head `2d778ee1081e13f54c85d70bba1fee97c4aa3e2d`. CI merge `fc28c69492a74600ae134450f03517b43135fabb` has the same tree `739084ba33ba4d0b5d006e84a914fa195273523c`. The complete npm log reaches 774 ZERO PASS / zero failures and all 14 corpus cases PASS.


## Forecast snapshot browser checkpoint — 2026-09-25

Native snapshot recovery publication `2ce7456` has exact full CI 234 PASS: merge `473544ecf8e9b1f3dce409f2379d6d87cda95ded`, tree `e453f2ae82423f9167ca27e97e50f19d4746f533`, 1099 ZERO plus 14 corpus.

Snapshot browser source `5e9c32378734f4bb9f5d22bffc920d9016b4af68`, tree `17ac548cfc1afaac649716a46afb7f1843fcf110`, passes 1122 ZERO plus 14 corpus and all eleven affected native commands. It adds 23 permanent client/shared-page/HTTP tests and replaces the shared page blind replay with scoped metadata recovery. Failed startup evidence and the unchanged-tree rerun are retained in checkpoint-tests.json. Full exact-published CI is still pending.

Continuation is already isolated in `work/run2-forecast-observations`: forecast readout/filter/scenario localization, typed observation validation and a reproduced large-amount weighted-cent rounding defect. Do not overwrite that newer work or restart discovery. Hierarchy definition recovery and broader Run 2 gates remain open; no final acceptance is claimed.


## Forecast observations checkpoint — 2026-09-25

Snapshot UI publication `9a252128894841c24ccc97f49a1b598773331347` has complete exact CI 235 PASS: merge `7b8c3d474357013b2aeb3a607ce409b253d91a42`, tree `30877ad7632a1af04f567f42d1af716b9531a622`, 1122 ZERO plus 14 corpus.

Forecast observations source `4890b4cec031413b30f8f37615c613b839389ed9`, tree `95b3ce69409f158f03aecaaa3c0be8ba55696f8a`, passes 1138 ZERO plus 14 corpus and eleven affected native commands. Sixteen permanent tests cover typed observations, exact weighted cents, eight-locale readouts, literal assumptions, fractional-input rejection and draft preservation. Exact-published full CI is pending.

Continue the already-started native hierarchy version recovery work in `work/run2-hierarchy-recovery`; preserve its new journal, fixtures and fault-test fixes. Hierarchy UI localization/reload recovery and the broader acceptance matrix remain open. No final Run 2 verdict or real-browser accessibility acceptance is claimed.


## Execution environment disconnected — exact preservation checkpoint

Forecast observation publication `a3d7b915239394a519a3b924206bf4757aaed0e6` has complete exact CI 236 PASS: merge `28e7c4bfbb2c77fc6cd87246d554326b96df2a2f`, tree `5112c5bc53529b0ab9b5dd26eb4acd07fd8894a2`, 1138 ZERO plus 14 corpus. The merge tree was verified through the GitHub Git-data API after the execution environment went offline.

Native hierarchy recovery source `1ad5e59c025b4bd00cfdc28d0935c32b2a225487`, tree `ed14e3337965ba36620d0c1ae9017e457f76f205`, passed 15 new native/HTTP tests and all 14 affected native regression commands. Its full local ZERO command was running in session 31297 when exec-server became unavailable; that result is UNVERIFIED. The eight source/test files were reconstructed through GitHub and the resulting tree was verified to equal the exact frozen local tree before publication. This preserves the newer valid work without claiming missing full-test evidence.

Current failure: exec-server returned 409 `environment_offline` / `Environment is not connected`. The first hierarchy UI test-authoring command failed to create a process. No main merge, deployment or credential changes occurred.

On reconnection, preserve all existing worktrees and logs. Inspect the full ZERO result before rerunning it. Continue the already-created `work/run2-hierarchy-controls` worktree (based on the native hierarchy recovery source), starting with the three shared-page regressions: locale/input/confirmation retention, one PUT plus metadata recovery after a dropped reply, and fresh-page recovery with only opaque metadata stored. Wire `/api/sales/forecast/hierarchy-requests/recover`, add typed catalog/context and exact acknowledgement/proof checks, and localize the hierarchy editor/query controls across all eight locales. Existing scenario/node totals, immutable-version, native access, stale-response and snapshot assertions must remain. Keep literal owner IDs, labels, names and entered definitions intact. Broader Run 2 remains IN_PROGRESS_NOT_ACCEPTED.
