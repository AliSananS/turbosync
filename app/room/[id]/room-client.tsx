"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const [roomExists, setRoomExists] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`/api/room/${roomId}/exists`);
      const data = (await res.json()) as { exists: boolean };
      setRoomExists(data.exists);
      if (!data.exists || hasJoined) return;
      const raw = sessionStorage.getItem("turbosync-join");
      if (!raw) return;
      try {
        const join = JSON.parse(raw) as { displayName: string; password?: string; isHost: boolean };
        connect(roomId, { displayName: join.displayName, isHost: join.isHost }, join.password);
        setHasJoined(true);
      } finally {
        sessionStorage.removeItem("turbosync-join");
      }
    };
    run();
  }, [roomId, connect, hasJoined]);

  if (roomExists === false) {
    return <Centered title="Room not found" message="This room does not exist or has been deleted." actionLabel="Return Home" action={() => router.push("/")} />;
  }

  if (error === "You have been removed from the room") {
    return <Centered title="Removed by host" message={error} actionLabel="Return Home" action={() => router.push("/")} />;
  }

  if (error) {
    return <Centered title="Connection Failed" message={error} actionLabel="Try Again" action={() => { setHasJoined(false); router.refresh(); }} />;
  }

  if (!hasJoined) {
    return (
      <LobbyScreen
        roomName={roomId.replace(/-/g, " ").toUpperCase()}
        onJoin={(displayName, password) => {
          connect(roomId, { displayName, isHost: false }, password);
          setHasJoined(true);
        }}
      />
    );
  }

  if (!isConnected && !roomState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#050505]">
        <div className="w-12 h-12 border-4 border-[#111111] dark:border-white border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-[#666666] dark:text-[#A1A1AA]">Connecting to room...</p>
      </div>
    );
  }

  return <PlayerDashboard />;
}

function Centered({ title, message, actionLabel, action }: { title: string; message: string; actionLabel: string; action: () => void; }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#050505] p-4">
      <div className="w-full max-w-sm bg-white dark:bg-[#0A0A0A] rounded-2xl border border-red-200 dark:border-red-900/50 p-8 text-center shadow-lg">
        <AlertCircle size={40} className="mx-auto mb-4 text-red-500" />
        <h2 className="text-lg font-bold mb-2">{title}</h2>
        <p className="text-sm text-[#666] dark:text-[#A1A1AA] mb-6">{message}</p>
        <button onClick={action} className="px-6 py-2.5 bg-[#111] dark:bg-white text-white dark:text-black text-sm font-semibold rounded-lg">{actionLabel}</button>
      </div>
    </div>
  );
}
