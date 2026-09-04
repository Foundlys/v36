# Foundly OS v5.3.1 verification report

Date: 2026-09-04

This report is secondary evidence. The repository code, automated tests, deployed version and live external-provider responses remain the source of truth.

## Local result

`npm test`: PASS

- server/UI/test JavaScript syntax: PASS
- core persistence and full restart: PASS
- 93 connector schema/status contracts: PASS
- source/provenance contracts: PASS
- worker execution and retry persistence: PASS
- exact configured production auth, safe value-free runtime diagnostics, tenant-header isolation and SSRF guard: PASS
- known/default encryption secrets rejected in production: PASS
- localhost/private production origins rejected; callback exactness retained: PASS
- Meta/Google/LinkedIn/TikTok/Wix OAuth callback bypass of Basic Auth: PASS
- hashed/HMAC-bound persisted state, TTL, lease, one-time replay and transient retry: PASS
- native provider token encryption, probe, bootstrap and restart: PASS (mocked provider responses)
- generic runtime OAuth state hardening and restart: PASS
- Jarvis authoritative tool registry and safe public schema: PASS
- Realtime ephemeral credential/origin/session contract: PASS (mocked OpenAI response)
- current search, weather/news routing, deterministic time and follow-up context: PASS
- idempotent tool execution, encrypted confirmation and replay defense: PASS
- prompt-injection action defense and secret scan: PASS
- bounded/persisted/deletable conversation memory: PASS
- semantic UI command bus and external JavaScript CSP: PASS
- persisted wake preference, browser-speech fallback, Realtime `response.done` function-call completion and visible text-submit errors: contract PASS
- local adaptive double-clap gate, single Realtime client path and standby privacy contract: PASS
- renderer, shader, audio and optional-HUD startup failures are isolated from authoritative Jarvis initialization and required handlers: PASS (fault-injected)
- persistent tenant-bound Jarvis preferences and restart recovery: PASS
- Web Audio initialization, response ducking/processing and audio-reactive visual contract: PASS
- WebGL2 RGBA16F adaptive quality runtime: syntax/contract PASS; no legacy radial/network fallback
- random/fabricated neural activity packets removed; visual route pulses are bound to user navigation or new persisted events: PASS
- reference-locked fullscreen 3D bilobate SDF/metaball Core, rotating energy sheet, asymmetric neural regions, contextual labels and real-data panels: source/contract PASS
- 1.100–6.200 adaptive deterministic GPU particles, 210–420 instanced cubic-Bézier ribbons and 40–96 spline packet heads with eight-point trails: PASS
- organic root/primary/secondary/tertiary hierarchy, 500+ deterministic knots, foreground-biased low-quality retention and minimum emissive/opacity/width contracts: PASS
- deterministic 3,15-second energy cycle, 6,3-second rotation, continuous deformation/flex/drift/twinkle and subtle camera motion: source/contract PASS
- `gl_FragDepth` Core occlusion, depth-buffered foreground/background geometry, three-level threshold bloom and tone mapping: source/contract PASS
- adaptive DPR, render scale, particle/ribbon/packet count, bounded raymarch steps and bloom resolution based on measured frame time with hysteresis: PASS
- runtime-supplied, validated neural-region profile without fixed dealer-specific renderer topology: PASS
- centralized display/spoken response split and Markdown/HTML/URL-safe speech sanitization: PASS
- Dutch currency, percentage, time, year, distance and vehicle-name speech normalization: PASS
- master/voice/music/SFX buses, deterministic original 3,15-second state-aware soundscape, smooth ducking and output-aware wake suppression: PASS
- measured Web Audio frequency bands drive speaking animation on the OpenAI Realtime audio path; random speaking animation is absent: PASS
- all 15 required Jarvis visual/audio states map to the same living Core: PASS
- `/api/dashboard/summary` exposes only persisted aggregates and provider-probe-green sources: PASS

## Not proven by this report

- Railway `/data` Volume attachment on the public v36 service;
- live Railway variables and Basic Auth credentials;
- live OpenAI Realtime WebRTC audio, microphone permission, local wake capability and playback in the target browser;
- live OAuth consent/token exchange for real Meta, Google, LinkedIn, TikTok or Wix accounts;
- provider permissions, app review, partner access and production data availability;
- measured browser FPS/frame-time at 1080p, 1440p, ultrawide and 4K on the target hardware;
- actual Railway deployment of v5.3.1;
- live WebGL2 shader compilation, pixel parity, motion parity and target-hardware FPS (the isolated validation browser has no WebGL2 context);
- live acoustic comparison of the selected licensed voice and original Foundly soundscape on target audio hardware;
- the existing real admin credential match after deployment.

Do not label those items `LIVE PASS` until the deployed endpoints and real browser/provider flows have been observed.
