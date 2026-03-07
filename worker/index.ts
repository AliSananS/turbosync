import handler from "vinext/server/app-router-entry";
import type { CreateRoomRequest, ApiErrorResponse } from "@/types";

export { Room } from "@/lib/room";

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith("/ws/")) {
      const roomId = path.slice(4);
      if (!roomId) {
        return jsonResponse<ApiErrorResponse>(
          { error: "Room ID is required in path: /ws/:roomId" },
          400,
        );
      }

      const upgrade = request.headers.get("Upgrade");
      if (!upgrade || upgrade !== "websocket") {
        return jsonResponse<ApiErrorResponse>(
          { error: "Expected WebSocket upgrade" },
          426,
        );
      }

      const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
      const exists = await stub.exists();
      if (!exists) {
        return jsonResponse<ApiErrorResponse>({ error: "Room not found" }, 404);
      }
      return stub.fetch(request);
    }

    if (path.startsWith("/api/room")) {
      return handleRoomApi(request, env, path);
    }

    return handler.fetch(request);
  },
};

async function handleRoomApi(
  request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  if (path === "/api/room/create" && request.method === "POST") {
    let body: CreateRoomRequest;
    try {
      body = (await request.json()) as CreateRoomRequest;
    } catch {
      return jsonResponse<ApiErrorResponse>({ error: "Invalid JSON body" }, 400);
    }

    if (!body.name || typeof body.name !== "string") {
      return jsonResponse<ApiErrorResponse>({ error: '"name" is required' }, 400);
    }

    const slug = body.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const stub = env.ROOM.get(env.ROOM.idFromName(slug));
    const result = await stub.createRoom(body.name, body.password);
    const status = result.error ? 409 : 200;
    return jsonResponse({ ...result, slug }, status);
  }

  const existsMatch = path.match(/^\/api\/room\/([^/]+)\/exists$/);
  if (existsMatch && request.method === "GET") {
    const roomId = existsMatch[1];
    const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
    const exists = await stub.exists();
    return jsonResponse({ exists }, 200);
  }

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

function jsonResponse<T>(data: T, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
