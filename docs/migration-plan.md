# TurboSync Migration Plan: Astro + React + Hono + Drizzle + CF Workers

## 1. Assumptions
- **Side-by-Side Migration**: We will scaffold the new application inside a new `v2/` directory to avoid breaking the existing app. The old app will be deleted only once the new version is fully tested and working.
- **Current Stack**: `vinext` + Next.js App Router, pure Cloudflare Workers API, Durable Objects handling *all* state (metadata + real-time).
- **Target Stack**: We will migrate to **Astro v6 beta** with the **`@astrojs/cloudflare`** adapter. **React** is used for interactive UI islands. 
- **API & Routing**: We will use **Hono** for the backend API and WebSocket upgrade handling within the Cloudflare Worker.
- **Database**: We will use **Drizzle ORM** with **Cloudflare D1** to store persistent room metadata, authentication, and invite links.
- **State Management**: Durable Objects will be strictly used for transient, real-time WebSocket state (playback sync, connected users, chat), while D1 handles authorization and room existence.
- **Authentication**: 
  - Room creation *strictly requires* a password.
  - Joining a room manually requires the room name/ID and the password (Basic Auth flow).
  - Rooms generate a **public invite link** (via a secure random token). Users joining via this link bypass the password prompt but are still **required to provide a username**.

## 2. Migration Plan (Extensive, Step-by-Step)

### Step 1: Architecture Review & Cleanup
- Audit existing Next.js logic.
- Plan the separation of state: Room auth/metadata moves to D1; real-time sync stays in the Durable Object.

### Step 2: Astro v6 & Dependency Scaffold
- Install Astro v6 beta, `@astrojs/cloudflare`, `@astrojs/react`, `hono`, `drizzle-orm`, `drizzle-kit`.
- Remove `vinext` and Next.js dependencies.
- Update `wrangler.jsonc` to include the D1 database binding alongside the Durable Object.

### Step 3: D1 Database & Drizzle ORM Setup
- Create `src/db/schema.ts`.
- Define the `rooms` table:
  - `id` (slug/PK)
  - `name` (string)
  - `password_hash` (string)
  - `invite_token` (string, unique)
  - `created_at` (timestamp)
  - `expires_at` (timestamp)
- Generate and apply local D1 migrations.

### Step 4: Hono API & Authentication Flow
- Replace vanilla worker entry with a Hono app (`new Hono()`).
- Implement API routes:
  - `POST /api/room/create`: Hash mandatory password (using `crypto.subtle`), generate secure `invite_token`, insert into D1, and return room details + invite link.
  - `POST /api/room/auth`: Validate manual password attempts against D1.
  - `GET /api/room/invite/:token`: Validate invite token, return room ID.
- Define a flow where Hono validates the user's authorization (either via password verification or invite token) *before* upgrading the connection to the Durable Object.

### Step 5: Domain Extraction & Protocol
- Define strict Zod schemas for the WebSocket protocol.
- Define explicit interfaces for the `PlayerAdapter`.

### Step 6: Durable Object Redesign (Real-time only)
- Strip auth and persistent metadata storage out of the Durable Object.
- The DO now blindly trusts incoming WebSocket connections that have been pre-authorized by Hono.
- DO manages in-memory/hibernated state for current time, paused status, and connected users.

### Step 7: Transport, Player Adapter, & Sync Controller
- Implement `LocalFilePlayerAdapter`.
- Implement robust WebSocket client manager handling reconnections, pings, and presence.

### Step 8: UI & Routing Migration
- `src/pages/index.astro`: Landing page with "Create Room" (password mandatory) and "Join Room".
- `src/pages/join/[token].astro`: Invite link landing page. Prompts for `username` only, then forwards to the room.
- `src/pages/room/[id].astro`: Main synchronized player UI (React islands).

### Step 9: Security & Performance Hardening
- Implement rate limiting in Hono.
- Ensure `invite_token` uses cryptographically secure random generation (e.g., `crypto.getRandomValues`).

## 3. Proposed Target Architecture

