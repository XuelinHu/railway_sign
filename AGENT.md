# Agent.md

Repository overview for `railway_sign`.

## Purpose
- 3D railway signal monitoring dashboard with a Cesium "big map" view and a Three.js equipment panel.

## Stack
- Frontend: Vue 3 + Vite, Cesium, Three.js, ECharts, GSAP, mqtt.
- Backend: Node.js + Express + PostgreSQL.

## Key paths
- `src/App.vue`: top-level view switcher (Cesium vs Three).
- `src/components/CesiumView.vue`: Cesium map, dashboard panels, beacon effects.
- `src/components/ThreeView.vue`: 3D station/panel view.
- `src/services/api.js`: frontend API wrapper.
- `server/index.js`: Express API + static hosting.
- `server/db.js`: PostgreSQL pool and query helper.
- `server/scripts/initDatabase.js`: schema + mock data.
- `server/public/admin/index.html`: admin UI entry.
- `public/`: frontend static assets.
- `dist/`: build output (served by the backend in production).

## Dev commands (root)
- `npm run dev`: Vite dev server.
- `npm run dev:server`: API server.
- `npm run dev:all`: run both via concurrently.
- `npm run build`: Vite build.
- `npm run preview`: preview build.
- `npm run init-db`: initialize database (server script).

## Dev commands (server/)
- `npm run dev`: nodemon server.
- `npm run start`: node server.

## Environment
- Frontend: `VITE_API_BASE` (optional API base URL).
- Backend: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT`.

## Data flow notes
- Frontend expects API responses shaped as `{ success, data, error }`.
- SVG line charts are hand-drawn via computed points in components.
- Cesium beacon effects live in `createBeaconPoints` and `updateWaveAnimation`.

## Tests
- No automated tests configured.
