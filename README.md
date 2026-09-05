# Foundly OS v6.0.0 — Neural Business Operating System

Foundly v6 bouwt voort op de exact behouden v5.4 Neural-, ZERO- en CRM-release en voegt één tenantgebonden platform toe voor canonical events, realtime analyse, KPI's, attributie, finance, Nederlandse fiscale regels, data/knowledge, learning, connectoren, automation en configuratiegestuurde capability packs. ZERO gebruikt één server-side planner en typed toolregistry over die domeinen. `/api/jarvis/*` blijft uitsluitend als backward-compatible alias bestaan.

De productregel is strikt: geen provider, record, status, zoekresultaat of actie wordt als echt gepresenteerd zonder een echte response, persistente write of expliciete verificatie.

## Platformwerkruimtes en domeinen

- `/crm` levert de geïntegreerde CRM-workspace met Customer 360, pipelines, taken, communicatiearchitectuur, echte recordanalytics, dashboardpresets en de dashboard builder; dezelfde Core kan via `crm-standalone.js` zelfstandig draaien.
- `/analysis` levert realtime canonical events, server-side gepagineerde historische rollups, een versiegebonden KPI Registry, freshness, multi-touchattributie, de commerciële funnel en herleidbare campagne-uitkomsten. KPI's delen een incrementeel bijgewerkte tenant-/filtergebonden fact-cache; de browser ontvangt geen volledige dataset.
- `/finance` levert double-entry accounting met balanscontrole, facturen en creditnota's, debiteuren/crediteuren, betalingen, bankregels en reconciliatie, BTW, vaste activa, rapportage, budget/forecast, periodeafsluiting, reversals en geautoriseerde geaudite exports.
- De Data Platform-laag bevat canonical records, append-only events, content-addressed objectmanifests, provenance, retention, encrypted persistence en een duurzame offline outbox met conflictbeleid.
- Knowledge onderscheidt bronmateriaal, observaties, feiten, inzichten, voorkeuren en hypotheses met bewijs, confidence, geldigheid, supersession en rechten. Learning registreert versiegebonden afleidingen en echte outcomes, maar claimt geen automatische retraining.
- De gedeelde connectorruntime bewaakt contract, lifecycle, probe, sync, checkpoints, retries, webhooks en idempotency. `CONNECTED` vereist authenticatie, een geslaagde probe en initiële sync; ontbrekende provideraccess blijft zichtbaar als niet geverifieerd.
- Automation is versiegebonden, replay-safe en geaudit; high-risk externe communicatie, betaling, filing en kritieke instellingen vereisen expliciete approval. Auto-Provisioner stelt per tenant passende modules, pipelines, KPI's, dashboards, connectorplannen, workflows, rollen en ZERO-tools samen zonder codefork.
- Alleen de BTW-regellaag is als geverifieerd uitvoerbaar gemarkeerd. Overige Nederlandse fiscale domeinen blijven expliciet architectuur-only totdat actuele officiële regels en operationele filingkoppelingen per use-case zijn geverifieerd.

## Productiepoorten

`GET /api/health` is publieke liveness. `GET /api/ready` is publieke, secret-vrije readiness en geeft pas `PASS` wanneer minimaal het volgende klopt:

- productie-authenticatie heeft een niet-lege adminpassword- of bearer-tokenconfiguratie die na dezelfde gedocumenteerde normalisatie exact en timing-safe wordt vergeleken;
- token/state-encryptie gebruikt een niet-placeholder secret van minimaal 32 tekens;
- `FOUNDLY_PUBLIC_BASE_URL` is een geldige HTTPS-origin;
- Meta, Google, LinkedIn, TikTok en Wix callback-URL's zijn exact aan die origin gebonden;
- `OPENAI_API_KEY` is ingesteld voor ZERO Realtime en actuele webresearch;
- `FOUNDLY_DATA_DIR=/data` is schrijfbaar;
- `/data` is in productie aantoonbaar een afzonderlijke Railway Volume.

Alle UI-, data-, ZERO-, CRM-, connector-, worker- en diagnoseroutes zijn in productie beveiligd. Alleen health/readiness, gesigneerde webhooks en de OAuth-callbacks zijn publiek. Callbackroutes worden vóór Basic Auth afgehandeld en geven nooit een browserchallenge.

## ZERO-architectuur

