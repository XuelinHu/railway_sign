# AGENT.md

## Project

- Project: `railway_sign`
- Stack: Vue 3, Vite, Cesium, Three.js, ECharts, MQTT, Node.js (telemetry bridge + unified API), Python sidecar (voice)
- Type: railway signal digital twin visualization, with user accounts, an admin console and an AI agent

## Runtime

- Web port: `4028`.
- Local URL: `http://127.0.0.1:4028/`.
- FRP URL: `http://47.120.48.245:14028/`.
- Dev: `npm run dev`.
- Build: `npm run build`.
- Preview: `npm run preview` (serves `dist/web/`, also proxies `/api`; APK artifacts stay in `dist/`).
- Dev all-in-one: `npm run dev:all` (api + telemetry + web via `concurrently`).
- API self-test: `npm run test:api`. Browser end-to-end: `npm run test:e2e` (see Codex Notes).
- PM2 helper: `scripts/start-pm2.sh`, default `WEB_PORT=4028`; modes `web` / `api` / `voice` / `telemetry` / `all`.

## Services and Ports

| Service | Port | FRP | Start | PM2 name |
| --- | --- | --- | --- | --- |
| Frontend (Vite dev / preview) | `4028` | `14028` | `npm run dev` / `npm run preview` | `railway-sign-web` |
| Unified API (auth + admin + AI + telemetry) | `8037` | `18037` | `npm run api` | `railway-sign-api` |
| Voice sidecar (ASR + TTS) | `8039` | `18039` | `npm run voice` | `railway-sign-voice` |
| Telemetry bridge | `8036` | `18036` | `npm run telemetry` | `railway-sign-telemetry` |
| Ollama (external, not managed here) | `11434` | — | system service | — |

The frontend talks to the API **same-origin** through the Vite proxy: `vite.config.js` sets both
`server.proxy` and `preview.proxy` for `/api` → `http://127.0.0.1:8037`. No CORS, no mixed content,
and FRP only needs the single `14028` entry.

## Unified API (`server/api-server.js`)

The API uses `node:http`, a segment-matching router, PostgreSQL through `pg`, response envelope
`{ok:true,data}` / `{ok:false,error,detail}`, and JWT auth via hand-rolled HS256 (`node:crypto`).

```
server/api-server.js        entry: http server, router table, CORS / JSON body / auth / logging
server/api/lib/postgres.js  async PostgreSQL pool, transaction context, pagination, migrations and reference seed
server/api/postgres/        PostgreSQL schema, immutable SQL migrations and role provisioning
server/api/lib/secure.js    scrypt password hashing, HS256 JWT, captcha, RBAC helpers
server/api/lib/http.js      json / pagination parsing / SSE / errors / CORS
server/api/lib/paths.js     .data cache/backup directory and validated database name
server/api/routes/          auth.js, admin.js, ai.js, telemetry.js, voice.js
```

API groups:

- `/api/auth/*` — `captcha`, `register`, `login`, `logout`, `me`, `change-password`,
  `forgot-password`, `reset-password`, `profile`.
- `/api/admin/*` — **every menu is a paginated list**: `overview`, `users`, `roles`, `signals`,
  `alarms`, `work-orders`, `telemetry`, `login-logs`, `op-logs`, `ai-sessions`, `models`, `configs`,
  plus action endpoints (enable/disable, change role, reset password, handle alarm, assign work order).
- `/api/ai/*` — `health`, `models` (Ollama `/api/tags` merged with the local catalog), `chat`
  (**SSE** stream, persists to `ai_messages`), `pull` (SSE progress), `asr`, `tts`, `sessions`,
  `context`.
- `/api/telemetry/*` — `ingest` (called by the bridge, guarded by `API_INGEST_TOKEN`), `latest`.

List responses are always `{list, total, page, pageSize, totalPages}`; query params are
`page`, `pageSize` (capped at 200), `keyword`, plus per-menu filters and date ranges.

### Environment variables

