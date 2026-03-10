# Agent Instructions: Turbosync Codebase Guidelines

This document provides definitive instructions, codebase guidelines, and project rules for any AI agent or developer operating within the Turbosync repository. Read this entirely before proposing or making changes.

## 1. Project Overview & Architecture

Turbosync is a real-time Vinext/React application deployed on Cloudflare Workers. 
- **Vinext/React**: Framework handling UI, routing, and server components.
- **Cloudflare Workers**: The edge runtime hosting the application.
- **Durable Objects (DO)**: Used for stateful coordination, WebSockets, and room synchronization.
- **Styling**: Tailwind CSS v4 + PostCSS with Radix UI (shadcn) components.

### Directory Structure
- `app/` - User-facing routes and pages (Vinext/Next.js App Router style).
- `components/` - Reusable UI elements.
  - `components/ui/` - Presentational primitives (e.g., buttons, inputs, dialogs).
  - `components/<feature>/` - Domain-specific UI blocks.
- `lib/` - Shared helpers, utilities, and generic functions.
- `types/` - Shared TypeScript definitions and interfaces.
- `worker/` - Cloudflare Worker entrypoint and Durable Object logic.
- `public/` - Static assets served directly to the client.
- `dist/` - Generated build output. **Do not edit manually.**

## 2. Environment & CLI Commands

**Package Manager:** This project strictly uses **Bun**. Do not use `npm`, `yarn`, or `pnpm`. A `bun.lock` file is committed to the repository.

### Core Commands
- **Install Dependencies:**
  ```bash
  bun install
  ```
- **Development Server:** Starts the Vinext dev server on `http://localhost:3000`.
  ```bash
  bun run dev
  ```
- **Build:** Creates a production build in the `dist/` folder.
  ```bash
  bun run build
  ```
- **Local Worker Execution:** Runs the Cloudflare Worker locally via Wrangler.
  ```bash
  bun run start
  ```
- **Deployment:** Deploys the application via Vinext/Cloudflare.
  ```bash
  bun run deploy
  ```

### Code Quality Commands
- **Linting (Biome):**
  ```bash
  bun run lint
  ```
- **Formatting (Biome):** Applies formatting automatically.
  ```bash
  bun run format
  ```
- **Type Checking:** Run the TypeScript compiler without emitting files.
  ```bash
  bunx tsc --noEmit
  ```

### Testing Commands
There is currently no dedicated automated test suite configured in this repository. 
When a test framework (like Vitest or Bun's native test runner) is introduced:
- **Run all tests:** 
  ```bash
  bun test
  ```
- **Run a single test file (Preferred for Agents):**
  ```bash
  bun test path/to/file.test.ts
  ```
*Agent Rule:* If asked to fix a failing test, always use the single-test command focused on the failing file. This reduces output noise and speeds up the verification loop.

## 3. Code Style & Formatting

The project relies on **Biome** for both formatting and linting. Do not use Prettier or ESLint.

### Formatting Rules
- **Indentation:** 2 spaces (no tabs).
- **Line Length:** Capped at 80-100 characters by Biome.
- **Quotes:** Double quotes for JSX, single quotes for standard JS/TS.
- **Semicolons:** Required.

### TypeScript & Typing
- **Strict Mode:** Write TypeScript with strict rules enabled.
- **Avoid `any`:** Never use `any`. Use `unknown` if the type is truly dynamic, then narrow it down with type guards.
- **Explicit Interfaces:** Always define `interface` or `type` for React component props, API responses, and shared state.
- **Type Imports:** Use `import type { ... }` when importing only types to optimize the build and avoid circular dependencies.

### Naming Conventions
- **React Components:** Use `PascalCase` for filenames and component names (e.g., `VideoPlayer.tsx`, `function VideoPlayer()`).
- **Functions & Variables:** Use `camelCase` (e.g., `handleCreateRoom`, `useRoomState`).
- **Files/Directories:** Use `kebab-case` for route segments (`app/room/[room-id]`) and utility files (`date-helpers.ts`).
- **Constants:** Use `UPPER_SNAKE_CASE` for global constants and environment variable references.

### Imports
- Organize imports logically:
  1. React/Next.js/Vinext core modules.
  2. Third-party packages (e.g., `clsx`, `lucide-react`).
  3. Local path aliases (`@/components/...`, `@/lib/...`).
  4. Relative imports (`./styles.css`, `../helpers.ts`).
- Always favor the `@/*` alias for importing from the project root over deeply nested relative paths (e.g., prefer `@/lib/utils` over `../../lib/utils`).

## 4. React & UI Implementation

- **Functional Components:** Only use functional components with Hooks. Do not use class components.
- **Hooks:** Keep Hooks simple and focused. Extract complex logic into custom hooks (e.g., `useVideoSync`).
- **Effects:** Be extremely careful with `useEffect`. Ensure any Durable Object WebSockets, intervals, or event listeners are properly cleaned up in the return function to prevent memory leaks and ghost connections.
- **Tailwind CSS:** Use Tailwind utility classes for styling. When combining dynamic classes, use the `cn` helper (usually wrapping `clsx` and `tailwind-merge`).

## 5. Worker & Durable Object Guidelines

- **Stateless Workers:** The primary Worker must remain stateless. All stateful logic belongs inside Durable Objects.
- **Durable Objects (DO):**
  - Group related state operations to minimize storage calls.
  - Implement robust disconnect handling for WebSocket connections.
  - Validate all incoming messages before acting upon them to prevent injection or invalid state mutations.
- **Bindings:** Reference bindings (KV, DO, R2) safely through the `env` object provided to the Worker. Always type your bindings interface.

## 6. Error Handling

- **Typed Errors:** Use specific error types or custom Error classes where possible.
- **Try/Catch:** Wrap network requests and DO interactions in `try/catch` blocks.
- **Graceful Degradation:** Do not let a single component crash the entire UI.
- **User Feedback:** Use `sonner` toasts to communicate failures to the user cleanly, rather than failing silently. 
- **Logging:** Use `console.error` for actionable worker errors, but avoid logging PII or sensitive tokens.

## 7. Commit & Pull Request Guidelines

- **Conventional Commits:** Prefix commits properly:
  - `feat:` for new features.
  - `fix:` for bug fixes.
  - `chore:` for tooling, dependencies, or configuration changes.
  - `refactor:` for code changes that neither fix a bug nor add a feature.
  - `docs:` for documentation updates.
- **PR Scope:** Keep PRs focused on a single concern.
- **PR Descriptions:** Include a short summary, testing notes, and screenshots or videos if UI was modified. Explicitly call out any changes to `wrangler.jsonc` or Durable Object schemas.

## 8. Security & Configuration

- **Secrets:** Never commit secrets, API keys, `.env` files, or production passwords.
- **Config changes:** When modifying `wrangler.jsonc`, ensure bindings, DO migrations, and compatibility dates are accurately updated.
- **Generated Artifacts:** Treat `.wrangler/` and `dist/` as strictly generated artifacts. They should be ignored by Git and never manually edited.