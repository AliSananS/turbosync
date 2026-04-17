import handler from "vinext/server/app-router-entry";
import type {
  CreateRoomRequest,
  ApiErrorResponse,
  RoomExistsResponse,
} from "@/types";

// Re-export the Durable Object class so wrangler can discover it
export { Room } from "@/lib/room";

// ─── CORS helpers ─────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

function corsify(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function handleOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // ─── Preflight: respond to all OPTIONS requests ───────────────
    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    // ─── CORS Proxy: GET /api/proxy?url=<encoded-url> ─────────────
    if (path === "/api/proxy" && request.method === "GET") {
      return corsify(await handleProxy(url));
    }

    // ─── WebSocket upgrade: GET /ws/:roomId ───────────────────────
    if (path.startsWith("/ws/")) {
      const roomId = path.slice(4);
      if (!roomId) {
        return corsify(
          jsonResponse<ApiErrorResponse>(
            { error: "Room ID is required in path: /ws/:roomId" },
            400,
          ),
        );
      }

      const upgrade = request.headers.get("Upgrade");
      if (!upgrade || upgrade !== "websocket") {
        return corsify(
          jsonResponse<ApiErrorResponse>(
            { error: "Expected WebSocket upgrade" },
            426,
          ),
        );
      }

      // Validate room exists before proxying
      const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
      const exists = await stub.exists();
      if (!exists) {
        return corsify(
          jsonResponse<ApiErrorResponse>({ error: "Room not found" }, 404),
        );
      }

      return stub.fetch(request);
    }

    // ─── REST API: /api/room/* ────────────────────────────────────
    if (path.startsWith("/api/room")) {
      return corsify(await handleRoomApi(request, env, path));
    }

    // ─── Everything else → vinext (Next.js) ───────────────────────
    return handler.fetch(request);
  },
};

// ═══════════════════════════════════════════════════════════════════
//  REST API router
// ═══════════════════════════════════════════════════════════════════

async function handleRoomApi(
  request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  // POST /api/room/create
  if (path === "/api/room/create" && request.method === "POST") {
    let body: CreateRoomRequest;
    try {
      body = (await request.json()) as CreateRoomRequest;
    } catch {
      return jsonResponse<ApiErrorResponse>(
        { error: "Invalid JSON body" },
        400,
      );
    }

    if (!body.name || typeof body.name !== "string") {
      return jsonResponse<ApiErrorResponse>(
        { error: '"name" is required' },
        400,
      );
    }

    const slug = toSlug(body.name);
    const stub = env.ROOM.get(env.ROOM.idFromName(slug));
    const result = await stub.createRoom(
      body.name,
      body.password,
      body.hostPeerId,
    );

    // Room name is already taken by another host
    if ("conflict" in result && result.conflict) {
      return jsonResponse<ApiErrorResponse>(
        {
          error: `A room named "${body.name}" already exists. Choose a different name.`,
        },
        409,
      );
    }

    return jsonResponse({ ...result, slug }, 200);
  }

  // GET /api/room/:roomId/exists
  const existsMatch = path.match(/^\/api\/room\/([^/]+)\/exists$/);
  if (existsMatch && request.method === "GET") {
    const roomId = existsMatch[1];
    const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
    const exists = await stub.exists();
    return jsonResponse<RoomExistsResponse>({ exists }, 200);
  }

  // GET /api/room/:roomId
  const match = path.match(/^\/api\/room\/([^/]+)$/);
  if (match && request.method === "GET") {
    const roomId = match[1];
    const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
    const exists = await stub.exists();
    if (!exists) {
      return jsonResponse<ApiErrorResponse>({ error: "Room not found" }, 404);
    }
    const result = await stub.getRoomState();
    return jsonResponse(result, 200);
  }

  return jsonResponse<ApiErrorResponse>({ error: "Not found" }, 404);
}

// ═══════════════════════════════════════════════════════════════════
//  CORS Proxy — fetches a remote resource and serves it with CORS
//  Usage: GET /api/proxy?url=<encoded-url>
// ═══════════════════════════════════════════════════════════════════

async function handleProxy(reqUrl: URL): Promise<Response> {
  const targetUrl = reqUrl.searchParams.get("url");
  if (!targetUrl) {
    return jsonResponse<ApiErrorResponse>(
      { error: "Missing required query parameter: url" },
      400,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return jsonResponse<ApiErrorResponse>(
      { error: "Invalid URL provided" },
      400,
    );
  }

  // Only allow http/https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return jsonResponse<ApiErrorResponse>(
      { error: "Only http and https URLs are supported" },
      400,
    );
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Turbosync-Proxy/1.0" },
    });

    const headers = new Headers();
    // Forward content-type from upstream
    const ct = upstream.headers.get("Content-Type");
    if (ct) headers.set("Content-Type", ct);
    // Forward content-length if available
    const cl = upstream.headers.get("Content-Length");
    if (cl) headers.set("Content-Length", cl);
    // Cache proxied content for 1 hour
    headers.set("Cache-Control", "public, max-age=3600");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    return jsonResponse<ApiErrorResponse>(
      { error: "Failed to fetch the remote resource" },
      502,
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function jsonResponse<T>(data: T, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
