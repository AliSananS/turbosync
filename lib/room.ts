import type {
  User,
  RoomState,
  RoomPermissions,
  WSClientMessage,
  WSServerMessage,
  CreateRoomResponse,
  RoomStateResponse,
} from "@/types";
import { DurableObject } from "cloudflare:workers";

// ─── Rate limit bucket configuration ────────────────────────────────
interface RateLimitBucket {
  maxRequests: number;
  windowMs: number;
}

const RATE_LIMIT_BUCKETS: Record<string, RateLimitBucket> = {
  control: { maxRequests: 5, windowMs: 2000 }, // play/pause/seek: 5 per 2s
  chat: { maxRequests: 10, windowMs: 5000 }, // chat: 10 per 5s
  status: { maxRequests: 1, windowMs: 1000 }, // time updates: 1 per 1s
  default: { maxRequests: 20, windowMs: 5000 }, // everything else: 20 per 5s
};

// ─── Session attachment (serialized onto each WebSocket) ───────────
interface SessionAttachment {
  userId: string;
  peerId: string;
  displayName: string;
  avatar?: string;
  /** User's last reported local video timestamp */
  videoTimestamp?: number;
  /** User's measured latency in milliseconds */
  latency?: number;
  /** Rate limit tracking - using plain object for serialization */
  rateLimitInfo?: RateLimitInfo;
  /** Timestamp when user was last seen (for auto-removal) */
  lastSeen: number;
  /** Whether user has loaded the shared video */
  hasVideoLoaded: boolean;
}

interface RateLimitInfo {
  lastReset: number;
  /** Plain object for serialization (Map doesn't serialize well) */
  counts: Record<string, number>;
}

// ─── Default permissions ───────────────────────────────────────────
const DEFAULT_PERMISSIONS: RoomPermissions = {
  viewersCanControl: true,
  viewersCanChat: true,
};

// ─── User timeout settings ─────────────────────────────────────
const USER_OFFLINE_TIMEOUT_MS = 30 * 1000; // 30 seconds without messages = offline

// ─── Room deletion settings ────────────────────────────────────────
const ROOM_INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const ROOM_ACTIVE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour (if users still connected)

