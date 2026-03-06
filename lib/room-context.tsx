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

      // Determine WebSocket URL based on current protocol
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/${roomId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Send join message
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
            case "room-state":
            case "sync":
              setRoomState(msg.room);
              // On initial join, if we don't have a full user object, try to find ourselves
              if (currentUser && !currentUser.id) {
                const me = msg.room.users.find(
                  (u) => u.displayName === currentUser.displayName,
                );
                if (me) setCurrentUser(me);
              }
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

            case "chat":
              // To be implemented in UI
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

      // Keep optimistic current user until server assigns fully
      setCurrentUser(user as User);
    },
    [disconnect],
  );

  const play = useCallback((currentTime: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "play", currentTime } as WSClientMessage),
      );
      setRoomState((prev) =>
        prev ? { ...prev, paused: false, currentTime } : null,
      );
    }
  }, []);

  const pause = useCallback((currentTime: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "pause", currentTime } as WSClientMessage),
      );
      setRoomState((prev) =>
        prev ? { ...prev, paused: true, currentTime } : null,
      );
    }
  }, []);

  const seek = useCallback((currentTime: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "seek", currentTime } as WSClientMessage),
      );
      setRoomState((prev) => (prev ? { ...prev, currentTime } : null));
    }
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "chat", message } as WSClientMessage),
      );
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "playback-rate", rate } as WSClientMessage),
      );
    }
  }, []);

  const syncRequest = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "sync-request" } as WSClientMessage),
      );
    }
  }, []);

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
