# Automation drafts

Partial editor documents live in the existing encrypted store under `platform:automation_drafts`. Drafts are not executable definitions and are never examined by the scheduler. Saving an unfinished document cannot create a task, run or workflow. Publishing a valid workflow version remains a separate existing API operation.

Read, save and retained export require current Automation permissions. Drafts are private to their creator, including when another caller is an administrator. Shared Data and ZERO record projections exclude draft contents. Audits record draft ID and revision without editor contents.

Each save supplies the last observed revision. Exact last-request retries acknowledge a previously persisted save; conflicting edits return 409. Client saves are serialized. A conflicted editor retains its local input and can store a separate new draft. The server transaction restores the draft and audit buckets if persistence fails. Per-owner and per-tenant counts and payload size are bounded.

The existing sequential editor restores saved drafts and autosaves changes after a short delay. Users can also save immediately. A successful draft save is distinct from publishing an executable version. Browser rendering and interactions remain unproven because the available browser could not load the local acceptance fixture.

Tests cover incomplete definitions without effects, current owner and role boundaries, concurrent saves, response loss, revision conflict, rollback, encrypted HTTP restart and retained export after disabling Automation. No provider access or production deployment is claimed.


Nested condition groups

The editor supports EN/all and OF/any groups with at most five nested levels, twenty children per group and two hundred nodes per action condition. Drafts may remain incomplete; compilation rejects empty groups, missing or invalid values and malformed controls. Only an explicitly disabled condition or an absent condition omits the action guard. Persisting a draft preserves its bounded condition tree exactly and does not create an executable workflow.

Workflow definitions validate the full action list before storage and again before any manual, scheduled or resumed execution. Explicit false/null/scalar conditions, ambiguous groups and malformed descendants cannot become unconditional execution, even behind a matching OR sibling. Invalid retained records are preserved and diagnosed. Unconditional steps preceding a malformed condition also cannot execute. Actual DOM-handler and native HTTP/restart evidence is distinct from unproven browser acceptance.