| Variable | Default | Used by |
| --- | --- | --- |
| `API_PORT` | `8037` | API listen port |
| `API_HOST` | `0.0.0.0` | API bind address |
| `API_JWT_SECRET` | auto-generated, persisted to `.data/secret` | JWT signing key |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` | unset | shared Keycloak issuer and public Web client; OIDC login stays disabled until configured |
| `OIDC_REDIRECT_ORIGINS` | localhost and LAN port 4028 | exact allowed web origins for `/oidc/callback` |
| `API_DATA_DIR` | `<repo>/.data` | TTS cache and encrypted backup directory |
| `PGHOST` / `PGPORT` | `127.0.0.1` / `5432` | PostgreSQL host and port |
| `PGDATABASE` | `railway_sign` | this project's database |
| `PGUSER` / `PGPASSWORD` | `railway_sign_app` / unset | this project's role and secret |
| `PGSSL` | `0` | require verified TLS when set to `1` |
| `DB_BACKUP_ENCRYPTION_KEY` | unset | project-specific 32-byte AES-GCM key, hex encoded |
| `API_MAX_BODY_BYTES` | `8388608` | JSON body limit |
| `API_INGEST_TOKEN` | empty | optional shared secret for remote telemetry bridge → API forwarding; loopback forwarding is allowed without it |
| `API_ENABLE_DEMO_SEED` | `0` | explicit opt-in for development/test demo-account seeding; ignored in production |
| `API_DEMO_PASSWORD` | unset | strong shared password used only by explicitly seeded isolated demo accounts |
| `API_BOOTSTRAP_ADMIN_PASSWORD` | unset | one-time strong password consumed by `npm run admin:bootstrap` |
| `API_INGEST_URL` | `http://127.0.0.1:8037/api/telemetry/ingest` | bridge → API forwarding target (empty string disables forwarding) |
| `API_INGEST_TIMEOUT_MS` | `5000` | forwarding timeout |
| `TELEMETRY_PORT` | `8036` | bridge port |
| `TELEMETRY_WS_PATH` | `/ws` | bridge WebSocket path |
| `TELEMETRY_UPLOAD_PATH` | `/upload` | bridge upload path |
| `TELEMETRY_MAX_BODY_BYTES` | `32768` | bridge body limit |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama endpoint |
| `VOICE_HOST` | `http://127.0.0.1:8039` | voice sidecar endpoint (API side) |
| `VOICE_PORT` | `8039` | voice sidecar listen port |
| `VOICE_HOST_BIND` | `127.0.0.1` | voice sidecar bind address (localhost only by design) |
| `VOICE_ASR_MODEL_DIR` | `voice_service/models/sense-voice` | SenseVoice model directory |
| `VOICE_ASR_THREADS` | `4` | ASR decode threads |
| `VOICE_TTS_VOICE` | `zh-CN-XiaoxiaoNeural` | default edge-tts voice |
| `VOICE_MAX_AUDIO_BYTES` | `12582912` | API-side ASR upload limit |
| `VOICE_MAX_TTS_AUDIO_BYTES` | `12582912` | API-side TTS response limit (12 MiB, checked while streaming) |
| `TTS_CACHE_TTL_MS` | `604800000` | TTS cache idle expiry (7 days, based on last access) |
| `TTS_CACHE_MAX_BYTES` | `268435456` | TTS disk-cache size cap (256 MiB; least-recently-used entries are evicted first) |
| `VOICE_PYTHON` / `PYTHON` | `python3` | interpreter used by `npm run voice` |

## Data Storage

- Database: **PostgreSQL**. `schema.sql` and immutable numbered migrations live under
  `server/api/postgres/`; API startup applies them under an advisory lock and seeds reference rows only.
- Tables: `users`, `roles`, `signals`, `alarms`, `work_orders`, `telemetry_records`, `ai_sessions`,
  `ai_messages`, `ai_models`, `login_logs`, `op_logs`, `system_configs`, `password_resets`.
- API startup seeds reference rows only. Demo users and business fixtures are available only through `npm run db:seed:test` on an isolated `_test` database.
  Demo accounts are never created in production.
- Use a fresh isolated PostgreSQL database for repeatable tests; there is no file-database reset shortcut.
- Do not commit `.data/`, `voice_service/models/`, or any real credentials.
- Telemetry ingestion trusts the socket peer address for its loopback exception. Requests from other hosts require the same explicitly configured random `API_INGEST_TOKEN` in both bridge and API processes; never rely on forwarded client-IP headers for authorization.

### Database backup and restore

- `npm run db:backup` creates a PostgreSQL custom archive encrypted with this project's backup key;
  existing backup files are never overwritten.
- `npm run db:restore -- --source PATH --target <other_test_db> --replace` only restores to a different
  database whose name ends in `_test`.
- `npm run db:import:sqlite -- --source PATH` imports a read-only SQLite copy into an empty PG `_test`
  database and compares imported rows. It cannot target a normal database.
- `npm run test:db-maintenance` covers encryption, tamper detection, overwrite refusal and restore gates.

### Production administrator bootstrap

Set `NODE_ENV=production`, `API_BOOTSTRAP_ADMIN_PASSWORD` to a unique 16+ character password with
uppercase, lowercase, a digit and a symbol, and the same PostgreSQL connection as the API; then run
`npm run admin:bootstrap` once before starting the API. A legacy seeded admin is
rotated, other built-in demo accounts are disabled, and the password is never printed. Existing
non-demo admin accounts are not overwritten. Production API startup refuses to serve a database with
no active admin, and login rejects legacy built-in demo accounts until the bootstrap is completed.