- Browser voice via OpenAI Realtime WebRTC en een server-uitgegeven ephemeral client secret van 60 seconden. De normale OpenAI API-key verlaat de server niet.
- Realtime gebruikt semantic VAD en interruptie/barge-in. Iedere gebruikersopdracht moet via de `foundly_core`-functie naar de autoritatieve serverroute.
- Na één expliciete browserinitialisatie gebruikt standby een lokale dubbele-klapdetector naast het wake word “Zero”. De lokale detector analyseert alleen transient/energiewaarden; ruwe standby-audio wordt niet geüpload. On-device herkenning heeft voorkeur; de browser-speechservice blijft een expliciete compatibiliteitsfallback. Zodra conversation mode start, gaat audio via de beveiligde Realtime WebRTC-sessie en iedere opdracht via Foundly Core.
- Een ontgrendelde Web Audio-laag verzorgt originele procedurele ambience, state-cues, stemprocessing, ducking en een audio-reactieve Core. Volume-, wake-, klap-, aanspreek- en renderinstellingen zijn tenantgebonden en persistent.
- Displaytekst en spreektekst zijn gescheiden. Alle browser-TTS en Realtime-uitvoer gebruikt centraal gesaniteerde `spoken_text`, met Nederlandse normalisatie voor onder meer bedragen, percentages, tijden, afstanden en voertuignamen; Markdown, HTML, URLs en JSON worden niet als presentatiecode uitgesproken.
- De visuele runtime gebruikt één fullscreen WebGL2/HDR-organisme: een bilobate metaball/SDF-Core met bounded raymarching en `gl_FragDepth`, GPU-instanced cubic-Bézier-ribbons, spline-packets, echte Z-diepte, drie bloomniveaus en tone mapping. De deterministische quality-profielen schalen tussen 1.100–6.200 particles, 210–420 filaments, 40–96 packets, DPR, raymarchstappen en bloomresolutie. De fundamentele Core, heldere organische filamenthiërarchie en voorgronddiepte blijven in elk profiel behouden; de oude 2D/radial/network-graph renderer wordt niet gebruikt.
- Renderer- en AudioContext-startup zijn failure-isolated van ZERO. Een context-, framebuffer-, shader-, audio- of optionele HUD-fout kan de autoritatieve mic/wake/send/command-handlers niet meer verhinderen.
- De basismotion blijft altijd actief: een energiecyclus van 3,15 seconden, een sheetrotatie van 6,3 seconden, Core-deformatie, filament-flex, particle drift/twinkle, spline-packets en subtiele cameramotion. Alleen business-routing en provider/tool-activiteit worden door echte runtime-events geactiveerd.
- De 12 huidige automotive neural regions zijn een asymmetrisch defaultprofiel, geen vaste rendererarchitectuur. Een provisioner kan gevalideerde region-profielen dynamisch aanbieden zonder dealerfork of rendererrewrite.
- Floating businesspanelen halen hun waarden uit `/api/dashboard/summary`: uitsluitend persisted records, taken en events plus providerbronnen waarvan de echte probe groen is. Routes pulseren uitsluitend door gebruikersnavigatie of nieuwe persisted runtime-events; er wordt geen live activiteit verzonnen.
- De centrale Audio & Privacy-laag heeft afzonderlijke master-, voice-, music- en SFX-bussen, directe sliders/toggles, persistente voorkeuren, state-aware procedurele soundscape, smooth ducking en output-aware wake/clap-gating.
- De centrale retrieval planner kiest interne data, echte providerprobes/sync en/of OpenAI Web Search. Tijdgevoelige vragen worden niet uit statische modelkennis beantwoord.
- Eenvoudige tijd/datumvragen gebruiken de lokale serverklok zonder modelcall. Weer zonder bekende plaats vraagt om locatie.
- De server-side toolregistry bevat schema, rechten, risico, read/write-mode, provider, timeout, retries, confirmation, verificatie en auditbeleid. Handlers worden niet aan de browser blootgesteld.
- High-risk opdrachten krijgen een cryptografische, tenant-, dealer-, conversation- en turn-bound bevestiging met TTL. Tokens en originele opdrachten worden encrypted opgeslagen; gebruik is eenmalig en replay-safe.
- Ieder resultaat bewaart een geredigeerde audittrail met intent, plan, tools, acties, providerresultaten, verificatie, latency en fouten.
- Conversation history is begrensd, persistent en beheersbaar via `GET`/`DELETE /api/zero/conversation/:id`.
- De UI Command Bus accepteert uitsluitend geregistreerde semantische commando's zoals `OPEN_ENGINE`, `OPEN_CONNECTOR`, `SHOW_RESULTS` en `CENTER_GRAPH`.

Belangrijke routes:

- `GET /api/diagnostics/runtime-auth` (publiek, uitsluitend booleans/status; nooit waarden, lengtes of secret-fingerprints)
- `GET /api/zero/status`
- `GET /api/dashboard/summary`
- `GET|PUT /api/zero/preferences`
- `POST /api/zero/client-event` (allowlisted, secret-geredigeerde browser acceptance-telemetrie; nooit audio of transcript)
- `GET /api/zero/tools`
- `POST /api/zero/realtime/client-secret`
- `POST /api/zero/turn`
- `GET /api/zero/self-check`
- `GET|DELETE /api/zero/conversation/:id`

Dezelfde routes onder `/api/jarvis/*` zijn compatibiliteitsaliassen; responses identificeren de officiële assistent altijd als `ZERO`.

## Foundly CRM

