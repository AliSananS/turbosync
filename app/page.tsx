"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Plus, LogIn } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [selectedAvatar, setSelectedAvatar] = useState("bg-blue-500");

  // Create room state
  const [roomName, setRoomName] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Join room state
  const [joinRoomName, setJoinRoomName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinDisplayName, setJoinDisplayName] = useState("");

  const slug = (name: string) =>
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !createDisplayName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName.trim(),
          password: password.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to create room");

      const data = (await res.json()) as { slug: string };

      // Redirect with credentials so the owner auto-joins as host
      const params = new URLSearchParams();
      params.set("displayName", createDisplayName.trim());
      params.set("avatar", selectedAvatar);
      params.set("host", "1");
      if (password.trim()) params.set("password", password.trim());

      router.push(`/room/${data.slug}?${params.toString()}`);
    } catch (err) {
      console.error(err);
      alert("Error creating room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomName.trim() || !joinDisplayName.trim()) return;
    const roomSlug = slug(joinRoomName);
    const params = new URLSearchParams();
    params.set("displayName", joinDisplayName.trim());
    params.set("avatar", selectedAvatar);
    if (joinPassword.trim()) params.set("password", joinPassword.trim());
    router.push(`/room/${roomSlug}?${params.toString()}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-[#050505] p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#0A0A0A] rounded-2xl shadow-xl border border-[#EAEAEA] dark:border-[#1F1F23] overflow-hidden">
        {/* Header */}
        <div className="flex flex-col items-center pt-8 pb-4 px-8">
          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-3">
            <Video size={28} />
          </div>
          <h1 className="text-2xl font-bold text-[#111111] dark:text-[#EDEDED]">
            TurboSync
          </h1>
          <p className="text-sm text-[#666666] dark:text-[#A1A1AA] mt-1 text-center">
            Synchronized video playback rooms
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex mx-8 mt-2 mb-6 rounded-lg bg-gray-100 dark:bg-[#111111] p-1 border border-[#EAEAEA] dark:border-[#1F1F23]">
          <button
            onClick={() => setTab("create")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-all ${tab === "create" ? "bg-white dark:bg-[#0A0A0A] text-[#111111] dark:text-white shadow-sm" : "text-[#888] dark:text-[#666] hover:text-[#555] dark:hover:text-[#999]"}`}
          >
            <Plus size={16} /> Create Room
          </button>
          <button
            onClick={() => setTab("join")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-all ${tab === "join" ? "bg-white dark:bg-[#0A0A0A] text-[#111111] dark:text-white shadow-sm" : "text-[#888] dark:text-[#666] hover:text-[#555] dark:hover:text-[#999]"}`}
          >
            <LogIn size={16} /> Join Room
          </button>
        </div>

        {/* Create Room Form */}
        {tab === "create" && (
          <form onSubmit={handleCreateRoom} className="px-8 pb-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="createDisplayName">Your Display Name</Label>
              <Input
                id="createDisplayName"
                placeholder="e.g. Ali"
                value={createDisplayName}
                onChange={(e) => setCreateDisplayName(e.target.value)}
                required
                className="bg-gray-50 dark:bg-[#111111] border-[#EAEAEA] dark:border-[#1F1F23]"
              />
            </div>
            <div className="space-y-2">
              <Label>Choose Avatar</Label>
              <div className="flex gap-2 py-1">
                {[
                  "bg-blue-500",
                  "bg-red-500",
                  "bg-green-500",
                  "bg-purple-500",
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedAvatar(color)}
                    className={`w-8 h-8 rounded-full ${color} border-2 ${selectedAvatar === color ? "border-black dark:border-white scale-110" : "border-transparent opacity-70 hover:opacity-100"} transition-all`}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roomName">Room Name</Label>
              <Input
                id="roomName"
                placeholder="e.g. mr-robot-ali"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
                className="bg-gray-50 dark:bg-[#111111] border-[#EAEAEA] dark:border-[#1F1F23]"
              />
              <p className="text-[11px] text-[#999] dark:text-[#555]">
                URL: /room/{slug(roomName) || "..."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (optional)</Label>
              <Input
                id="password"
                type="password"
                placeholder="Leave blank for public room"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-50 dark:bg-[#111111] border-[#EAEAEA] dark:border-[#1F1F23]"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 mt-2 bg-[#111111] hover:bg-black dark:bg-white dark:text-black dark:hover:bg-gray-200"
              disabled={
                !roomName.trim() || !createDisplayName.trim() || loading
              }
            >
              {loading ? "Creating..." : "Create & Enter Room"}
            </Button>
          </form>
        )}

        {/* Join Room Form */}
        {tab === "join" && (
          <form onSubmit={handleJoinRoom} className="px-8 pb-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="joinRoom">Room Name</Label>
              <Input
                id="joinRoom"
                placeholder="e.g. mr-robot-ali"
                value={joinRoomName}
                onChange={(e) => setJoinRoomName(e.target.value)}
                required
                className="bg-gray-50 dark:bg-[#111111] border-[#EAEAEA] dark:border-[#1F1F23]"
              />
            </div>
            <div className="space-y-2">
              <Label>Choose Avatar</Label>
              <div className="flex gap-2 py-1">
                {[
                  "bg-blue-500",
                  "bg-red-500",
                  "bg-green-500",
                  "bg-purple-500",
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedAvatar(color)}
                    className={`w-8 h-8 rounded-full ${color} border-2 ${selectedAvatar === color ? "border-black dark:border-white scale-110" : "border-transparent opacity-70 hover:opacity-100"} transition-all`}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="joinDisplayName">Display Name</Label>
              <Input
                id="joinDisplayName"
                placeholder="Your name"
                value={joinDisplayName}
                onChange={(e) => setJoinDisplayName(e.target.value)}
                required
                className="bg-gray-50 dark:bg-[#111111] border-[#EAEAEA] dark:border-[#1F1F23]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joinPassword">Room Password (if required)</Label>
              <Input
                id="joinPassword"
                type="password"
                placeholder="Leave blank if public"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                className="bg-gray-50 dark:bg-[#111111] border-[#EAEAEA] dark:border-[#1F1F23]"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 mt-2 bg-[#111111] hover:bg-black dark:bg-white dark:text-black dark:hover:bg-gray-200"
              disabled={!joinRoomName.trim() || !joinDisplayName.trim()}
            >
              Join Room
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
