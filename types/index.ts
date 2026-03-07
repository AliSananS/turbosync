// ─── User ──────────────────────────────────────────────────────────
export interface User {
  /** Unique session ID (generated on connect) */
  id: string;
  /** Display name shown in the room */
  displayName: string;
  /** Optional avatar URL or gravatar hash */
  avatar?: string;
  /** Whether this user created the room */
  isHost: boolean;
  connectionStatus?: "online" | "idle";
  videoTimestamp?: number;
  latency?: number;
}

export interface RoomPermissions {
  viewersCanControl: boolean;
  viewersCanChat: boolean;
}

export interface RoomSettings {
  syncThreshold: number;
  autoPauseOnBuffering: boolean;
  isPrivate: boolean;
}

// ─── Room ──────────────────────────────────────────────────────────
export interface RoomState {
  /** Deterministic room name (used as DO ID) */
  id: string;
  /** Human-readable room name */
  name: string;
  /** Connected users */
  users: User[];
  /** Current playback timestamp in seconds */
  currentTime: number;
  /** Whether playback is paused */
  paused: boolean;
  /** Playback rate (1 = normal) */
  playbackRate: number;
  permissions?: RoomPermissions;
  settings?: RoomSettings;
}

// ─── WebSocket: Client → Server ────────────────────────────────────

export type WSClientMessageType =
  | "join"
  | "leave"
  | "play"
  | "pause"
  | "seek"
  | "chat"
  | "sync-request"
  | "playback-rate"
  | "kick"
  | "update-permissions"
  | "time-update"
  | "update-role"
  | "update-settings";

export type WSClientMessage =
  | { type: "join"; user: Omit<User, "id">; password?: string }
  | { type: "leave" }
  | { type: "play"; currentTime: number }
  | { type: "pause"; currentTime: number }
  | { type: "seek"; currentTime: number }
  | { type: "chat"; message: string }
  | { type: "sync-request" }
  | { type: "playback-rate"; rate: number }
  | { type: "kick"; userId: string }
  | { type: "update-permissions"; permissions: RoomPermissions }
  | { type: "time-update"; currentTime: number }
  | { type: "update-role"; userId: string; isHost: boolean }
  | { type: "update-settings"; settings: Partial<RoomSettings> };

// ─── WebSocket: Server → Client ────────────────────────────────────

export type WSServerMessageType =
  | "user-joined"
  | "user-left"
  | "play"
  | "pause"
  | "seek"
  | "chat"
  | "sync"
  | "error"
  | "room-state"
  | "playback-rate"
  | "kicked"
  | "permissions-updated"
  | "user-timestamp"
  | "role-updated"
  | "settings-updated";

export type WSServerMessage =
  | { type: "user-joined"; user: User }
  | { type: "user-left"; userId: string }
  | { type: "play"; currentTime: number; userId: string }
  | { type: "pause"; currentTime: number; userId: string }
  | { type: "seek"; currentTime: number; userId: string }
  | { type: "chat"; message: string; userId: string; displayName: string }
  | { type: "sync"; room: RoomState }
  | { type: "error"; code: string; message: string }
  | { type: "room-state"; room: RoomState; yourUserId: string }
  | { type: "playback-rate"; rate: number; userId: string }
  | { type: "kicked" }
  | { type: "permissions-updated"; permissions: RoomPermissions }
  | { type: "user-timestamp"; userId: string; currentTime: number }
  | { type: "role-updated"; userId: string; isHost: boolean }
  | { type: "settings-updated"; settings: RoomSettings };

// ─── REST API ──────────────────────────────────────────────────────

export interface CreateRoomRequest {
  name: string;
  password?: string;
}

export interface CreateRoomResponse {
  roomId: string;
  name: string;
  error?: string;
}

export interface RoomStateResponse {
  room: RoomState;
}

export interface ApiErrorResponse {
  error: string;
}
