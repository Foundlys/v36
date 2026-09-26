# ZERO conversation and social acceptance

Social intelligence, situational empathy, appropriate directness, natural timing, corrections, context, confidence and welcome humor are binding requirements for every demo. Automotive and E-commerce, with all nine modules, remain the first delivery block. This checkpoint closes specific conversation defects; it does not establish complete social, cognitive or voice quality.

## Concrete corrections

Cross-module analysis previously supplied current specialist evidence but omitted the conversation history. It now reads the current user's owned conversation through the existing source-retention filter. The model receives at most 24 complete recent user/assistant messages and a 16,000-byte history budget. A message exceeding 8,000 characters or the remaining byte budget ends the retained window rather than cutting a correction or negation in half. Omission is explicit. Client-supplied history and system roles cannot become this server-owned context.

The server rechecks membership, native specialist sources and the selected history snapshot before/after inference. Deleting or changing the conversation while an answer is pending causes a context-conflict response. Membership revocation prevents release. Historical source-derived assistant text stays withheld rather than becoming a stale data copy in later turns. Only a history hash and bounded counts are retained in the context reference; no duplicate raw-history field is added to the result.

The Dutch scenario rehearsal found six incorrect clock/weather diversions in 42 turns: phrases including “weinig tijd”, “veel tijd in gestoken”, “weer samenwerken” and “weer een kort antwoord” selected a deterministic shortcut. Those shortcuts now require a complete clock or weather request. Other phrasing remains with ordinary reasoning. This is a bounded Dutch routing correction, not a complete multilingual intent engine. Actual questions such as the current time in New York and weather without a location retain their native behavior.

Shared model instructions now make situational acknowledgement, a useful next step, accepting corrections, proportionate detail, truthful uncertainty and unwelcome/serious-context humor explicit. Empathy cannot create a financial promise, success claim or approval. Voice direction preserves the authoritative spoken_text and asks for appropriate calm/urgency without adding reassurance or jokes. These are implementation changes awaiting quality review, not proof that a prompt guarantees the desired behavior.

## Repeatable social assessment

`zero-evaluation/social-corpus.v1.json` contains fourteen Dutch three-turn scenarios covering CRM, Sales, Finance, Marketing, Procurement, Analytics, Calendar, Communication and Automation, plus cross-module corrections, welcome/unwelcome banter, incident tone, market uncertainty and changing detail. User premises are explicitly fictional; they must not be promoted to actual customer records or market facts. The same cases apply to both priority demos, with industry-specific extension still required for other packs.

The rubric separately assesses context, truth, agency, empathy, tone, clarification, humor and usefulness. Each applicable dimension needs an independent rating and concrete turn evidence. Every dimension must meet the case requirement; critical failures cannot be averaged away. Word presence, deterministic contract results and model self-scores are not social-quality acceptance. Native-language cases/review for the other seven supported locales remain open.

The collector uses the actual isolated encrypted HTTP server, all nine native modules and, by default, the complete native demo seed. It saves each native seed checkpoint and every request/response incrementally, including audit IDs, code/corpus identity, source/model states and elapsed times. It creates no provider connection. Its default environment has no model credentials; those rehearsals expose routing and integration defects and remain `UNVERIFIED_REQUIRES_INDEPENDENT_REVIEW`. A caller must explicitly opt into a supplied live model configuration; no live provider was used for this checkpoint.

Example isolated collection (output must be outside the source worktree for an immutable proof):

```sh
node zero-evaluation/social-collect.js --industry=ECOMMERCE --output=/tmp/foundly-ecommerce-social.json
```

`--no-seed` creates a transport rehearsal only and records that limitation. `--cases=crm-frustration,cross-module-correction` selects named scenarios. These commands do not accept a remote customer base URL and always use a newly isolated fixture. A successful process exit means collection completed; the report never equates it with empathy acceptance. Unexpected reported execution or an HTTP failure stays visible for investigation.

## Evidence boundaries and remaining work

Actual HTTP checks cover both industry compositions, user correction/order preservation after an encrypted restart, another user's denial, ignored forged client history, no reintroduction of retained private-source answers, and withheld answers after conversation deletion/membership revocation during provider wait. Their provider is explicitly fake and only exposes transport/retention mistakes. The native-source and authority tests stay independent from model-quality assessment.

Real model multi-turn review, long-context relevance, natural follow-up routing across every module, all eight languages, genuinely useful action planning/execution, full seeded-demo assessment and native-language review remain open. Source/memory withholding may require an explicit fresh read in a follow-up; context must never silently reconstruct a restricted answer.

Voice still requires actual listening across two voice presentations, three modes and eight locales, including interruption, names, brands, numbers, calm urgency and no duplicate execution. Actual iPhone/Android/desktop installation, microphone and browser evidence remain separate. No complete demo or “perfect ZERO” acceptance is claimed from this checkpoint.
