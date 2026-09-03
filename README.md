# Foundly OS v5.0.1 — Jarvis Autonomous Intelligence Core

Foundly v5 maakt Jarvis de centrale, tenantgebonden commandolaag voor tekst en voice. Jarvis gebruikt één server-side planner en toolregistry voor interne Foundly-data, werkelijk verbonden providerdata, actuele webresearch, uitvoerbare acties, verificatie, geheugen en semantische UI-commando's.

De productregel is strikt: geen provider, record, status, zoekresultaat of actie wordt als echt gepresenteerd zonder een echte response, persistente write of expliciete verificatie.

## Productiepoorten

`GET /api/health` is publieke liveness. `GET /api/ready` is publieke, secret-vrije readiness en geeft pas `PASS` wanneer minimaal het volgende klopt:

- productie-authenticatie gebruikt een niet-placeholder adminwachtwoord van minimaal 16 tekens of bearer-token van minimaal 32 tekens;
- token/state-encryptie gebruikt een niet-placeholder secret van minimaal 32 tekens;
- `FOUNDLY_PUBLIC_BASE_URL` is een geldige HTTPS-origin;
- Meta, Google, LinkedIn, TikTok en Wix callback-URL's zijn exact aan die origin gebonden;
- `OPENAI_API_KEY` is ingesteld voor Jarvis Realtime en actuele webresearch;
- `FOUNDLY_DATA_DIR=/data` is schrijfbaar;
- `/data` is in productie aantoonbaar een afzonderlijke Railway Volume.

Alle UI-, data-, Jarvis-, connector-, worker- en diagnoseroutes zijn in productie beveiligd. Alleen health/readiness, gesigneerde webhooks en de OAuth-callbacks zijn publiek. Callbackroutes worden vóór Basic Auth afgehandeld en geven nooit een browserchallenge.

## Jarvis-architectuur

- Browser voice via OpenAI Realtime WebRTC en een server-uitgegeven ephemeral client secret van 60 seconden. De normale OpenAI API-key verlaat de server niet.
- Realtime gebruikt semantic VAD en interruptie/barge-in. Iedere gebruikersopdracht moet via de `foundly_core`-functie naar de autoritatieve serverroute.
- Standby wake-word gebruikt uitsluitend lokale browserherkenning wanneer `processLocally` werkelijk beschikbaar is. Anders wordt geen continue omgevingsaudio verwerkt en toont de UI de veilige klik/tekstfallback.
- De centrale retrieval planner kiest interne data, echte providerprobes/sync en/of OpenAI Web Search. Tijdgevoelige vragen worden niet uit statische modelkennis beantwoord.
- Eenvoudige tijd/datumvragen gebruiken de lokale serverklok zonder modelcall. Weer zonder bekende plaats vraagt om locatie.
- De server-side toolregistry bevat schema, rechten, risico, read/write-mode, provider, timeout, retries, confirmation, verificatie en auditbeleid. Handlers worden niet aan de browser blootgesteld.
- High-risk opdrachten krijgen een cryptografische, tenant-, dealer-, conversation- en turn-bound bevestiging met TTL. Tokens en originele opdrachten worden encrypted opgeslagen; gebruik is eenmalig en replay-safe.
- Ieder resultaat bewaart een geredigeerde audittrail met intent, plan, tools, acties, providerresultaten, verificatie, latency en fouten.
- Conversation history is begrensd, persistent en beheersbaar via `GET`/`DELETE /api/jarvis/conversation/:id`.
- De UI Command Bus accepteert uitsluitend geregistreerde semantische commando's zoals `OPEN_ENGINE`, `OPEN_CONNECTOR`, `SHOW_RESULTS` en `CENTER_GRAPH`.

Belangrijke routes:

- `GET /api/jarvis/status`
- `GET /api/jarvis/tools`
- `POST /api/jarvis/realtime/client-secret`
- `POST /api/jarvis/turn`
- `GET /api/jarvis/self-check`
- `GET|DELETE /api/jarvis/conversation/:id`

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

Core records, provenance, memory, decisions, Jarvis-audit, jobs, events en workerstatus worden in `FOUNDLY_DATA_DIR` opgeslagen. De worker verwerkt echte queued jobs, gebruikt persisted attempts/status, exponential backoff en dead-letterstatus na het maximale aantal pogingen.

Voor Railway:

1. koppel aan de service achter het publieke domein een Volume op `/data`;
2. zet `FOUNDLY_DATA_DIR=/data`;
3. vul `RAILWAY_VARIABLES.txt` op exact die service in;
4. registreer de callback-URL's bij de providers;
5. deploy en controleer `/api/health`, `/api/ready` en `/api/jarvis/status`.

## Tests

Voer lokaal uit:

```bash
npm test
```

De suite test syntax, auth/secrets, SSRF-beveiliging, 93 connectorcontracten, alle vijf native OAuth-flows inclusief Basic Auth + publieke callback + containerrestart, encrypted tokens, state-replay/retry, providerbootstrap, sync ingest, workerretry, 12 engines, provenance, Jarvis ephemeral sessions, originvalidatie, actuele searchrouting, weather/time/news-intents, follow-ups, tool-idempotency, confirmations, prompt-injectiondefensie, memory pruning, restart persistence, history deletion en de UI/voice-contracten.

Browserhardware en echte externe providers worden bewust niet door mocks tot `LIVE PASS` verklaard. Na iedere deploy blijven echte microfoon/playback/WebRTC-, providercredential-, consent/review- en Railway Volume-tests afzonderlijke live acceptance gates.
