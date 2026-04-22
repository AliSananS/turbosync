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
  SyncProgress,
  SyncStatus,
} from "@/types";
import { toast } from "sonner";

// Extended context type with sync info
interface RoomContextType {
  roomState: RoomState | null;
  currentUser: User | null;
  isConnected: boolean;
  latency: number;
  error: string | null;
  connect: (
    roomId: string,
    user: Omit<User, "id"> & { peerId?: string },
    password?: string,
  ) => void;
  disconnect: (clearParams?: boolean) => void;
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
  // Sync state
  syncProgress: SyncProgress | null;
  isSyncing: boolean;
  // Reconnection state
  reconnectState: {
    isReconnecting: boolean;
    attempts: number;
    nextRetryIn: number;
  };
  forceReconnect: () => void;
  // Video URL
  setVideoUrl: (url: string) => void;
  pendingVideoUrl: string | null;
  clearPendingVideoUrl: () => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

// Sync configuration constants
const SYNC_CONFIG = {
  // Thresholds
  SEEK_THRESHOLD: 5, // seconds - seek immediately if drift > this
  CATCHUP_THRESHOLD: 2, // seconds - use playback rate if drift > this
  SYNC_CHECK_INTERVAL: 1000, // ms - how often to check drift
  // Playback rates
  NORMAL_RATE: 1.0,
  CATCHUP_RATE: 1.25, // 25% faster when catching up
  CATCHUP_SLOW_RATE: 1.1, // 10% faster for smaller drifts
  SLOWDOWN_RATE: 0.95, // 5% slower if ahead
  // Pause behavior
  PAUSE_SEEK_THRESHOLD: 1, // seconds - seek on pause if someone is ahead by this much
};

// Reconnection configuration
const RECONNECT_CONFIG = {
  BASE_DELAY: 500, // Start at 500ms
  MAX_DELAY: 30000, // Cap at 30 seconds
  MULTIPLIER: 1.5, // Exponential backoff multiplier
  JITTER_MAX: 1000, // Max 1000ms jitter
  MAX_ATTEMPTS: 50, // Max attempts before giving up
  FAST_RETRY_ATTEMPTS: 3, // First 3 attempts are fast
  FAST_RETRY_DELAY: 500, // 500ms for fast retries
};

// Helper to calculate sync progress
function calculateSyncProgress(
  currentTime: number,
  roomTime: number,
  latency: number,
  currentStatus: SyncStatus | null,
  syncStartTime: number | null,
): SyncProgress {
  // Account for network latency when calculating drift
  const latencyCompensation = latency / 1000 / 2; // Assume half latency each direction
  const drift = roomTime - (currentTime + latencyCompensation);
  const driftAbs = Math.abs(drift);

  let status: SyncStatus;
  let appliedRate = SYNC_CONFIG.NORMAL_RATE;
  let progressPercent = 100;
  let estimatedTimeMs = 0;

  if (driftAbs < SYNC_CONFIG.CATCHUP_THRESHOLD) {
    status = "synced";
  } else if (drift > SYNC_CONFIG.SEEK_THRESHOLD) {
    status = "seeking";
    appliedRate = SYNC_CONFIG.NORMAL_RATE;
    progressPercent = 0;
  } else if (drift > SYNC_CONFIG.CATCHUP_THRESHOLD) {
    status = "catching-up";
    // If we were already catching up, keep the rate, otherwise start fresh
    if (currentStatus === "catching-up" && syncStartTime) {
      // Calculate progress based on time elapsed vs expected catch-up time
      const elapsed = Date.now() - syncStartTime;
      const timeToCatch = drift / (SYNC_CONFIG.CATCHUP_RATE - 1);
      progressPercent = Math.min(100, (elapsed / 1000 / timeToCatch) * 100);
      estimatedTimeMs = Math.max(0, timeToCatch * 1000 - elapsed);
    } else {
      appliedRate = SYNC_CONFIG.CATCHUP_RATE;
      const timeToCatch = drift / (SYNC_CONFIG.CATCHUP_RATE - 1);
      estimatedTimeMs = timeToCatch * 1000;
      progressPercent = 0;
    }
  } else if (drift > 0) {
    status = "behind";
    appliedRate = SYNC_CONFIG.CATCHUP_SLOW_RATE;
  } else {
    status = "ahead";
    appliedRate = SYNC_CONFIG.SLOWDOWN_RATE;
  }

  return {
    status,
    drift,
    targetTime: roomTime,
    currentTime: currentTime + latencyCompensation,
    progressPercent: Math.round(progressPercent),
    estimatedTimeMs: Math.round(estimatedTimeMs),
    appliedRate,
    syncStartTime: syncStartTime || Date.now(),
  };
}

// Calculate reconnection delay with jitter
function calculateReconnectDelay(attempts: number): number {
  if (attempts < RECONNECT_CONFIG.FAST_RETRY_ATTEMPTS) {
    return RECONNECT_CONFIG.FAST_RETRY_DELAY;
  }

  const exponentialDelay =
    RECONNECT_CONFIG.BASE_DELAY *
    Math.pow(RECONNECT_CONFIG.MULTIPLIER, attempts);
  const cappedDelay = Math.min(exponentialDelay, RECONNECT_CONFIG.MAX_DELAY);
  const jitter = Math.random() * RECONNECT_CONFIG.JITTER_MAX;
  return Math.round(cappedDelay + jitter);
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState(0);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [reconnectState, setReconnectState] = useState({
    isReconnecting: false,
    attempts: 0,
    nextRetryIn: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reconnectAttemptsRef = useRef(0);
  const connectionParamsRef = useRef<{
    roomId: string;
    user: Omit<User, "id"> & { peerId?: string };
    password?: string;
  } | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingStartRef = useRef<number>(0);
  const lastPongReceivedAtRef = useRef<number>(0);
  const syncStartTimeRef = useRef<number | null>(null);
  const lastDriftRef = useRef<number>(0);
  const reconnectCountdownRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Helper: Get or create persistent peerId
  const getPeerId = useCallback(() => {
    if (typeof window === "undefined") return "";
    let pid = localStorage.getItem("turbosync_peerid");
    if (!pid) {
      pid = crypto.randomUUID();
      localStorage.setItem("turbosync_peerid", pid);
    }
    return pid;
  }, []);

  // Clear reconnection countdown
  const clearReconnectCountdown = useCallback(() => {
    if (reconnectCountdownRef.current) {
      clearInterval(reconnectCountdownRef.current);
      reconnectCountdownRef.current = null;
    }
  }, []);

  const disconnect = useCallback(
    (clearParams = true) => {
      clearReconnectCountdown();
      if (wsRef.current) {
        // Remove handlers before closing to prevent unwanted reconnects during intentional disconnect
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (clearParams) {
        connectionParamsRef.current = null;
        reconnectAttemptsRef.current = 0;
        setRoomState(null);
        setCurrentUser(null);
        setError(null);
        setSyncProgress(null);
        syncStartTimeRef.current = null;
        setReconnectState({
          isReconnecting: false,
          attempts: 0,
          nextRetryIn: 0,
        });
      } else {
        setReconnectState((prev) => ({ ...prev, isReconnecting: false }));
      }
      setIsConnected(false);
    },
    [clearReconnectCountdown],
  );

  const connect = useCallback(
    (
      roomId: string,
      user: Omit<User, "id"> & { peerId?: string },
      password?: string,
    ) => {
      // Save params for reconnection
      connectionParamsRef.current = { roomId, user, password };

      // Ensure peerId is present
      const joinUser = {
        ...user,
        peerId: user.peerId || getPeerId(),
      };

      disconnect(false); // Close existing but keep params

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/${roomId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        setReconnectState({
          isReconnecting: false,
          attempts: 0,
          nextRetryIn: 0,
        });
        clearReconnectCountdown();

        const joinMessage: WSClientMessage = {
          type: "join",
          user: joinUser,
          password,
        };
        ws.send(JSON.stringify(joinMessage));

        // Start pinging for latency measurement
        lastPongReceivedAtRef.current = performance.now();
        pingIntervalRef.current = setInterval(() => {
          const now = performance.now();
          // Only send ping if connection is still open (readyState === 1)
          if (ws.readyState !== 1) return;

          // If we haven't received a pong in over 10s, assume connection is dead
          if (now - lastPongReceivedAtRef.current > 10000) {
            console.warn("Pong timeout, force closing for reconnection...");
            ws.close(); // Triggers onclose and auto-reconnect
            return;
          }
          pingStartRef.current = now;
          const pingMessage: WSClientMessage = { type: "ping", timestamp: now };
          ws.send(JSON.stringify(pingMessage));
        }, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSServerMessage;

          // Handle pong for latency calculation
          if (msg.type === "pong" && msg.timestamp) {
            const now = performance.now();
            lastPongReceivedAtRef.current = now;
            // Calculate true RTT: time from sending ping to receiving pong
            const currentLatency = Math.round(now - msg.timestamp);
            setLatency(currentLatency);
            setLatencyHistory((prev) => {
              const newHistory = [...prev, currentLatency];
              return newHistory.length > 40
                ? newHistory.slice(newHistory.length - 40)
                : newHistory;
            });

            // Also update our latency in room state
            setRoomState((prev) => {
              if (!prev || !currentUser) return prev;
              return {
                ...prev,
                users: prev.users.map((u) =>
                  u.id === currentUser.id
                    ? { ...u, latency: currentLatency }
                    : u,
                ),
              };
            });
            return;
          }

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
              setRoomState((prev) => {
                if (!prev) return msg.room;
                // Preserve 'away' users that aren't in the new snapshot
                const onlineIds = new Set(msg.room.users.map((u) => u.id));
                const awayUsers = prev.users.filter(
                  (u) => u.connectionStatus === "away" && !onlineIds.has(u.id),
                );
                return {
                  ...msg.room,
                  users: [...msg.room.users, ...awayUsers],
                };
              });
              break;

            case "user-joined":
              toast.success(`${msg.user.displayName} joined the room`);
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
              setRoomState((prev) => {
                if (!prev) return null;
                const user = prev.users.find((u) => u.id === msg.userId);
                if (user && user.connectionStatus !== "away") {
                  toast.info(`${user.displayName} disconnected`);
                }
                return {
                  ...prev,
                  users: prev.users.map((u) =>
                    u.id === msg.userId
                      ? { ...u, connectionStatus: "away" as const }
                      : u,
                  ),
                };
              });
              break;

            case "play":
              setRoomState((prev) =>
                prev
                  ? { ...prev, paused: false, currentTime: msg.currentTime }
                  : null,
              );
              break;

            case "pause":
              setRoomState((prev) => {
                if (!prev) return null;
                return { ...prev, paused: true, currentTime: msg.currentTime };
              });
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

            case "user-latency-update":
              setRoomState((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  users: prev.users.map((u) =>
                    u.id === msg.userId ? { ...u, latency: msg.latency } : u,
                  ),
                };
              });
              break;

            case "video-url":
              setRoomState((prev) => {
                if (!prev) return null;
                // Only show notification if it's a different video
                if (prev.videoUrl !== msg.url) {
                  setPendingVideoUrl(msg.url);
                  toast.info(`${msg.displayName} shared a video`, {
                    description: "Click to load it",
                    action: {
                      label: "Load",
                      onClick: () => {
                        setPendingVideoUrl(null);
                        // Navigate to load the video
                        window.location.reload();
                      },
                    },
                    duration: 10000,
                  });
                }
                return {
                  ...prev,
                  videoUrl: msg.url,
                };
              });
              break;

            case "kicked":
              setError(msg.reason);
              disconnect(true); // Intentional kick = stop reconnecting
              break;

            case "chat":
              console.log(`Chat from ${msg.displayName}: ${msg.message}`);
              break;

            case "error":
              console.error("Room error:", msg.message);
              // Only stop reconnecting if it's an auth/not-found error
              if (msg.code === "UNAUTHORIZED" || msg.code === "NOT_FOUND") {
                setError(msg.message);
                disconnect(true);
              } else if (msg.code === "RATE_LIMITED") {
                toast.warning("Slow down", {
                  description: msg.message,
                });
              } else {
                setError(msg.message);
              }
              break;
          }
        } catch (err) {
          console.error("Failed to parse websocket message", err);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt reconnection if not closed intentionally
        if (event.code !== 1000 && connectionParamsRef.current) {
          const attempts = reconnectAttemptsRef.current;

          if (attempts >= RECONNECT_CONFIG.MAX_ATTEMPTS) {
            setError("Connection lost. Max reconnection attempts reached.");
            disconnect(true);
            return;
          }

          const delay = calculateReconnectDelay(attempts);
          reconnectAttemptsRef.current += 1;

          setReconnectState({
            isReconnecting: true,
            attempts: reconnectAttemptsRef.current,
            nextRetryIn: delay,
          });

          // Start countdown
          let remaining = delay;
          clearReconnectCountdown();
          reconnectCountdownRef.current = setInterval(() => {
            remaining -= 1000;
            if (remaining <= 0) {
              clearReconnectCountdown();
            } else {
              setReconnectState((prev) => ({
                ...prev,
                nextRetryIn: remaining,
              }));
            }
          }, 1000);

          reconnectTimeoutRef.current = setTimeout(() => {
            clearReconnectCountdown();
            const params = connectionParamsRef.current;
            if (params) {
              connect(params.roomId, params.user, params.password);
            }
          }, delay);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        // Error handler mostly triggers before close, let onclose handle the retry logic
      };
    },
    [disconnect, getPeerId, clearReconnectCountdown],
  );

  // Force reconnection
  const forceReconnect = useCallback(() => {
    clearReconnectCountdown();
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    const params = connectionParamsRef.current;
    if (params) {
      connect(params.roomId, params.user, params.password);
    }
  }, [connect, clearReconnectCountdown]);

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

  const setVideoUrl = useCallback(
    (url: string) => {
      sendWS({ type: "video-url", url });
      setRoomState((prev) => (prev ? { ...prev, videoUrl: url } : null));
    },
    [sendWS],
  );

  // Pending video URL state (for shared videos)
  const [pendingVideoUrl, setPendingVideoUrl] = useState<string | null>(null);

  const clearPendingVideoUrl = useCallback(() => {
    setPendingVideoUrl(null);
  }, []);

  // Sync progress calculation - can be called by components
  const calculateSync = useCallback(
    (currentTime: number, roomTime: number): SyncProgress => {
      const progress = calculateSyncProgress(
        currentTime,
        roomTime,
        latency,
        syncProgress?.status || null,
        syncStartTimeRef.current,
      );

      // Update sync start time if we're starting to catch up
      if (
        progress.status === "catching-up" &&
        syncProgress?.status !== "catching-up"
      ) {
        syncStartTimeRef.current = Date.now();
      }

      // Reset if we're synced
      if (progress.status === "synced") {
        syncStartTimeRef.current = null;
      }

      setSyncProgress(progress);
      lastDriftRef.current = progress.drift;
      return progress;
    },
    [latency, syncProgress],
  );

  // Get max timestamp from all users (for pause behavior)
  const getMaxUserTimestamp = useCallback((): number => {
    if (!roomState) return 0;
    return Math.max(0, ...roomState.users.map((u) => u.videoTimestamp || 0));
  }, [roomState]);

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
        // Sync state
        syncProgress,
        isSyncing:
          syncProgress?.status === "catching-up" ||
          syncProgress?.status === "seeking" ||
          false,
        // Reconnection state
        reconnectState,
        forceReconnect,
        // Video URL
        setVideoUrl,
        pendingVideoUrl,
        clearPendingVideoUrl,
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
