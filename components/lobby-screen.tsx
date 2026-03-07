"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Play } from "lucide-react";

interface LobbyScreenProps {
  onJoin: (displayName: string, password?: string) => void;
  roomName: string;
}

export function LobbyScreen({ onJoin, roomName }: LobbyScreenProps) {
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    onJoin(displayName.trim(), password.trim() || undefined);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAFAFA] dark:bg-[#050505]">
      <div className="w-full max-w-[420px] bg-white dark:bg-[#0A0A0A] rounded-2xl shadow border border-[#EAEAEA] dark:border-[#1F1F23] overflow-hidden">
        <div className="relative w-full aspect-video bg-black">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
              <Play className="text-white fill-current w-6 h-6 ml-1" />
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold">{roomName || "Sync Room"}</h2>
            <p className="text-sm text-[#666666] dark:text-[#A1A1AA]">Join the session</p>
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" placeholder="What should we call you?" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="space-y-2 mb-4">
              <Label htmlFor="password">Room Password</Label>
              <Input id="password" type="password" placeholder="Room password (if required)" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <Button type="submit" className="w-full h-10 bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black" disabled={!displayName.trim()}>
              Enter Room
            </Button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-[#888888] dark:text-[#6B7280]">
            <Lock size={14} />
            <span>Secure connection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