**Directory Structure:**
```text
/
├── astro.config.mjs       # Astro + CF adapter + React
├── wrangler.jsonc         # CF bindings (DO, D1, KV, etc.)
├── drizzle.config.ts      # Drizzle migrations config
├── src/
│   ├── db/                # D1 Database
│   │   └── schema.ts      # Drizzle schema definition
│   ├── pages/             # Astro file-based routing
│   │   ├── index.astro
│   │   ├── join/[token].astro  # Invite link handler
│   │   └── room/[id].astro
│   ├── components/        # React components (Islands)
│   ├── features/          # Domain logic (Player, Sync)
│   ├── domain/            # Zod schemas, Protocol Types
│   ├── lib/               # Utility functions
├── worker/                # Worker entrypoints
│   ├── index.ts           # Hono API router & Astro SSR proxy
│   └── room.do.ts         # Room Durable Object (Real-time sync)
```

**Architecture Flow:**
1. **API (Hono + D1)**: Hono handles `/api/*`. Checks D1 via Drizzle for room creation, password hashes, and invite token resolution.
2. **Real-time (Hono + DO)**: Hono validates auth/invite token -> Upgrades request to WebSocket -> Passes to Durable Object. DO handles sync.
3. **Client**: Astro serves pages. React islands connect to DO via WS.

## 4. Security Hardening Plan
- **Mandatory Passwords**: Room creation rejects requests without a secure password.
- **Hashing**: Store `password_hash` using standard Web Crypto API (SHA-256 + salt).
- **Pre-Auth Handshake**: Hono API validates credentials or invite tokens and generates a short-lived, signed JWT/token. The client uses this token to establish the WebSocket connection, ensuring the DO doesn't waste compute on unauthorized WS upgrades.
- **Resource Limits**: Limit display names to 32 chars, chat to 500 chars. Add automated room expiration logic in D1/DO.

## 5. Implementation Phases
1. **Planning and architecture docs** *(Completed)*
2. **Astro scaffold + Cloudflare adapter + D1/Drizzle Setup**
3. **Domain types/protocol extraction**
4. **Hono API & D1 Authentication Layer (Create, Auth, Invite)**
5. **Durable Object refactor (Sync state only)**
6. **WebSocket transport and reconnect controller**
7. **Player adapter abstraction + local file adapter**
8. **Room UI migration (Astro + React islands, Invite Flow)**
9. **Security hardening pass**
10. **Comprehensive test/stabilization pass**

## 6. Validation Matrix

| Category | Validation Target | Method |
| --- | --- | --- |
| **Integration** | Room creation fails without password | API Test (Hono) |
| **Integration** | Room creation succeeds, returns token | API Test (Hono) |
| **Integration** | Join via valid password | API Test (Hono) |
| **Integration** | Join via invite token (bypass pass) | API Test (Hono) |
| **E2E / UI** | Invite link prompts for username only | Browser validation |
| **Unit** | DO Room State Reducers (Real-time) | `bun test` |
| **E2E / Manual** | Disconnect / Reconnect / Sync | Multi-tab browser testing |

## 7. Risks and Mitigations
- **Risk**: Splitting state between D1 (metadata) and DO (real-time) creates synchronization complexity if a room is deleted.
  - *Mitigation*: DO `webSocketMessage` handler can occasionally check D1 for room deletion, or we can rely on D1's `expires_at` to auto-cleanup inactive rooms both in the DB and DO.
- **Risk**: Web Crypto API hashing introduces slight latency on the Edge.
  - *Mitigation*: Use fast, secure hashes optimized for the Worker runtime.
- **Risk**: WebSocket connection hijacking.
  - *Mitigation*: Hono hands out a single-use or short-lived signed ticket upon successful D1 authentication. The client passes this ticket in the WebSocket URL (`/ws/:id?ticket=...`), which the DO verifies.

## 8. Immediate Next Actions
1. Request final approval on the updated Hono + D1 + Invite Link architecture.
2. Begin **Phase 2**: Scaffold Astro v6, remove Vinext, setup Drizzle ORM, and configure the local D1 database.