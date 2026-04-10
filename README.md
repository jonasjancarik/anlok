# anlok

Monorepo for the door access system.

## Layout

- `apps/web`: Next.js web client
- `apps/app`: Expo / React Native client
- `services/access-api`: Python / FastAPI access-control backend for Raspberry Pi hardware

## Development

Each project keeps its own runtime, dependencies, and lockfiles:

- `apps/web`: `npm install`, `npm run dev`
- `apps/app`: `npm install`, follow `apps/app/README.md`
- `services/access-api`: create a virtualenv, install `requirements.txt`, then run from `services/access-api`
