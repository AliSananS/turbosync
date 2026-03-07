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
  const [roomName, setRoomName] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [joinRoomName, setJoinRoomName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinDisplayName, setJoinDisplayName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const slug = (name: string) =>
    name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  const stashJoin = (payload: { displayName: string; password?: string; isHost: boolean }) => {
    sessionStorage.setItem("turbosync-join", JSON.stringify(payload));
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !createDisplayName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName.trim(), password: password.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed to create room");
      const data = (await res.json()) as { slug: string };
      stashJoin({ displayName: createDisplayName.trim(), password: password.trim() || undefined, isHost: true });
      router.push(`/room/${data.slug}`);
    } catch {
      alert("Error creating room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    if (!joinRoomName.trim() || !joinDisplayName.trim()) return;
    const roomSlug = slug(joinRoomName);
    const res = await fetch(`/api/room/${roomSlug}/exists`);
    const data = (await res.json()) as { exists: boolean };
    if (!data.exists) {
      setJoinError("Room not found");
      return;
    }
    stashJoin({ displayName: joinDisplayName.trim(), password: joinPassword.trim() || undefined, isHost: false });
    router.push(`/room/${roomSlug}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-[#050505] p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#0A0A0A] rounded-2xl shadow-xl border border-[#EAEAEA] dark:border-[#1F1F23] overflow-hidden">
        <div className="flex flex-col items-center pt-8 pb-4 px-8">
          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-3"><Video size={28} /></div>
          <h1 className="text-2xl font-bold text-[#111111] dark:text-[#EDEDED]">TurboSync</h1>
        </div>

        <div className="flex mx-8 mt-2 mb-6 rounded-lg bg-gray-100 dark:bg-[#111111] p-1 border border-[#EAEAEA] dark:border-[#1F1F23]">
          <button onClick={() => setTab("create")} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md ${tab === "create" ? "bg-white dark:bg-[#0A0A0A]" : "text-[#888]"}`}><Plus size={16} /> Create Room</button>
          <button onClick={() => setTab("join")} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md ${tab === "join" ? "bg-white dark:bg-[#0A0A0A]" : "text-[#888]"}`}><LogIn size={16} /> Join Room</button>
        </div>

        {tab === "create" && (
          <form onSubmit={handleCreateRoom} className="px-8 pb-8 space-y-4">
            <Field id="createDisplayName" label="Display Name" placeholder="What should we call you?" value={createDisplayName} onChange={setCreateDisplayName} helper="This is how other viewers will see you" required />
            <Field id="roomName" label="Room Name" placeholder="e.g. friday-movie-night" value={roomName} onChange={setRoomName} helper="This becomes the URL slug for your room" required />
            <Field id="password" label="Password" placeholder="Optional — leave blank for public room" value={password} onChange={setPassword} helper="Only share this with people you want in the room" type="password" />
            <Button type="submit" className="w-full h-11 mt-2 bg-[#111111] hover:bg-black dark:bg-white dark:text-black" disabled={!roomName.trim() || !createDisplayName.trim() || loading}>{loading ? "Creating..." : "Create & Enter Room"}</Button>
          </form>
        )}

        {tab === "join" && (
          <form onSubmit={handleJoinRoom} className="px-8 pb-8 space-y-4">
            <Field id="joinDisplayName" label="Display Name" placeholder="What should we call you?" value={joinDisplayName} onChange={setJoinDisplayName} helper="This is how other viewers will see you" required />
            <Field id="joinRoom" label="Room Name" placeholder="e.g. friday-movie-night" value={joinRoomName} onChange={setJoinRoomName} helper="This becomes the URL slug for your room" required />
            <Field id="joinPassword" label="Password" placeholder="Optional — leave blank for public room" value={joinPassword} onChange={setJoinPassword} helper="Only share this with people you want in the room" type="password" />
            {joinError ? <p className="text-xs text-red-500">{joinError}</p> : null}
            <Button type="submit" className="w-full h-11 mt-2 bg-[#111111] hover:bg-black dark:bg-white dark:text-black" disabled={!joinRoomName.trim() || !joinDisplayName.trim()}>Join Room</Button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ id, label, placeholder, value, onChange, helper, type = "text", required = false }: { id: string; label: string; placeholder: string; value: string; onChange: (v: string) => void; helper: string; type?: string; required?: boolean; }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} placeholder={placeholder} type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="bg-gray-50 dark:bg-[#111111] border-[#EAEAEA] dark:border-[#1F1F23]" />
      <p className="text-[11px] text-[#999] dark:text-[#555]">{helper}</p>
    </div>
  );
}