// ─── Room Durable Object ───────────────────────────────────────────
export class Room extends DurableObject<Env> {
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
  }

  // ─── RPC: Check if room exists ──────────────────────────────────
  async exists(): Promise<boolean> {
    const name = await this.ctx.storage.get<string>("name");
    return name !== undefined;
  }

  // ─── RPC: Create / initialize room metadata ─────────────────────
  async createRoom(
    name: string,
    password?: string,
  ): Promise<CreateRoomResponse | { conflict: true }> {
    const existingName = await this.ctx.storage.get<string>("name");

    // If the room already exists, reject it
    if (existingName) {
      return { conflict: true };
    }

    interface RoomInitialData {
      name: string;
      paused: boolean;
      currentTime: number;
      playbackRate: number;
      password?: string;
      permissions: RoomPermissions;
      videoUrl?: string;
      subtitleUrl?: string;
      createdAt: number;
      lastActivityAt: number;
    }

    const initialData: Record<string, unknown> = {
      name,
      paused: true,
      currentTime: 0,
      playbackRate: 1,
      permissions: DEFAULT_PERMISSIONS,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    if (password) {
      initialData.password = password;
    }

    await this.ctx.storage.put(initialData);

    // Schedule initial inactivity check
    await this.scheduleInactivityCheck();

    return { roomId: this.ctx.id.toString(), name };
  }

  // ─── RPC: Get room state ────────────────────────────────────────
  async getRoomState(): Promise<RoomStateResponse> {
    const room = await this.buildRoomSnapshot();
    return { room };
  }

  // ─── Schedule inactivity check alarm ────────────────────────────
  private async scheduleInactivityCheck(): Promise<void> {
    const alarmTime = Date.now() + ROOM_INACTIVITY_TIMEOUT_MS;
    await this.ctx.storage.setAlarm(alarmTime);
  }

  // ─── Update last activity timestamp ───────────────────────────────
  private async updateActivity(): Promise<void> {
    await this.ctx.storage.put("lastActivityAt", Date.now());
  }

  // ─── Alarm handler for room cleanup ──────────────────────────────
  async alarm(): Promise<void> {
    // Check for offline users first
    await this.removeOfflineUsers();

    // Check if room has users connected
    if (this.sessions.size === 0) {
      // No users connected - check if it's been inactive for 24 hours
      const lastActivity = await this.ctx.storage.get<number>("lastActivityAt");
      const now = Date.now();

      if (lastActivity && now - lastActivity > ROOM_INACTIVITY_TIMEOUT_MS) {
        // Room has been inactive for 24 hours - delete it
        await this.ctx.storage.deleteAll();
        return;
      }
    }

    // Either users are connected or room hasn't been inactive long enough
    // Schedule another check
    await this.scheduleInactivityCheck();
  }

  // ─── WebSocket upgrade via fetch() ──────────────────────────────
  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade || upgrade !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    // Reject if room doesn't exist
    const roomExists = await this.exists();
    if (!roomExists) {
      return new Response(JSON.stringify({ error: "Room not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.ctx.acceptWebSocket(server);

    const userId = crypto.randomUUID();
    const attachment: SessionAttachment = {
      userId,
      peerId: "", // Will be set on Join
      displayName: "Anonymous",
      lastSeen: Date.now(),
      hasVideoLoaded: false,
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

    // Update lastSeen on any message
    session.lastSeen = Date.now();

    // Check rate limits
    if (this.isRateLimited(session, parsed.type)) {
      this.send(ws, {
        type: "error",
        code: "RATE_LIMITED",
        message: "Too many requests. Please slow down.",
        retryAfter: 2,
      });
      return;
    }

    // Update activity on user actions
    if (
      ["play", "pause", "seek", "chat", "join", "leave"].includes(parsed.type)
    ) {
      await this.updateActivity();
    }

    switch (parsed.type) {
      case "join":
        await this.handleJoin(ws, session, parsed);
        break;
      case "leave":
        await this.handleLeave(ws, session);
        break;
      case "play":
        await this.handlePlaybackAction(
          ws,
          session,
          "play",
          parsed.currentTime,
        );
        break;
      case "pause":
        await this.handlePlaybackAction(
          ws,
          session,
          "pause",
          parsed.currentTime,
        );
        break;
      case "seek":
        await this.handlePlaybackAction(
          ws,
          session,
          "seek",
          parsed.currentTime,
        );
        break;
      case "chat":
        await this.handleChat(ws, session, parsed.message);
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
      case "time-update":
        this.handleTimeUpdate(ws, session, parsed.currentTime);
        break;
      case "kick":
        await this.handleKick(ws, session, parsed.userId);
        break;
      case "update-permissions":
        await this.handleUpdatePermissions(ws, session, parsed.permissions);
        break;
      case "ping":
        // Handle ping with pong response - this measures actual DO processing latency
        this.send(ws, { type: "pong", timestamp: parsed.timestamp });
        break;
      case "video-url":
        await this.handleVideoUrlUpdate(ws, session, parsed.url);
        break;
      case "subtitle-url":
        await this.handleSubtitleUrlUpdate(session, parsed.url);
        break;
      case "video-loaded":
        session.hasVideoLoaded = true;
        this.broadcast(
          {
            type: "video-loaded",
            userId: session.userId,
            displayName: session.displayName,
          },
          ws,
        );
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
    this.sessions.delete(ws);

    try {
      ws.close(code, reason);
    } catch {
      // Socket may already be closed
    }

    if (session) {
      this.broadcast({ type: "user-left", userId: session.userId });
    }

    // Update activity and check if we should schedule cleanup
    await this.updateActivity();
    // Clean up offline users
    await this.removeOfflineUsers();
  }

  // ─── WebSocket error handler ────────────────────────────────────
  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);

    if (session) {
      this.broadcast({ type: "user-left", userId: session.userId });
    }

    await this.updateActivity();
    // Clean up offline users
    await this.removeOfflineUsers();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Rate limiting
  // ═══════════════════════════════════════════════════════════════════

  private isRateLimited(
    session: SessionAttachment,
    messageType: string,
  ): boolean {
    const now = Date.now();

    // Initialize rate limit info if not present
    if (!session.rateLimitInfo) {
      session.rateLimitInfo = {
        lastReset: now,
        counts: {},
      };
    }

    const rateInfo = session.rateLimitInfo;

    // Determine which bucket this message type belongs to
    let bucketName = "default";
    if (["play", "pause", "seek"].includes(messageType)) {
      bucketName = "control";
    } else if (messageType === "chat") {
      bucketName = "chat";
    } else if (messageType === "time-update") {
      bucketName = "status";
    }

    const bucket = RATE_LIMIT_BUCKETS[bucketName];

    // Reset counters if window has passed
    if (now - rateInfo.lastReset > bucket.windowMs) {
      rateInfo.lastReset = now;
      rateInfo.counts = {};
    }

    // Check and increment counter
    const currentCount = rateInfo.counts[bucketName] || 0;
    if (currentCount >= bucket.maxRequests) {
      return true; // Rate limited
    }

    rateInfo.counts[bucketName] = currentCount + 1;
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════════

  private async handleJoin(
    ws: WebSocket,
    session: SessionAttachment,
    msg: Extract<WSClientMessage, { type: "join" }>,
  ): Promise<void> {
    const expectedPassword = await this.ctx.storage.get<string>("password");
    if (expectedPassword && msg.password !== expectedPassword) {
      this.send(ws, {
        type: "error",
        code: "UNAUTHORIZED",
        message: "Invalid room password",
      });
      ws.close(1008, "Invalid room password");
      this.sessions.delete(ws);
      return;
    }

    // Generate userId from slugified displayName
    const slugId = msg.user.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const newUserId = slugId || session.userId; // fallback to generated UUID if name is empty

    // Deduplicate: If another session has the same userId, disconnect it
    for (const [existingWs, existingSession] of this.sessions.entries()) {
      if (existingSession.userId === newUserId && existingWs !== ws) {
        this.sessions.delete(existingWs);
        try {
          existingWs.close(1008, "Joined from another device");
        } catch {}
      }
    }

    // Update session with real user info
    session.userId = newUserId;
    session.displayName = msg.user.displayName;
    session.peerId = msg.user.peerId;
    session.avatar = msg.user.avatar;
    ws.serializeAttachment(session);
    this.sessions.set(ws, session);

    const user = this.sessionToUser(session);

    // Broadcast to everyone else
    this.broadcast({ type: "user-joined", user }, ws);

    // Send current room state to the joining user, including their server-assigned ID
    const roomState = await this.buildRoomSnapshot();
    this.send(ws, {
      type: "room-state",
      room: roomState,
      yourUserId: session.userId,
    });
  }

  private async handleLeave(
    ws: WebSocket,
    session: SessionAttachment,
  ): Promise<void> {
    this.sessions.delete(ws);
    this.broadcast({ type: "user-left", userId: session.userId });
    ws.close(1000, "User left");
  }

  /** Unified playback action handler - anyone can control */
  private async handlePlaybackAction(
    ws: WebSocket,
    session: SessionAttachment,
    action: "play" | "pause" | "seek",
    currentTime: number,
  ): Promise<void> {
    // Everyone can control playback - no permission checks
    switch (action) {
      case "play":
        await this.ctx.storage.put({ paused: false, currentTime });
        this.broadcast(
          {
            type: "play",
            currentTime,
            userId: session.userId,
            displayName: session.displayName,
          },
          ws,
        );
        break;
      case "pause": {
        // When pausing, seek to the furthest user's position
        const furthestTime = this.getFurthestUserTime(currentTime);
        await this.ctx.storage.put({ paused: true, currentTime: furthestTime });
        this.broadcast(
          {
            type: "pause",
            currentTime: furthestTime,
            userId: session.userId,
            displayName: session.displayName,
          },
          ws,
        );
        break;
      }
      case "seek":
        await this.ctx.storage.put("currentTime", currentTime);
        this.broadcast(
          {
            type: "seek",
            currentTime,
            userId: session.userId,
            displayName: session.displayName,
          },
          ws,
        );
        break;
    }
  }

  /** Get the furthest timestamp among all users */
  private getFurthestUserTime(currentTime: number): number {
    let maxTime = currentTime;
    for (const [, session] of this.sessions) {
      if (session.videoTimestamp && session.videoTimestamp > maxTime) {
        maxTime = session.videoTimestamp;
      }
    }
    return maxTime;
  }

  private async handleChat(
    ws: WebSocket,
    session: SessionAttachment,
    message: string,
  ): Promise<void> {
    // Everyone can chat - no permission checks
    this.broadcast({
      type: "chat",
      message,
      userId: session.userId,
      displayName: session.displayName,
    });
  }

  private handleTimeUpdate(
    ws: WebSocket,
    session: SessionAttachment,
    currentTime: number,
  ): void {
    // Update session's video timestamp
    session.videoTimestamp = currentTime;
    ws.serializeAttachment(session);
    this.sessions.set(ws, session);

    // Broadcast to all other clients
    this.broadcast(
      {
        type: "user-time-update",
        userId: session.userId,
        currentTime,
      },
      ws,
    );
  }

  private async handleKick(
    ws: WebSocket,
    session: SessionAttachment,
    targetUserId: string,
  ): Promise<void> {
    // Anyone can kick anyone - democratic approach
    // Find and disconnect the target user
    for (const [targetWs, targetSession] of this.sessions) {
      if (targetSession.userId === targetUserId) {
        this.send(targetWs, {
          type: "kicked",
          reason: "You have been kicked from the room",
        });
        targetWs.close(1000, "Kicked from room");
        this.sessions.delete(targetWs);
        this.broadcast({ type: "user-left", userId: targetUserId });
        return;
      }
    }
  }

  private async handleUpdatePermissions(
    ws: WebSocket,
    session: SessionAttachment,
    newPerms: Partial<RoomPermissions>,
  ): Promise<void> {
    // Anyone can update permissions - democratic approach
    const current = await this.getPermissions();
    const merged: RoomPermissions = { ...current, ...newPerms };
    await this.ctx.storage.put("permissions", merged);

    this.broadcast({ type: "permissions-updated", permissions: merged });
  }

  private async handleVideoUrlUpdate(
    ws: WebSocket,
    session: SessionAttachment,
    url: string,
  ): Promise<void> {
    for (const currentSession of this.sessions.values()) {
      currentSession.hasVideoLoaded = false;
    }

    // Store the video URL and broadcast to all users
    await this.ctx.storage.put("videoUrl", url);
    this.broadcast({
      type: "video-url",
      url,
      userId: session.userId,
      displayName: session.displayName,
    });
  }

  private async handleSubtitleUrlUpdate(
    session: SessionAttachment,
    url: string,
  ): Promise<void> {
    await this.ctx.storage.put("subtitleUrl", url);
    this.broadcast({
      type: "subtitle-url",
      url,
      userId: session.userId,
      displayName: session.displayName,
    });
  }

  private async getPermissions(): Promise<RoomPermissions> {
    const stored = await this.ctx.storage.get<RoomPermissions>("permissions");
    return stored ?? DEFAULT_PERMISSIONS;
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
    const [name, paused, currentTime, playbackRate, permissions, videoUrl, subtitleUrl] =
      await Promise.all([
        this.ctx.storage.get<string>("name"),
        this.ctx.storage.get<boolean>("paused"),
        this.ctx.storage.get<number>("currentTime"),
        this.ctx.storage.get<number>("playbackRate"),
        this.getPermissions(),
        this.ctx.storage.get<string>("videoUrl"),
        this.ctx.storage.get<string>("subtitleUrl"),
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
      videoUrl,
      subtitleUrl,
    };
  }

  /** Remove users who haven't sent messages in USER_OFFLINE_TIMEOUT_MS */
  private async removeOfflineUsers(): Promise<void> {
    const now = Date.now();
    const offlineUsers: string[] = [];

    for (const [ws, session] of this.sessions.entries()) {
      if (now - session.lastSeen > USER_OFFLINE_TIMEOUT_MS) {
        offlineUsers.push(session.userId);
        this.sessions.delete(ws);
        try {
          ws.close(1000, "Idle timeout");
        } catch {}
        this.broadcast({ type: "user-left", userId: session.userId });
      }
    }
  }

  /** Convert a session attachment to a User */
  private sessionToUser(session: SessionAttachment): User {
    return {
      id: session.userId,
      peerId: session.peerId,
      displayName: session.displayName,
      avatar: session.avatar,
      connectionStatus: "online",
      videoTimestamp: session.videoTimestamp,
      latency: session.latency,
      lastSeen: session.lastSeen,
      hasVideoLoaded: session.hasVideoLoaded,
    };
  }
}
