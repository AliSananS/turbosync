"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Play } from "lucide-react";

interface LobbyScreenProps {
  onJoin: (displayName: string, avatar: string, password?: string) => void;
  roomName: string;
}

const AVATAR_OPTIONS = [
  {
    id: "JD",
    label: "James Doe",
    bg: "bg-gradient-to-br from-indigo-400 to-purple-500",
  },
  {
    id: "AK",
    label: "Alice Kim",
    bg: "bg-gradient-to-br from-orange-400 to-pink-500",
  },
  {
    id: "MR",
    label: "Marcus Reed",
    bg: "bg-gradient-to-br from-emerald-400 to-teal-500",
  },
  {
    id: "SJ",
    label: "Sarah Jones",
    bg: "bg-gradient-to-br from-blue-400 to-cyan-500",
  },
];

export function LobbyScreen({ onJoin, roomName }: LobbyScreenProps) {
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    onJoin(displayName, selectedAvatar.label, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAFAFA] dark:bg-[#050505]">
      <div className="w-full max-w-[420px] bg-white dark:bg-[#0A0A0A] rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02)] border border-[#EAEAEA] dark:border-[#1F1F23] overflow-hidden">
        {/* Header / Media Area */}
        <div className="relative w-full aspect-video bg-black group cursor-default">
          <img
            alt="Scenic mountain landscape video placeholder"
            className="absolute inset-0 w-full h-full object-cover opacity-80"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCjbUlHr1gb1p1uIIEI8xz6xF-JecB-KjV0ZXVWqXfPN7193DVBgzdBVpyDsqtkijAmVCwNZZw5nn31pdRhAmJXy1RhnmBY0HLJouMx_1LIe8kZiTPM9Jn81Lya3Iq5SEU_gLJjw2OTOdiiVv7nYWGxCAmhoQOW-QfQzQXOHKegJp_Djtq7lCPyAjqMe1xQN8w3rnMpLvVqY2M62nqorBGL2qmQ0CrsFMaq4vquBkqoDzI8b7VkgGcg-rLdL0K9CA4cOw8uD6BXKuE"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Play className="text-white fill-current w-6 h-6 ml-1" />
            </div>
          </div>

          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-white uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              Live
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold tracking-tight text-[#111111] dark:text-[#EDEDED] mb-1">
              {roomName || "Sync Room"}
            </h2>
            <p className="text-sm text-[#666666] dark:text-[#A1A1AA] font-medium">
              Join the session
            </p>
          </div>

          <div className="mb-6 flex justify-center gap-3">
            {AVATAR_OPTIONS.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                onClick={() => setSelectedAvatar(avatar)}
                className={`w-10 h-10 rounded-full ${avatar.bg} flex items-center justify-center text-white text-xs font-bold shadow-sm transition-transform ${selectedAvatar.id === avatar.id ? "ring-2 ring-offset-2 ring-black dark:ring-white scale-110" : "hover:scale-105 opacity-80"}`}
                title={avatar.label}
              >
                {avatar.id}
              </button>
            ))}
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="bg-white dark:bg-[#111111] border-[#EAEAEA] dark:border-[#1F1F23]"
              />
            </div>
            <div className="space-y-2 mb-4">
              <Label htmlFor="password">Room Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Password (if required)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white dark:bg-[#111111] border-[#EAEAEA] dark:border-[#1F1F23]"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.05)] mt-4"
              disabled={!displayName.trim()}
            >
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
