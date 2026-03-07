import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type {
  User,
  RoomState,
  RoomPermissions,
  WSClientMessage,
  WSServerMessage,
} from "@/types";

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
  updatePermissions: (perms: Partial<RoomPermissions>) => void;
  reportTimeUpdate: (currentTime: number) => void;
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
        const joinMessage: WSClientMessage = {
          type: "join",
          user,
          password,
        };
        ws.send(JSON.stringify(joinMessage));

        // Start pinging for latency measurement
        pingIntervalRef.current = setInterval(() => {
          pingStartRef.current = performance.now();
          ws.send("ping");
        }, 2000);
      };

      ws.onmessage = (event) => {
        // Handle automatic pong
        if (typeof event.data === "string" && event.data === "pong") {
          const currentLatency = Math.round(
            performance.now() - pingStartRef.current,
          );
          setLatency(currentLatency);
          setLatencyHistory((prev) => {
            const newHistory = [...prev, currentLatency];
            return newHistory.length > 40
              ? newHistory.slice(newHistory.length - 40)
              : newHistory;
          });
          return;
        }

        try {
          const msg = JSON.parse(event.data) as WSServerMessage;

          switch (msg.type) {
            case "room-state": {
              setRoomState(msg.room);
              // Server tells us our userId — use it to find ourselves in the user list
              const myId = msg.yourUserId;
              const me = msg.room.users.find((u) => u.id === myId);
              if (me) {
                setCurrentUser(me);
              }
              break;
            }

            case "sync":
              setRoomState(msg.room);
              break;

            case "user-joined":
              setRoomState((prev) =>
                prev
                  ? {
                      ...prev,
                      users: [
                        ...prev.users.filter((u) => u.id !== msg.user.id),
                        msg.user,
                      ],
                    }
                  : null,
              );
              break;

            case "user-left":
              setRoomState((prev) =>
                prev
                  ? {
                      ...prev,
                      users: prev.users.filter((u) => u.id !== msg.userId),
                    }
                  : null,
              );
              break;

            case "play":
              setRoomState((prev) =>
                prev
                  ? { ...prev, paused: false, currentTime: msg.currentTime }
                  : null,
              );
              break;

            case "pause":
              setRoomState((prev) =>
                prev
                  ? { ...prev, paused: true, currentTime: msg.currentTime }
                  : null,
              );
              break;

            case "seek":
              setRoomState((prev) =>
                prev ? { ...prev, currentTime: msg.currentTime } : null,
              );
              break;

            case "playback-rate":
              setRoomState((prev) =>
                prev ? { ...prev, playbackRate: msg.rate } : null,
              );
              break;

            case "permissions-updated":
              setRoomState((prev) =>
                prev ? { ...prev, permissions: msg.permissions } : null,
              );
              break;

            case "user-time-update":
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  users: prev.users.map((u) =>
                    u.id === msg.userId
                      ? { ...u, videoTimestamp: msg.currentTime }
                      : u,
                  ),
                };
              });
              break;

            case "kicked":
              setError(msg.reason);
              disconnect();
              break;

            case "chat":
              console.log(`Chat from ${msg.displayName}: ${msg.message}`);
              break;

            case "error":
              console.error("Room error:", msg.message);
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

      ws.onerror = () => {
        setError("Connection failed. The room may not exist.");
        setIsConnected(false);
      };
    },
    [disconnect],
  );

  const sendWS = useCallback((msg: WSClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const play = useCallback(
    (currentTime: number) => {
      sendWS({ type: "play", currentTime });
      setRoomState((prev) =>
        prev ? { ...prev, paused: false, currentTime } : null,
      );
    },
    [sendWS],
  );

  const pause = useCallback(
    (currentTime: number) => {
      sendWS({ type: "pause", currentTime });
      setRoomState((prev) =>
        prev ? { ...prev, paused: true, currentTime } : null,
      );
    },
    [sendWS],
  );

  const seek = useCallback(
    (currentTime: number) => {
      sendWS({ type: "seek", currentTime });
      setRoomState((prev) => (prev ? { ...prev, currentTime } : null));
    },
    [sendWS],
  );

  const sendMessage = useCallback(
    (message: string) => {
      sendWS({ type: "chat", message });
    },
    [sendWS],
  );

  const setPlaybackRate = useCallback(
    (rate: number) => {
      sendWS({ type: "playback-rate", rate });
    },
    [sendWS],
  );

  const syncRequest = useCallback(() => {
    sendWS({ type: "sync-request" });
  }, [sendWS]);

  const kick = useCallback(
    (userId: string) => {
      sendWS({ type: "kick", userId });
    },
    [sendWS],
  );

  const updatePermissions = useCallback(
    (perms: Partial<RoomPermissions>) => {
      sendWS({ type: "update-permissions", permissions: perms });
    },
    [sendWS],
  );

  const reportTimeUpdate = useCallback(
    (currentTime: number) => {
      sendWS({ type: "time-update", currentTime });
    },
    [sendWS],
  );

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

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
        reportTimeUpdate,
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
