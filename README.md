# anlok

Monorepo for the door access system.

## Projects

- `door-control-web-app`: Next.js web app plus Expo mobile client in `door-control-web-app/mobile`
- `door-pin`: Python/FastAPI service for Raspberry Pi door control hardware

## Layout

Current directory structure stays intact to keep churn low and preserve the original repo histories under their existing paths.

## Development

Each project keeps its own runtime, dependencies, and lockfiles:

- `door-control-web-app`: `npm install`, `npm run dev`
- `door-control-web-app/mobile`: `npm install`, follow `door-control-web-app/mobile/README.md`
- `door-pin`: create a virtualenv, install `requirements.txt`, then run the service from `door-pin`
