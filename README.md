# anlok

Monorepo for the door access system.

## Layout

- `apps/web`: Next.js web client
- `apps/app`: Expo / React Native client
- `services/access-api`: Python / FastAPI access-control backend for Raspberry Pi hardware
- `infra/legacy-db-backup`: private R2 backup pipeline for the legacy Raspberry Pi database

## Development

Each project keeps its own runtime, dependencies, and lockfiles:

- `apps/web`: `npm install`, `npm run dev`
- `apps/app`: `npm install`, follow `apps/app/README.md`
- `services/access-api`: run `uv sync --locked`, then use `uv run` from `services/access-api`

## Remote MCP

Anlok exposes one role-aware Streamable HTTP MCP endpoint with browser OAuth for
residents, apartment administrators, guests, and building administrators. See
[`docs/mcp.md`](docs/mcp.md) for client setup, security behavior, and deployment
requirements.
