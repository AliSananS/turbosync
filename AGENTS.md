# Repository Guidelines

## Project Structure & Module Organization
This repo is a Vinext/React app deployed on Cloudflare Workers. Keep user-facing routes in `app/`, reusable UI in `components/`, shared helpers in `lib/`, shared types in `types/`, and the Worker entrypoint plus Durable Object logic in `worker/`. Static assets live in `public/`. Generated output goes to `dist/`; do not edit it by hand.

## Build, Test, and Development Commands
Use Bun for installs because the repo is checked in with `bun.lock`.

- `bun install` — install dependencies.
- `bun run dev` — start the Vinext dev server on `http://localhost:3000`.
- `bun run build` — create a production build in `dist/`.
- `bun run start` — run the Cloudflare Worker locally with Wrangler.
- `bun run lint` — run Biome checks.
- `bun run format` — apply Biome formatting.
- `bun run deploy` — deploy via Vinext/Cloudflare.

## Coding Style & Naming Conventions
Biome enforces the code style: 2-space indentation, spaces over tabs, organized imports, and recommended React/Next lint rules. Write TypeScript with `strict` mode in mind and prefer the `@/*` import alias for local modules.

Use `PascalCase` for React components (`VideoPlayer`), `camelCase` for functions and variables (`handleCreateRoom`), and kebab-case for route segments when relevant. Keep presentational primitives in `components/ui/` and feature components near their domain.

## Testing Guidelines
There is no dedicated test suite yet. Before opening a PR, run `bun run lint`, `bun run build`, and manually verify the main flows: room creation, joining, synced playback, and Worker-backed endpoints. When adding tests, place them close to the code they cover or under `tests/`, and prefer clear names like `room-context.test.ts`.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit style seen in history: `feat:`, `chore:`, `refactor:`. Keep commits focused and descriptive, for example `feat: add room password validation`.

PRs should include a short summary, testing notes, linked issues when applicable, and screenshots or recordings for UI changes. Call out any Wrangler, Durable Object, or environment changes explicitly.

## Security & Configuration Tips
Do not commit secrets. Review `wrangler.jsonc` carefully when changing bindings, migrations, or compatibility settings. Treat `dist/` and `.wrangler/` as generated artifacts unless a deployment workflow specifically requires updates.
