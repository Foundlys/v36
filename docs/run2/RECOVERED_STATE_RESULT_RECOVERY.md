# Same Run 2: native result reconciliation and request recovery

Source `3d5504e284ae16228ab0fd8d29d2f4619b791080`, tree `45adf5e385b074bb22fca54b3075c98eff8a6caf`: 792/792 ZERO tests, 14/14 corpus cases and all 31 native workflow suites PASS. Eighteen permanent tests were added; the final shared readout and native UI checks also pass.

The old raw recovery form could not recover an uncertain confirmation after reload and had untranslated Dutch controls. The shared component now requires exact evidence, a reason and a separate checkbox. It distinguishes a proven absent result from a proven completed internal step. Reconciliation records only the reviewed step; execution requires the separate resume flow. Locale switching preserves the same inputs, evidence, control nodes and pending identity.

The native receipt commits atomically with the run, recovery history, audit and event outbox. Exact retries and lost-reply/reload/restart recovery observe the original request. An absent request can close permanently, preventing delayed bodies from applying it later. Current owner, capability and member checks remain effective after body waits. Metadata is excluded from generic Data, browser storage contains no reason/source content, and storage failure rolls the mutation back. Actual HTTP tests verify the served script and real native persistence/identity paths.

The six initial missing-contract failures and locale-dependent fixture failures remain in evidence. The updated native UI test retains its absence, effect-count and changed-source proof; it now uses the actual shared page instead of extracting removed inline code. It does not claim browser layout acceptance.

CI 218 fully passes for the preceding resume publication with matching published/CI trees. Publish this newer result-recovery tree plus evidence and inspect its own full CI. Continue with shared draft/template controls and remaining Run 2 gates; no global acceptance claim, production/main merge, deployment, credentials or Run 3 action.

CI 219 is now **PASS**: run `36154382373`, job `108135239266`, published head `9934a32463b83e62f5a65e0843e9be1f860103de`. CI merge `d2c98770183e97a86af0960bd6c23544d4a9b22d` has the identical tree `2fc19c4f66b6ec119c8c5d5e74d6a1487c92c345`; complete npm output reaches 792 ZERO PASS and 14 corpus PASS.
