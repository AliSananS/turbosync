import type {
  User,
  RoomState,
  WSClientMessage,
  WSServerMessage,
  CreateRoomResponse,
  RoomStateResponse,
  RoomPermissions,
  RoomSettings,
} from "@/types";
import { DurableObject } from "cloudflare:workers";

interface SessionAttachment {
  userId: string;
  displayName: string;
  avatar?: string;
  isHost: boolean;
  currentTime: number;
  connectionStatus: "online" | "idle";
  latency?: number;
}

const DEFAULT_PERMISSIONS: RoomPermissions = {
  viewersCanControl: false,
  viewersCanChat: true,
};

const DEFAULT_SETTINGS: RoomSettings = {
  syncThreshold: 150,
  autoPauseOnBuffering: true,
  isPrivate: false,
};

export class Room extends DurableObject<Env> {
  private sessions: Map<WebSocket, SessionAttachment>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sessions = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as SessionAttachment | null;
      if (attachment) this.sessions.set(ws, { ...attachment });
    }
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }

  async exists(): Promise<boolean> {
    const name = await this.ctx.storage.get<string>("name");
    return Boolean(name);
  }

  async createRoom(name: string, password?: string): Promise<CreateRoomResponse> {
    const existing = await this.ctx.storage.get<string>("name");
    if (existing && this.sessions.size > 0) {
      return {
        roomId: this.ctx.id.toString(),
        name: existing,
        error: "Room already active",
      };
    }

    const initialData: Record<string, unknown> = {
      name,
      paused: true,
      currentTime: 0,
      playbackRate: 1,
      permissions: DEFAULT_PERMISSIONS,
      settings: {
        ...DEFAULT_SETTINGS,
        isPrivate: Boolean(password),
      },
    };

    if (password) {
      initialData.password = password;
    } else {
      await this.ctx.storage.delete("password");
    }

    await this.ctx.storage.put(initialData);
    return { roomId: this.ctx.id.toString(), name };
  }

  async getRoomState(): Promise<RoomStateResponse> {
    const room = await this.buildRoomSnapshot();
    return { room };
  }

  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    this.ctx.acceptWebSocket(server);

    const userId = crypto.randomUUID();
    const attachment: SessionAttachment = {
      userId,
      displayName: "Anonymous",
      isHost: this.sessions.size === 0,
      currentTime: 0,
      connectionStatus: "online",
    };
    server.serializeAttachment(attachment);
    this.sessions.set(server, attachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
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
        return;
      case "leave":
        await this.handleLeave(ws, session);
        return;
      case "play":
      case "pause":
      case "seek": {
        const permissions = await this.getPermissions();
        if (!session.isHost && !permissions.viewersCanControl) {
          this.send(ws, {
            type: "error",
            code: "FORBIDDEN",
            message: "Viewers are not allowed to control playback",
          });
          return;
        }
        if (parsed.type === "play") await this.handlePlay(ws, session, parsed.currentTime);
        if (parsed.type === "pause") await this.handlePause(ws, session, parsed.currentTime);
        if (parsed.type === "seek") await this.handleSeek(ws, session, parsed.currentTime);
        return;
      }
      case "chat": {
        const permissions = await this.getPermissions();
        if (!session.isHost && !permissions.viewersCanChat) {
          this.send(ws, {
            type: "error",
            code: "FORBIDDEN",
            message: "Chat is disabled for viewers",
          });
          return;
        }
        this.broadcast({
          type: "chat",
          message: parsed.message,
          userId: session.userId,
          displayName: session.displayName,
        });
        return;
      }
      case "sync-request": {
        const roomState = await this.buildRoomSnapshot();
        this.send(ws, { type: "sync", room: roomState });
        return;
      }
      case "playback-rate":
        await this.ctx.storage.put("playbackRate", parsed.rate);
        this.broadcast({ type: "playback-rate", rate: parsed.rate, userId: session.userId });
        return;
      case "kick":
        await this.handleKick(ws, session, parsed.userId);
        return;
      case "update-permissions":
        await this.handleUpdatePermissions(ws, session, parsed.permissions);
        return;
      case "time-update":
        session.currentTime = parsed.currentTime;
        session.connectionStatus = "online";
        ws.serializeAttachment(session);
        this.sessions.set(ws, session);
        this.broadcast({
          type: "user-timestamp",
          userId: session.userId,
          currentTime: parsed.currentTime,
        });
        return;
      case "update-role":
        await this.handleRoleUpdate(ws, session, parsed.userId, parsed.isHost);
        return;
      case "update-settings":
        await this.handleUpdateSettings(ws, session, parsed.settings);
        return;
      default:
        this.send(ws, {
          type: "error",
          code: "UNKNOWN_TYPE",
          message: `Unknown message type: ${(parsed as { type: string }).type}`,
        });
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);
    if (session) this.broadcast({ type: "user-left", userId: session.userId });
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);
    if (session) this.broadcast({ type: "user-left", userId: session.userId });
  }

  private async handleJoin(
    ws: WebSocket,
    session: SessionAttachment,
    msg: Extract<WSClientMessage, { type: "join" }>,
  ): Promise<void> {
    const expectedPassword = await this.ctx.storage.get<string>("password");
    if (expectedPassword && msg.password !== expectedPassword) {
      this.send(ws, { type: "error", code: "UNAUTHORIZED", message: "Invalid room password" });
      ws.close(1008, "Invalid room password");
      this.sessions.delete(ws);
      return;
    }

    session.displayName = msg.user.displayName;
    session.avatar = msg.user.avatar;
    session.isHost = msg.user.isHost;
    session.latency = msg.user.latency;
    ws.serializeAttachment(session);
    this.sessions.set(ws, session);

    const user = this.sessionToUser(session);
    this.broadcast({ type: "user-joined", user }, ws);

    const roomState = await this.buildRoomSnapshot();
    this.send(ws, { type: "room-state", room: roomState, yourUserId: session.userId });
  }

  private async handleLeave(ws: WebSocket, session: SessionAttachment): Promise<void> {
    this.sessions.delete(ws);
    this.broadcast({ type: "user-left", userId: session.userId });
    ws.close(1000, "User left");
  }

  private async handlePlay(ws: WebSocket, session: SessionAttachment, currentTime: number): Promise<void> {
    await this.ctx.storage.put({ paused: false, currentTime });
    this.broadcast({ type: "play", currentTime, userId: session.userId }, ws);
  }

  private async handlePause(ws: WebSocket, session: SessionAttachment, currentTime: number): Promise<void> {
    await this.ctx.storage.put({ paused: true, currentTime });
    this.broadcast({ type: "pause", currentTime, userId: session.userId }, ws);
  }

  private async handleSeek(ws: WebSocket, session: SessionAttachment, currentTime: number): Promise<void> {
    await this.ctx.storage.put("currentTime", currentTime);
    this.broadcast({ type: "seek", currentTime, userId: session.userId }, ws);
  }

  private async handleKick(ws: WebSocket, session: SessionAttachment, userId: string): Promise<void> {
    if (!session.isHost) return;
    for (const [targetWs, target] of this.sessions) {
      if (target.userId === userId) {
        this.send(targetWs, { type: "kicked" });
        targetWs.close(1008, "Kicked by host");
        this.sessions.delete(targetWs);
        this.broadcast({ type: "user-left", userId });
        return;
      }
    }
    this.send(ws, { type: "error", code: "NOT_FOUND", message: "User not found" });
  }

  private async handleUpdatePermissions(
    ws: WebSocket,
    session: SessionAttachment,
    permissions: RoomPermissions,
  ): Promise<void> {
    if (!session.isHost) return;
    await this.ctx.storage.put("permissions", permissions);
    this.broadcast({ type: "permissions-updated", permissions });
  }

  private async handleRoleUpdate(
    _ws: WebSocket,
    session: SessionAttachment,
    userId: string,
    isHost: boolean,
  ): Promise<void> {
    if (!session.isHost) return;
    for (const [targetWs, target] of this.sessions) {
      if (target.userId === userId) {
        target.isHost = isHost;
        targetWs.serializeAttachment(target);
        this.sessions.set(targetWs, target);
        this.broadcast({ type: "role-updated", userId, isHost });
      }
    }
  }

  private async handleUpdateSettings(
    _ws: WebSocket,
    session: SessionAttachment,
    settings: Partial<RoomSettings>,
  ): Promise<void> {
    if (!session.isHost) return;
    const current = await this.getSettings();
    const next = { ...current, ...settings };
    await this.ctx.storage.put("settings", next);
    this.broadcast({ type: "settings-updated", settings: next });
  }

  private send(ws: WebSocket, message: WSServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {}
  }

  private broadcast(message: WSServerMessage, exclude?: WebSocket): void {
    const payload = JSON.stringify(message);
    for (const [ws] of this.sessions) {
      if (ws === exclude) continue;
      try {
        ws.send(payload);
      } catch {}
    }
  }

  private async getPermissions(): Promise<RoomPermissions> {
    const permissions = await this.ctx.storage.get<RoomPermissions>("permissions");
    return permissions ?? DEFAULT_PERMISSIONS;
  }

  private async getSettings(): Promise<RoomSettings> {
    const settings = await this.ctx.storage.get<RoomSettings>("settings");
    return settings ?? DEFAULT_SETTINGS;
  }

  private async buildRoomSnapshot(): Promise<RoomState> {
    const [name, paused, currentTime, playbackRate, permissions, settings] =
      await Promise.all([
        this.ctx.storage.get<string>("name"),
        this.ctx.storage.get<boolean>("paused"),
        this.ctx.storage.get<number>("currentTime"),
        this.ctx.storage.get<number>("playbackRate"),
        this.getPermissions(),
        this.getSettings(),
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
      permissions,
      settings,
    };
  }

  private sessionToUser(session: SessionAttachment): User {
    return {
      id: session.userId,
      displayName: session.displayName,
      avatar: session.avatar,
      isHost: session.isHost,
      connectionStatus: session.connectionStatus,
      videoTimestamp: session.currentTime,
      latency: session.latency,
    };
  }
}