- De CRM Core exposeert 38 tenantgebonden domeincollecties met RBAC, team- en recordautorisatie, optimistic revisions, idempotency, audit en soft-delete.
- Customer 360 combineert uitsluitend vastgelegde identiteit, bedrijf, deals, communicatie, taken, afspraken, documenten, producten, attributie, toestemming, tijdlijn en historie.
- Pipelines ondersteunen configureerbare fasen, kans, waarde, marge, expected close, eigenaar/team, next action, stalled-detectie, score en forecast; de frontend ondersteunt drag-and-drop.
- Automations ondersteunen de vastgelegde triggers en interne acties. E-mail, berichten en webhooks blijven `AWAITING_EXPLICIT_AUTHORIZATION` tot expliciete toestemming en een geverifieerde connector aanwezig zijn.
- Analytics worden uitsluitend uit persistente CRM-records berekend. Een metric zonder bronrecords is expliciet niet beschikbaar; er wordt geen nul als echte bedrijfsmeting verzonnen.
- Het configureerbare dashboard bevat negen widgettypen, zes bewerkbare presets, filters, datumbereik, periodevergelijking, toevoegen/verwijderen, vergroten/verkleinen, drag-and-drop, persoonlijke/teamweergaven en geaudite live change-token polling.
- ZERO gebruikt dezelfde formele CRM-services voor prioriteitsleads, pipeline-overzichten, Customer 360 en expliciet vastgelegde inventory-customer-relaties.
- `crm-standalone.js`, `Dockerfile.crm` en `railway.crm.json` vormen een onafhankelijk deploybare CRM-service met optionele ZERO-integratie en zonder afhankelijkheid van de Neural renderer.

## Data en provenance

De Foundly Data Layer is een normalized cache/persistence layer, niet een externe databron. Iedere genormaliseerde record houdt minimaal bij:

- `source_id`
- `source_name`
- `source_kind`
- `method`
- `provider_verified`
- `observed_at`
- `ingested_at`
- `confidence`

Bronsoorten onderscheiden `external_provider`, `web_research`, `historical_internal`, `user_input` en `derived_intelligence`. Een engine toont alleen een externe bron als de providerprobe voor die bron werkelijk groen is.

## OAuth en connectoren

Meta, Google, LinkedIn, TikTok en Wix gebruiken persistente, gehashte en HMAC-gebonden state met een TTL van 15 minuten en transactiestatus `PENDING → PROCESSING → USED`. Een tijdelijke exchangefout geeft de lease veilig vrij voor retry; een definitieve of succesvolle callback is replay-proof.

Na callback volgt exact deze server-side keten:

1. state en tenant/dealerbinding valideren;
2. authorization code/installation payload valideren;
3. token server-side uitwisselen;
4. token encrypted persistent opslaan;
5. echte providerprobe;
6. bootstrap en ingest met provenance;
7. pas daarna `connected` en redirect naar de beveiligde UI.

Wix is native geïmplementeerd via `https://www.wix.com/app-installer`; de vaste callback is `/api/connect/wix/callback` en de token exchange gebruikt `https://www.wixapis.com/oauth2/token`. Er is geen browserprompt voor authorization/token endpoints of Wix-secrets.

De overige connectorprofielen zijn capabilities, geen meegeleverde providercontracten of credentials. Een connector blijft `NOT_CONFIGURED`, `CONFIGURED`, `ERROR` of `CONNECTED` op basis van echte configuratie en probes; Foundly simuleert geen live status.

## Workers en persistence

Core records, provenance, memory, decisions, ZERO-audit, CRM-records, jobs, events en workerstatus worden in `FOUNDLY_DATA_DIR` opgeslagen. De worker verwerkt echte queued jobs, gebruikt persisted attempts/status, exponential backoff en dead-letterstatus na het maximale aantal pogingen.

Voor Railway:

1. koppel aan de service achter het publieke domein een Volume op `/data`;
2. zet `FOUNDLY_DATA_DIR=/data`;
3. vul `RAILWAY_VARIABLES.txt` op exact die service in;
4. registreer de callback-URL's bij de providers;
5. deploy en controleer `/api/health`, `/api/ready`, `/api/zero/status` en `/api/crm/status`.

## Tests

Voer lokaal uit:

```bash
npm test
```

De suite test syntax, auth/secrets, SSRF-beveiliging, 100 connectorcontracten, alle vijf native OAuth-flows inclusief Basic Auth + publieke callback + containerrestart, encrypted tokens, state-replay/retry, providerbootstrap, sync ingest, workerretry, 12 engines, provenance, ZERO ephemeral sessions, originvalidatie, actuele searchrouting, weather/time/news-intents, follow-ups, tool-idempotency, confirmations, prompt-injectiondefensie, memory pruning, restart persistence, history deletion, display-/spraaktekstscheiding, Nederlandse spraaknormalisatie, audio-bussen/ducking, output-aware clap-gating, deterministische GPU-dichtheid, werkelijke dashboardaggregatie, CRM-tenantisolatie/RBAC/Customer 360/pipelines/analytics/dashboard/automations, ZERO-CRM-tools, gesigneerde webhooks, encrypted CRM-persistence en standalone restart.

Browserhardware en echte externe providers worden bewust niet door mocks tot `LIVE PASS` verklaard. Na iedere deploy blijven echte microfoon/playback/WebRTC-, providercredential-, consent/review- en Railway Volume-tests afzonderlijke live acceptance gates.
