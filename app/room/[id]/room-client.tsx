"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { RoomProvider, useRoom } from "@/lib/room-context";
import { LobbyScreen } from "@/components/lobby-screen";
import { PlayerDashboard } from "@/components/player-dashboard";
import { AlertCircle } from "lucide-react";

export function RoomClient({ roomId }: { roomId: string }) {
  return (
    <RoomProvider>
      <RoomController roomId={roomId} />
    </RoomProvider>
  );
}

function RoomController({ roomId }: { roomId: string }) {
  const { isConnected, connect, roomState, error } = useRoom();
  const [hasJoined, setHasJoined] = useState(false);
  const searchParams = useSearchParams();

  // Auto-join if query params are present (coming from Create or Join tab)
  useEffect(() => {
    const displayName = searchParams.get("displayName");
    const avatar = searchParams.get("avatar") || undefined;
    if (displayName && !hasJoined) {
      const password = searchParams.get("password") || undefined;
      const isHost = searchParams.get("host") === "1";
      connect(roomId, { displayName, avatar, isHost }, password);
      setHasJoined(true);
    }
  }, [searchParams, roomId, connect, hasJoined]);

  // If error (e.g. wrong password), let user retry
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#050505] p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#0A0A0A] rounded-2xl border border-red-200 dark:border-red-900/50 p-8 text-center shadow-lg">
          <AlertCircle size={40} className="mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-bold text-[#111] dark:text-[#EDEDED] mb-2">
            Connection Failed
          </h2>
          <p className="text-sm text-[#666] dark:text-[#A1A1AA] mb-6">
            {error}
          </p>
          <button
            onClick={() => {
              setHasJoined(false);
            }}
            className="px-6 py-2.5 bg-[#111] dark:bg-white text-white dark:text-black text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // If we haven't initiated a join yet, show the Lobby
  if (!hasJoined) {
    return (
      <LobbyScreen
        roomName={roomId.replace(/-/g, " ").toUpperCase()}
        onJoin={(displayName, avatar, password) => {
          connect(roomId, { displayName, avatar, isHost: false }, password);
          setHasJoined(true);
        }}
      />
    );
  }

  // Connecting state
  if (!isConnected && !roomState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#050505]">
        <div className="w-12 h-12 border-4 border-[#111111] dark:border-white border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-[#666666] dark:text-[#A1A1AA] font-medium tracking-wide">
          Connecting to room...
        </p>
        <button
          onClick={() => setHasJoined(false)}
          className="mt-6 text-xs text-blue-500 hover:text-blue-600 underline"
        >
          Cancel and Return
        </button>
      </div>
    );
  }

  return <PlayerDashboard />;
}
