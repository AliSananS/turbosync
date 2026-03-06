import { DurableObject } from "cloudflare:workers";
import type {
  User,
  RoomState,
  WSClientMessage,
  WSServerMessage,
  CreateRoomResponse,
  RoomStateResponse,
} from "@/types";

// ─── Session attachment (serialized onto each WebSocket) ───────────
interface SessionAttachment {
  userId: string;
  displayName: string;
  avatar?: string;
  isHost: boolean;
}

// ─── Room Durable Object ───────────────────────────────────────────
export class Room extends DurableObject<Env> {
  /**
   * In-memory session map rebuilt from hibernated sockets on wake.
   * Key = WebSocket, Value = user metadata.
   */
  private sessions: Map<WebSocket, SessionAttachment>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Rebuild sessions from any hibernated WebSockets
    this.sessions = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as SessionAttachment | null;
      if (attachment) {
        this.sessions.set(ws, { ...attachment });
      }
    }

    // Automatic ping/pong that doesn't wake the DO from hibernation
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }

  // ─── RPC: Create / initialize room metadata ─────────────────────
  async createRoom(name: string): Promise<CreateRoomResponse> {
    const existing = await this.ctx.storage.get<string>("name");
    if (existing) {
      // Room already exists — return current state
      return { roomId: this.ctx.id.toString(), name: existing };
    }

    await this.ctx.storage.put({
      name,
      paused: true,
      currentTime: 0,
      playbackRate: 1,
    });

    return { roomId: this.ctx.id.toString(), name };
  }

  // ─── RPC: Get room state ────────────────────────────────────────
  async getRoomState(): Promise<RoomStateResponse> {
    const room = await this.buildRoomSnapshot();
    return { room };
  }

  // ─── WebSocket upgrade via fetch() ──────────────────────────────
  async fetch(request: Request): Promise<Response> {
    // Validate upgrade header
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept as a hibernatable WebSocket
    this.ctx.acceptWebSocket(server);

    // Generate session ID; full user info arrives via the "join" message
    const userId = crypto.randomUUID();
    const attachment: SessionAttachment = {
      userId,
      displayName: "Anonymous",
      isHost: this.sessions.size === 0, // first joiner is host
    };
    server.serializeAttachment(attachment);
    this.sessions.set(server, attachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  // ─── WebSocket message handler ──────────────────────────────────
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    let parsed: WSClientMessage;

    try {
      const raw =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);
      parsed = JSON.parse(raw) as WSClientMessage;
    } catch {
      this.send(ws, {
        type: "error",
        code: "INVALID_MESSAGE",
        message: "Could not parse message as JSON",
      });
      return;
    }

    const session = this.sessions.get(ws);
    if (!session) return;

    switch (parsed.type) {
      case "join":
        await this.handleJoin(ws, session, parsed);
        break;
      case "leave":
        await this.handleLeave(ws, session);
        break;
      case "play":
        await this.handlePlay(ws, session, parsed.currentTime);
        break;
      case "pause":
        await this.handlePause(ws, session, parsed.currentTime);
        break;
      case "seek":
        await this.handleSeek(ws, session, parsed.currentTime);
        break;
      case "chat":
        this.broadcast({
          type: "chat",
          message: parsed.message,
          userId: session.userId,
          displayName: session.displayName,
        });
        break;
      case "sync-request": {
        const roomState = await this.buildRoomSnapshot();
        this.send(ws, { type: "sync", room: roomState });
        break;
      }
      case "playback-rate":
        await this.ctx.storage.put("playbackRate", parsed.rate);
        this.broadcast({
          type: "playback-rate",
          rate: parsed.rate,
          userId: session.userId,
        });
        break;
      default:
        this.send(ws, {
          type: "error",
          code: "UNKNOWN_TYPE",
          message: `Unknown message type: ${(parsed as { type: string }).type}`,
        });
    }
  }

  // ─── WebSocket close handler ────────────────────────────────────
  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    const session = this.sessions.get(ws);
    ws.close(code, reason);
    this.sessions.delete(ws);

    if (session) {
      this.broadcast({ type: "user-left", userId: session.userId });
    }
  }

  // ─── WebSocket error handler ────────────────────────────────────
  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);

    if (session) {
      this.broadcast({ type: "user-left", userId: session.userId });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Private helpers
  // ═══════════════════════════════════════════════════════════════════

  private async handleJoin(
    ws: WebSocket,
    session: SessionAttachment,
    msg: Extract<WSClientMessage, { type: "join" }>,
  ): Promise<void> {
    // Update session with real user info
    session.displayName = msg.user.displayName;
    session.avatar = msg.user.avatar;
    session.isHost = msg.user.isHost;
    ws.serializeAttachment(session);
    this.sessions.set(ws, session);

    const user = this.sessionToUser(session);

    // Broadcast to everyone else
    this.broadcast({ type: "user-joined", user }, ws);

    // Send current room state to the joining user
    const roomState = await this.buildRoomSnapshot();
    this.send(ws, { type: "room-state", room: roomState });
  }

  private async handleLeave(
    ws: WebSocket,
    session: SessionAttachment,
  ): Promise<void> {
    this.sessions.delete(ws);
    this.broadcast({ type: "user-left", userId: session.userId });
    ws.close(1000, "User left");
  }

  private async handlePlay(
    ws: WebSocket,
    session: SessionAttachment,
    currentTime: number,
  ): Promise<void> {
    await this.ctx.storage.put({ paused: false, currentTime });
    this.broadcast({ type: "play", currentTime, userId: session.userId }, ws);
  }

  private async handlePause(
    ws: WebSocket,
    session: SessionAttachment,
    currentTime: number,
  ): Promise<void> {
    await this.ctx.storage.put({ paused: true, currentTime });
    this.broadcast({ type: "pause", currentTime, userId: session.userId }, ws);
  }

  private async handleSeek(
    ws: WebSocket,
    session: SessionAttachment,
    currentTime: number,
  ): Promise<void> {
    await this.ctx.storage.put("currentTime", currentTime);
    this.broadcast({ type: "seek", currentTime, userId: session.userId }, ws);
  }

  /** Send a typed message to a single WebSocket */
  private send(ws: WebSocket, message: WSServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Socket may already be closed — ignore
    }
  }

  /** Broadcast a typed message to all connected clients, optionally excluding one */
  private broadcast(message: WSServerMessage, exclude?: WebSocket): void {
    const payload = JSON.stringify(message);
    for (const [ws] of this.sessions) {
      if (ws === exclude) continue;
      try {
        ws.send(payload);
      } catch {
        // Dead socket — will be cleaned up on next close/error
      }
    }
  }

  /** Build a Room snapshot from storage + active sessions */
  private async buildRoomSnapshot(): Promise<RoomState> {
    const [name, paused, currentTime, playbackRate] = await Promise.all([
      this.ctx.storage.get<string>("name"),
      this.ctx.storage.get<boolean>("paused"),
      this.ctx.storage.get<number>("currentTime"),
      this.ctx.storage.get<number>("playbackRate"),
    ]);

    const users: User[] = [];
    for (const [, session] of this.sessions) {
      users.push(this.sessionToUser(session));
    }

    return {
      id: this.ctx.id.toString(),
      name: name ?? "Unnamed Room",
      users,
      currentTime: currentTime ?? 0,
      paused: paused ?? true,
      playbackRate: playbackRate ?? 1,
    };
  }

  /** Convert a session attachment to a User */
  private sessionToUser(session: SessionAttachment): User {
    return {
      id: session.userId,
      displayName: session.displayName,
      avatar: session.avatar,
      isHost: session.isHost,
    };
  }
}
