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
- Preview: `npm run preview` (serves `dist/`, also proxies `/api`).
- Dev all-in-one: `npm run dev:all` (api + telemetry + web via `concurrently`).
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

Zero third-party dependencies: plain `node:http`, a segment-matching router, response envelope
`{ok:true,data}` / `{ok:false,error,detail}`, JWT auth via hand-rolled HS256 (`node:crypto`), and
`node:sqlite` (`DatabaseSync`) for persistence.

```
server/api-server.js        entry: http server, router table, CORS / JSON body / auth / logging
server/api/lib/db.js        sqlite open + schema + seed data (runs on first start)
server/api/lib/secure.js    scrypt password hashing, HS256 JWT, captcha, RBAC helpers
server/api/lib/http.js      json / pagination parsing / SSE / errors / CORS
server/api/lib/paths.js     .data dir and db file resolution
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
| `API_DATA_DIR` | `<repo>/.data` | runtime data directory |
| `API_DB_FILE` | `<repo>/.data/railway_sign.db` | SQLite file |
| `API_MAX_BODY_BYTES` | `8388608` | JSON body limit |
| `API_INGEST_TOKEN` | `railway-sign-ingest` | telemetry ingest shared secret |
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
| `VOICE_PYTHON` / `PYTHON` | `python3` | interpreter used by `npm run voice` |

## Data Storage

- Database: **SQLite via `node:sqlite`**, single file `.data/railway_sign.db` (git-ignored, created
  and seeded automatically on first API start — no migration step to run by hand).
- Tables: `users`, `roles`, `signals`, `alarms`, `work_orders`, `telemetry_records`, `ai_sessions`,
  `ai_messages`, `ai_models`, `login_logs`, `op_logs`, `system_configs`, `password_resets`.
- Seed data includes demo accounts, ~40 signal devices, alarms, work orders, telemetry history,
  login/op logs and AI sessions, so every admin menu has multiple pages to page through.
- To start over: stop the API and delete `.data/railway_sign.db` (schema + seed are recreated on
  the next start). `.data/secret` holds the generated JWT key.
- Do not commit `.data/`, `voice_service/models/`, or any real credentials.

### Demo accounts (seeded)

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `Admin@123` | admin (all permissions) |
| `operator` | `Operator@123` | operator |
| `user` | `User@123` | user |
| `demo01` … `demo24` | `Demo@123` | user |

## Voice Sidecar (`voice_service/`)

A localhost-only Python service that the API proxies (`/api/ai/asr`, `/api/ai/tts`); the browser
never talks to it directly.

- ASR: **sherpa-onnx SenseVoice** (zh/en/ja/ko/yue, int8 ONNX, CPU only, offline, punctuated).
- TTS: **edge-tts** neural Chinese voices, returns MP3; the frontend falls back to
  `speechSynthesis` when the sidecar is unreachable.
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
- `scripts/test-api.mjs` is the API self-test (`node scripts/test-api.mjs`, needs the API running);
  it covers auth flows, RBAC isolation and pagination for all 12 admin menus.
- If project structure, commands or env vars change, update this file together with `README.md`.

## GitHub Commit Language

- Use English for all GitHub commit messages and pull/push related commit notes.
