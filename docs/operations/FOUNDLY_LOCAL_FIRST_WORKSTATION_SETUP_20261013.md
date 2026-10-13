# FOUNDLY OS — Local-first 24/7 workstation installation and operations contract
**Decision: 13 October 2026.** Scope: preserve the ORIGINAL canonical ZERO Run 2 and the two-product commercial runplan; configure **as much processing as technically safe and quality-equivalent locally as possible**, with cloud only where necessary. **This GitHub file is documentation, NOT a claim that the founder Windows machine has been accessed, configured, installed, tested or launched. Codex handles implementation when explicitly authorized.**

> **Key risk discovered in the actual repository:** `Foundlys/v36` is a **PUBLIC GitHub repository**; `.github/workflows/ci.yml` already uses `ubuntu-latest` and `node-version: 20`, `npm install --ignore-scripts`, `npm test`. **DO NOT register the owner's sensitive always-on RTX workstation as a GitHub Actions self-hosted runner of this public repo.** GitHub explicitly warns that external pull requests can execute malicious code on self-hosted machines. Preserve GitHub-hosted CI for public PR checks; do not weaken permissions/secrets. Use a separate local task scheduler restricted to reviewed SHA/approved branches, or isolated clean ephemeral VM/runner attached only to an appropriately secured PRIVATE repository after separate security review.

## A. Operating system and software baseline

Default proposed stack **if founder workstation runs Windows 11** (OS has not been verified, so inspect first):
- Windows 11 fully updated + official NVIDIA Studio driver or a GPU driver confirmed stable for this RTX 5080; GPU telemetry `nvidia-smi`, actual CPU/RAM/storage check; Windows sleep/hibernation/reboot/thermal/SMART monitoring. A 24/7 desktop is not a production server.
- WSL 2 + Ubuntu LTS, with project and container mounts **inside WSL ext4** at `~/foundly/v36`, never primarily under `/mnt/c` due to filesystem performance and file-watcher behavior.
- Docker Desktop with WSL2 backend and enabled Ubuntu integration; GPU Linux containers only after WSL/NVIDIA GPU verification. For licensing/scale verify Docker Desktop's actual commercial terms.
- Git, Visual Studio Code/WSL, Node.js via nvm, package manager already required by repository (npm; no unnecessary pnpm migration), Playwright only after Codex integrates a real E2E harness, local file/artifact logs. Database/service containers only if and when repository requires them; no invented Postgres migration.
- **Critical current repo security debt:** Node 20 is already EOL as of 30 April 2026, while public CI uses node-version 20 and Dockerfile uses node:20-alpine. Codex should separately verify compatibility and propose **Node 24 LTS migration**, frozen full regressions on a staged branch, then change public CI/Dockerfiles together on founder approval. Do not silently flip runtimes before baseline test.

### Windows PowerShell (administrator for WSL installation only)
```powershell
wsl --status
wsl --install -d Ubuntu
wsl --update
wsl --list --verbose
nvidia-smi
```
If WSL is already installed, do not reinstall; `wsl --install` may require reboot. Confirm Windows GPU driver after update. Actual RAM/core and GPU VRAM must be recorded first.

### WSL Ubuntu shell — safe local repository baseline
```bash
sudo apt update
sudo apt install -y git curl ca-certificates build-essential jq
mkdir -p ~/foundly
cd ~/foundly
git clone https://github.com/Foundlys/v36.git
cd v36
git remote -v
git status --short --branch
git fetch origin --prune
git switch -c local-run2 --track origin/feature/run2-zero-intelligence
git rev-parse HEAD
```
Use a separate local branch/worktree for independent tests and changes; do not overwrite uncommitted or accepted work. Reconcile GitHub `main`, PR #21 HEAD, staged/untracked/stashes and acceptance matrix BEFORE any modification. Never check in secrets or real customer data.

