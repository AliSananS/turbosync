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
  | "playback-rate";

export type WSClientMessage =
  | { type: "join"; user: Omit<User, "id"> }
  | { type: "leave" }
  | { type: "play"; currentTime: number }
  | { type: "pause"; currentTime: number }
  | { type: "seek"; currentTime: number }
  | { type: "chat"; message: string }
  | { type: "sync-request" }
  | { type: "playback-rate"; rate: number };

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
  | "playback-rate";

export type WSServerMessage =
  | { type: "user-joined"; user: User }
  | { type: "user-left"; userId: string }
  | { type: "play"; currentTime: number; userId: string }
  | { type: "pause"; currentTime: number; userId: string }
  | { type: "seek"; currentTime: number; userId: string }
  | { type: "chat"; message: string; userId: string; displayName: string }
  | { type: "sync"; room: RoomState }
  | { type: "error"; code: string; message: string }
  | { type: "room-state"; room: RoomState }
  | { type: "playback-rate"; rate: number; userId: string };

// ─── REST API ──────────────────────────────────────────────────────

export interface CreateRoomRequest {
  name: string;
}

export interface CreateRoomResponse {
  roomId: string;
  name: string;
}

export interface RoomStateResponse {
  room: RoomState;
}

export interface ApiErrorResponse {
  error: string;
}
