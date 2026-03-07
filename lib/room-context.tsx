import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { User, RoomState, WSClientMessage, WSServerMessage, RoomPermissions, RoomSettings } from "@/types";

interface RoomContextType {
  roomState: RoomState | null;
  currentUser: User | null;
  isConnected: boolean;
  latency: number;
  error: string | null;
  connect: (roomId: string, user: Omit<User, "id">, password?: string) => void;
  disconnect: () => void;
  play: (currentTime: number) => void;
  pause: (currentTime: number) => void;
  seek: (currentTime: number) => void;
  sendMessage: (message: string) => void;
  setPlaybackRate: (rate: number) => void;
  syncRequest: () => void;
  kick: (userId: string) => void;
  updatePermissions: (permissions: RoomPermissions) => void;
  updateRole: (userId: string, isHost: boolean) => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  setLocalPlaybackTime: (time: number) => void;
  latencyHistory: number[];
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState(0);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pingStartRef = useRef<number>(0);
  const localPlaybackTimeRef = useRef(0);

  const send = useCallback((message: WSClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    setIsConnected(false);
    setRoomState(null);
    setCurrentUser(null);
    setError(null);
  }, []);

  const connect = useCallback(
    (roomId: string, user: Omit<User, "id">, password?: string) => {
      disconnect();
      setError(null);
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/${roomId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        send({ type: "join", user, password });
        pingIntervalRef.current = setInterval(() => {
          pingStartRef.current = performance.now();
          ws.send("ping");
        }, 2000);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string" && event.data === "pong") {
          const currentLatency = Math.round(performance.now() - pingStartRef.current);
          setLatency(currentLatency);
          setLatencyHistory((prev) => {
            const next = [...prev, currentLatency];
            return next.length > 40 ? next.slice(next.length - 40) : next;
          });
          return;
        }

        try {
          const msg = JSON.parse(event.data) as WSServerMessage;
          switch (msg.type) {
            case "room-state":
              setRoomState(msg.room);
              setCurrentUser(msg.room.users.find((u) => u.id === msg.yourUserId) ?? null);
              break;
            case "sync":
              setRoomState(msg.room);
              break;
            case "user-joined":
              setRoomState((prev) =>
                prev
                  ? { ...prev, users: [...prev.users.filter((u) => u.id !== msg.user.id), msg.user] }
                  : null,
              );
              break;
            case "user-left":
              setRoomState((prev) =>
                prev ? { ...prev, users: prev.users.filter((u) => u.id !== msg.userId) } : null,
              );
              break;
            case "play":
              setRoomState((prev) =>
                prev ? { ...prev, paused: false, currentTime: msg.currentTime } : null,
              );
              break;
            case "pause":
              setRoomState((prev) =>
                prev ? { ...prev, paused: true, currentTime: msg.currentTime } : null,
              );
              break;
            case "seek":
              setRoomState((prev) => (prev ? { ...prev, currentTime: msg.currentTime } : null));
              break;
            case "playback-rate":
              setRoomState((prev) => (prev ? { ...prev, playbackRate: msg.rate } : null));
              break;
            case "permissions-updated":
              setRoomState((prev) =>
                prev ? { ...prev, permissions: msg.permissions } : null,
              );
              break;
            case "user-timestamp":
              setRoomState((prev) =>
                prev
                  ? {
                      ...prev,
                      users: prev.users.map((user) =>
                        user.id === msg.userId
                          ? { ...user, videoTimestamp: msg.currentTime }
                          : user,
                      ),
                    }
                  : null,
              );
              break;
            case "role-updated":
              setRoomState((prev) =>
                prev
                  ? {
                      ...prev,
                      users: prev.users.map((u) =>
                        u.id === msg.userId ? { ...u, isHost: msg.isHost } : u,
                      ),
                    }
                  : null,
              );
              break;
            case "settings-updated":
              setRoomState((prev) => (prev ? { ...prev, settings: msg.settings } : null));
              break;
            case "kicked":
              disconnect();
              setError("You have been removed from the room");
              break;
            case "chat":
              break;
            case "error":
              setError(msg.message);
              break;
          }
        } catch (err) {
          console.error("Failed to parse websocket message", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      };

      setCurrentUser({ ...user, id: "" });
    },
    [disconnect, send],
  );

  const play = useCallback((currentTime: number) => {
    send({ type: "play", currentTime });
    setRoomState((prev) => (prev ? { ...prev, paused: false, currentTime } : null));
  }, [send]);

  const pause = useCallback((currentTime: number) => {
    send({ type: "pause", currentTime });
    setRoomState((prev) => (prev ? { ...prev, paused: true, currentTime } : null));
  }, [send]);

  const seek = useCallback((currentTime: number) => {
    send({ type: "seek", currentTime });
    setRoomState((prev) => (prev ? { ...prev, currentTime } : null));
  }, [send]);

  const sendMessage = useCallback((message: string) => send({ type: "chat", message }), [send]);
  const setPlaybackRate = useCallback((rate: number) => send({ type: "playback-rate", rate }), [send]);
  const syncRequest = useCallback(() => send({ type: "sync-request" }), [send]);
  const kick = useCallback((userId: string) => send({ type: "kick", userId }), [send]);
  const updatePermissions = useCallback(
    (permissions: RoomPermissions) => send({ type: "update-permissions", permissions }),
    [send],
  );
  const updateRole = useCallback((userId: string, isHost: boolean) => send({ type: "update-role", userId, isHost }), [send]);
  const updateSettings = useCallback((settings: Partial<RoomSettings>) => send({ type: "update-settings", settings }), [send]);
  const setLocalPlaybackTime = useCallback((time: number) => {
    localPlaybackTimeRef.current = time;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      send({ type: "time-update", currentTime: localPlaybackTimeRef.current });
    }, 3000);
    return () => clearInterval(interval);
  }, [send]);

  useEffect(() => () => disconnect(), [disconnect]);

  return (
    <RoomContext.Provider
      value={{
        roomState,
        currentUser,
        isConnected,
        latency,
        latencyHistory,
        error,
        connect,
        disconnect,
        play,
        pause,
        seek,
        sendMessage,
        setPlaybackRate,
        syncRequest,
        kick,
        updatePermissions,
        updateRole,
        updateSettings,
        setLocalPlaybackTime,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return context;
}