**Node:** repository CI currently demands Node 20, which is EOL. To reproduce its historic behavior, if needed use an isolated disposable test container/VM pinned to Node 20 for comparison; for new long-lived workstation/production work use Node 24 LTS **after Codex validates full compatibility**. Install signed official Node/nvm packages using verified vendor instructions rather than blindly executing unreviewed install scripts; then check `node --version`, `npm --version`. Once compatible, use the same exact install/test contract as CI:
```bash
npm install --ignore-scripts
npm test
npm run test:crm
npm run test:composition
```
Current `npm test` already invokes several sub-suites; the separate commands above are for targeted repeat runs, **not additional independent acceptance evidence or costs**. Reproducible test results must capture exact git SHA and process exit code. Some integration/live provider test scripts require legitimate secrets/sandbox and must NOT be unconditionally run on the local workstation or assumed PASSED.

**Docker Desktop:** activate Settings > General > WSL 2 based engine and Settings > Resources > WSL Integration for Ubuntu. To test container GPU access, only use official documented GPU examples. For local staging bind to `127.0.0.1` by default and use isolated fixture credentials, not production secrets.

**WSL resources (after actual RAM verification):** suggest an initial `%USERPROFILE%\.wslconfig` memory cap around 50–65% of installed physical RAM, e.g. `memory=40GB` for 64GB machine or `memory=80GB` for 128GB, and `swap=8GB`. Do not fix CPU allocation until real core count, thermal load and concurrent Windows/gaming use are measured. `wsl --shutdown` re-applies WSL settings but stops current WSL tasks; use only at approved maintenance time. This is an initial tuning suggestion, not a benchmarked optimum.

## B. One trusted local model service — never call it a full replacement for Sol/Astra

Install **Ollama locally** (Windows or WSL, choose ONE instance to prevent port collisions; recommended inside WSL for consistent local Codex integration if NVIDIA GPU passthrough works). Do not enable Ollama cloud mode, `*:cloud` model tags, remote Ollama signup, or bind model inference to public `0.0.0.0` without explicit approval. Default loopback: `http://127.0.0.1:11434`. Official Ollama Linux install can be done using the vendor's published instructions after reviewing its installer. Start service on systemd only after localhost access and logs have been inspected.

**RTX 5080 16GB VRAM realistic first tests:**
- `ollama pull qwen3:8b` (~5.2 GB model) for cheap local draft/categorize, extraction or prompt templating.
- `ollama pull qwen3:14b` (~9.3 GB model, with additional KV cache/activations; benchmark VRAM) for higher-quality experimental local analysis/review.
- Optional `gpt-oss:20b` as a heavier candidate, but **do not assume 64k context fits fully on 16GB VRAM**; CPU offload may be slow and cause higher electricity/wall-clock cost.
- Note `qwen3-coder:30b` Ollama official image ~19 GB **exceeds the GPU's 16GB VRAM** before KV-cache; use selective CPU offload only after speed/quality tests or after a future GPU upgrade. Large local model downloads/weights/context are not the same as optimized multi-agent Codex.
- Ollama officially recommends **at least 64k context tokens for Codex**; some small Qwen family variants expose native 40k context, so **use them first for isolated short tasks, NOT an automatic high-quality 64k-context Codex substitute**. For any local Codex tool workflow independently verify current supported model/context and actual end-to-end source edits/tests.
- Sample only AFTER installing official Ollama:
```bash
ollama list
ollama pull qwen3:8b
ollama run qwen3:8b
ollama ps
```
For a supported local agent session with CLI version and compatible Ollama model/context, the official integration supports `ollama launch codex` or `codex --oss` with correct installed model. **Always separately benchmark** real task completion/quality/correctness/security relative to normal Codex with Sol before routing any canonical work. Local drafts are NEVER auto-accepted Run-2 cognition, human voice, global design benchmark, Meta/Wix/Shopify security/legal approval.

### Important concrete ZERO router incompatibility identified from actual Run-2 code

The existing `feature/run2-zero-intelligence/zero/router.js` does NOT simply accept local Ollama through an environment override. Current `registry` validation explicitly **requires HTTPS** and rejects `localhost`, `127.*`, `10.*`, `192.168.*`, `169.254.*` hosts (as part of SSRF-sensitive provider URL controls). Therefore:
- **Codex CLI in WSL** can separately run a supported Ollama local `--oss` session, as an external DEVELOPMENT TOOL independent from FOUNDLY ZERO Core.
- **FOUNDLY ZERO itself** must NOT be pointed to `http://localhost:11434/v1` and must NOT loosen the existing global URL/SSRF filter to force it. Doing so would make unaudited proxying and target-injection possible.
- If a local model is proven worthwhile inside ZERO R&D, Codex must author a **separate explicitly dev-only loopback inference adapter** bound to a fixed preconfigured loopback socket with no user-settable arbitrary endpoint, no incoming public network access, explicit no-secret/fixture-only inputs, disabled entirely in production by default, tests for SSRF/IP tricks, role/tenant and model quality. Production usage, if later approved, requires a distinct audited local inference architecture and measured availability/tenant security. Do not assume local model routing is a configuration-only change.

