# Run 2 workspace recovery

On 2026-09-24 the active `/workspace/scratch/foundly-run2` directory was no longer present after a new user message. The published branch remained available. A fresh checkout recovered published commit `b8232812d9e8bc75995626d74fa0af1b8102c4e2`, tree `eb0c1fa1a5eedc37fc9b162cde748d47954ea641`; GitHub CI 150 independently passed that tree.

The eight unpublished startup/standalone localization changes were reconstructed from the exact edits in this session and tested again. The new test hashes and source hashes are recorded in `checkpoint-tests.json`. This recovery does not establish broader Run 2 acceptance.

The two original work directories recorded in the baseline still exist and were left unchanged. Their previously recorded local preservation refs were not present in the restored filesystem state. This is not evidence that those original uncommitted files were deleted, nor proof that the earlier local snapshot commits are still available. No reset, clean, force push, merge or deployment was used for this recovery.