For an isolated development/test database only, run `npm run db:seed:test` with `PGDATABASE` ending
in `_test`, `API_ENABLE_DEMO_SEED=1` and a strong `API_DEMO_PASSWORD`. Production rejects this command.

## Voice Sidecar (`voice_service/`)

A localhost-only Python service that the API proxies (`/api/ai/asr`, `/api/ai/tts`); the browser
never talks to it directly.

- ASR: **sherpa-onnx SenseVoice** (zh/en/ja/ko/yue, int8 ONNX, CPU only, offline, punctuated).
- TTS: **edge-tts** neural Chinese voices, returns MP3; the frontend falls back to
  `speechSynthesis` when the sidecar is unreachable.
- API rejects sidecar TTS responses above `VOICE_MAX_TTS_AUDIO_BYTES` (default 12 MiB) before caching.
- Setup: `pip install -r voice_service/requirements.txt` then `bash voice_service/download_model.sh`
  (downloads ~250 MB into `voice_service/models/`, git-ignored). Start with `npm run voice`.
- The service degrades instead of crashing: with no model it still serves TTS and reports
  `asr:false` / `asr_error` on `/health`.

Android WebView integration (native bridge contract, `onPermissionRequest`, permissions, pitfalls)
is documented in `docs/安卓端语音集成.md` with copy-ready Kotlin under `docs/android-sample/`.

## Codex Notes

- `src/services/api.js` and `src/services/mockDataService.js` are local data/mock sources used by the
  three visualization tabs; they are intentionally left untouched by the backend work.
- Frontend service layer: `src/services/http.js` (fetch + SSE + token + 401 handling),
  `auth.js` (reactive auth state, permission checks), `ai.js` (chat/models/sessions),
  `voice.js` (three-layer voice input, TTS with fallback).
- Routing is `vue-router` in hash mode (`createWebHashHistory`) so static hosting needs no rewrite
  rules. `src/router/index.js` holds the guard: it restores the session once, then enforces
  login for `/`, `/profile` and `meta.requiresAdmin` for `/admin/**`.
- Styling reuses the original dark tech look, now centralised as CSS variables in
  `src/styles/theme.css` (`--rs-primary`, `--rs-gradient`, `--rs-panel-bg`, …). Reuse those variables
  and the `.rs-*` utility classes instead of hardcoding colours.
- Code style: Vue 3 `<script setup>`, no TypeScript, no Pinia, no UI library; 2-space indent,
  single quotes, no trailing semicolons.
- Self-tests, both runnable against an already-started stack:
  - `npm run test:api` (`scripts/test-api.mjs`, needs an isolated API on 8037 and `API_DEMO_PASSWORD`) — auth flows, RBAC isolation and pagination for all 12 admin menus.
  - `npm run test:production-bootstrap` — requires an empty dedicated PostgreSQL `_test` database and verifies admin rotation, demo-account disablement, login and weak-password rejection. Test rows remain there.
  - `npm run test:postgres-integration` — requires a seeded PostgreSQL `_test` database and verifies migrations, transaction rollback, constraints, cascade behavior and pagination.
  - `npm run test:voice-proxy` — starts an API and local voice-sidecar stub to verify authentication,
    WAV forwarding, bounded TTS responses and cache hits; it requires a seeded isolated PG `_test` DB.
  - `npm run test:ingest-auth` — verifies loopback-only fallback and remote shared-token authorization.
  - `npm run test:e2e` (`scripts/e2e-browser.mjs`, needs the frontend on 4028 **and** the API) —
    drives a real headless Chrome over CDP through login (captcha read from the DOM), the three
    original visualization tabs, every admin menu, and the agent dialog. Screenshots land in
    `.e2e-output/` (git-ignored). Pass a base URL as `argv[2]` to point it elsewhere. Set
    `CHROME_BIN` to the installed Chrome executable when it is not named `google-chrome`.
  - `scripts/e2e-browser.mjs` deliberately launches Chrome with `--remote-debugging-port=0` and
    reads the port from `DevToolsActivePort`: other sessions on this machine also run headless
    Chrome, and with a fixed port ours can fail to bind while the script silently attaches to
    *their* browser, making every assertion meaningless. Keep it on port 0.
- If project structure, commands or env vars change, update this file together with `README.md`.

## GitHub Commit Language

- Use English for all GitHub commit messages and pull/push related commit notes.

## Port allocation

Web: 4028. API/services: 8037、8036、8039. See `PORTS.md`; keep dev/preview ports fixed and fail on conflicts.