## C. Explicit local-first execution router (founder quality and human approvals)

| Job class | First attempt | Fallback and release restrictions |
|---|---|---|
| Builds, lint/static checks, unit/integration deterministic tests, sandbox browser, snapshots | **Always local** isolated, CPU/GPU as needed | GitHub hosted independent CI still runs on PR; local PASS alone not release PASS |
| Controlled visual 3D preview, Blender export, screenshot diffs, accessibility/locales layout | Local workstation, automation possible | Senior Astra/Work visual/manual acceptance for genuinely challenging quality |
| Fixture/dummy-data generation, log analytics, search index, translation initial drafts, text extraction | Local CPU/GPU/small language model where proven adequate | Human language/domain and source permission verification |
| Bounded coding/simple changes | Candidate local model only after repository tasks prove same pass rate, time and diff quality | GPT-6.1 Sol Codex when local underperforms; measure cost PER ACCEPTED OUTCOME |
| Architecture, complex cross-module tool design, adversarial/risky security, high-value marketing/3D creative QA | Sol / Astra as quality requires | Human/Work independent review remains blocking |
| Actual approved Meta WhatsApp, Wix/Shopify/Woo OAuth, online website/browser API/live payments | Legitimate external sandbox/provider | Never fake, bypass, or replace real provider receipts with local mock traces |
| Public SaaS ZERO production | Dedicated secured scalable cloud model router with actual quality/cost policies | Founder PC NOT 24/7 commercial hosting; optional local R&D is not guaranteed production SLA |

**Local-first IS NOT cloud-free.** Local test and cloud inference/agent cognition are different meter categories. Local execution can reduce repeat tokens/evaluation costs only after it substitutes genuine paid calls at equal accepted quality.

## D. 24/7 schedule, security isolation and workload capacity

**Highest priority ZERO Run2 persists until G1 acceptance**; all other work must not restart it or modify its accepted frozen source without an approved change.
- During live founder/Codex sessions: bounded implementation, real model/UI/user intent evaluations, complex provider sandbox experiments, approved diff/test/review/commit/rollback.
- Outside active sessions: only **pre-approved deterministic** local CI, static lint/scan, browser regressions, 3D renders, non-sensitive test data generation, metrics and backups. Windows Task Scheduler may start WSL task commands after startup; WSL systemd service schedules only work reliably if WSL distro stays running. Require clean shutdown and restart recovery, rate/concurrency limits and log rotation. No unbounded/unsupervised model-credit cloud loop; old autonomous ZERO developer supervisor stays cancelled.
- WSL folders: `~/foundly/v36` canonical local repo; worktrees `~/foundly/worktrees/...` for independent branches; `~/foundly/artifacts/...` for test evidence; **sensitive `~/foundly/secrets` inaccessible to test jobs**. Keep real production tokens in dedicated secret store, not repo, plain `.env` in shared logs, fixture dumps or screenshots. Full disk encryption, OS MFA, backups and rotated keys.
- Configure startup monitor for CPU/RAM/GPU VRAM temp/thermal throttle/NVMe SMART/disk use/service uptime and `GIT_SHA`/test cost ledger; bound parallel jobs by actual measured RAM/VRAM saturation and full pass rate.
- No untrusted public-PR code execution on founder machine. GitHub-hosted `ubuntu-latest` CI remains external, permission `contents:read`; local scheduler only trusted reviewed/pinned commit/branch under owner control. Before any self-hosted runner approval, require separate security review and private/isolated setup; **never register this personal machine against current PUBLIC `Foundlys/v36`**.
- No public inbound ports for RDP, SSH, Docker socket or Ollama. If remote personal access is needed, use authenticated private VPN/tunnel with least privilege and MFA after security review, not router port-forwarding or unprotected server. The 8Gbps number is max speed, not test throughput, AI provider quotas or guaranteed low latency.
- Keep dedicated Railway/other production backups, monitoring and independent cloud staging; no single founder PC failure should stop paying customers.

