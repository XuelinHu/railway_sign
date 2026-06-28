# AGENT.md

## Project

- Project: `railway_sign`
- Stack: Vue 3, Vite, Cesium, Three.js, ECharts, MQTT, Node.js telemetry bridge
- Type: railway signal digital twin visualization

## Runtime

- Web port: `4002`.
- Local URL: `http://127.0.0.1:4002/`.
- FRP URL: `http://47.120.48.245:14002/`.
- Dev: `npm run dev`.
- Build: `npm run build`.
- Preview: `npm run preview`.
- PM2 helper: `scripts/start-pm2.sh`, default `WEB_PORT=4002`.

## Auxiliary Services

- Telemetry command: `npm run telemetry`.
- Telemetry port: `8080`.
- Telemetry endpoints: `POST /upload`, `WS /ws`, `GET /telemetry/health`.

## Data Storage

- External database: none.
- Runtime data: frontend mock data, in-memory simulation state, WebSocket telemetry messages.
- Do not commit device tokens, stream URLs, or private network credentials.

## Codex Notes

- `src/services/api.js` and `src/services/mockDataService.js` are local data/mock sources.
- If real backend/database integration is added, document database name, env vars, init scripts, and ports in README and this file.

## GitHub Commit Language

- Use English for all GitHub commit messages and pull/push related commit notes.