## E. Measured spend/routing strategy (NO unsupported savings claim)

7-day G0 calibration records:
1. **Real device** OS, GPU VRAM, RAM, SSD, net throughput, thermals and reliable daily uptime.
2. Source SHA, GitHub CI pass/fail, local deterministic regression duration and pass count for identical code (as opposed to model turn costs).
3. 20–30 representative **real Codex Sol** jobs and, where justified, sample Astra jobs; actual input/cache/output tokens, model credits debited, successful accepted outcomes/independent eval.
4. Local model attempt on same safe fixture/tasks and measured speed, quality, source truth/permissions; local failure retry overhead and human validation hours.
5. Unit metrics `credits_per_accepted_gate`, `eur_per_accepted_feature`, `local_cpu_gpu_kwh_per_validated_build`, `p95_task_minutes`, `acceptance_failure_and_rework_rate`, `local_vs_cloud_quality_delta`.
6. Real provider owner access / approval lead times from Meta, Wix, Shopify, Woo; independent external spend.
7. Update P50/P90 timing and credits after this pilot; **old 530,400-credit central envelope remains a conservative capacity plan, NOT expected metered consumption or pre-purchase amount**.

Do not disable the official GitHub-hosted CI just because local tests PASS. Set workspace credit caps and require explicit founder permission for subscription spend, secrets, production CI runs that require real external APIs, deployment or destructive actions.

## F. Suggested founder setup and code governance acceptance gates (ALL UNVERIFIED until real workstation evidence)

| ID | Must demonstrate before local-first mode is claimed active |
|---|---|
| LOC-001 | Real OS/CPU/RAM/RTX 5080 NVidia driver/VRAM and link throughput inventory with no sensitive values logged. |
| LOC-002 | Current WSL2 or equivalent Linux + Docker GPU verified, WSL source on Linux ext4, stable resource limits. |
| LOC-003 | Canonical Run2 worktree/PR HEAD reconciled, local deterministic regression at exact SHA and current GitHub hosted CI preserved. |
| LOC-004 | No Node20 EOL exposure accepted in long-term production path; separate Node24 test+compatibility migration planned/approved. |
| LOC-005 | Local Ollama loopback service and at least two model profiles tested, no internet-exposed API/cloud-accidental route, CPU/VRAM measured. |
| LOC-006 | Real local versus Sol comparison of code quality/success/elapsed/credits on minimum 20 representative tasks. |
| LOC-007 | 24/7 local deterministic scheduler safe restart/thermal/concurrency/secret/log protections proven; no unauthorized cloud auto-spend. |
| LOC-008 | Public repository CANNOT trigger self-hosted runner on founder machine; all PRs still independently checked on GitHub-hosted Ubuntu. |
| LOC-009 | Local ZERO sandbox no live customer data/secrets; privacy/tenant boundaries, provider actions only in authorized real sandbox. |
| LOC-010 | 7-day actual monitoring report; approved budgets, credit forecasts calibrated, founder and Work acceptance of production impact. |

### Primary sources checked 13 October 2026
- Microsoft WSL setup: https://learn.microsoft.com/en-us/windows/wsl/install
- Microsoft WSL `.wslconfig`: https://learn.microsoft.com/en-us/windows/wsl/wsl-config
- Docker Desktop WSL2 GPU: https://docs.docker.com/desktop/features/gpu/
- Docker Desktop WSL2 file system best practices: https://docs.docker.com/desktop/features/wsl/best-practices/
- GitHub self-hosted runner public repo critical security: https://docs.github.com/en/actions/reference/security/secure-use
- Node EOL official: https://github.com/nodejs/Release
- Ollama official Codex integration: https://github.com/ollama/ollama/blob/main/docs/integrations/codex.mdx
- Ollama official model tags: https://ollama.com/library/qwen3/tags
- Same commercial masterplan in PR #44: `docs/roadmap/FOUNDLY_COMMERCIAL_MASTER_RUNPLAN_20261013.md`, `docs/roadmap/FOUNDLY_COMMERCIAL_BUDGET_20261013.json`.
