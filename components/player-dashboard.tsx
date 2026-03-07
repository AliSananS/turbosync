"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRoom } from "@/lib/room-context";
import { PeerPermissionsDialog } from "@/components/peer-permissions-dialog";
import { RoomSettingsDialog } from "@/components/room-settings-dialog";
import {
  LocalVideoPlayer,
  type LocalVideoPlayerHandle,
} from "@/components/local-video-player";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, Play, Pause, Volume2, Settings, Maximize, Filter } from "lucide-react";
import { type User } from "@/types";

const formatClock = (seconds = 0) => new Date(seconds * 1000).toISOString().substring(11, 19);

export function ActiveMembersTable({ activeUsers, currentUser, latency }: { activeUsers: User[]; currentUser: User | null; latency: number; }) {
  return (
    <div className="lg:col-span-12 bg-[#FFFFFF] dark:bg-[#0A0A0A] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-xl shadow-sm overflow-hidden flex flex-col h-70 relative">
      <div className="px-5 py-4 border-b border-[#E5E7EB] dark:border-[#1F1F23] flex flex-wrap items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-bold text-[#111827] dark:text-[#EDEDED] uppercase tracking-wider">Active Members</h3>
          <span className="bg-gray-100 dark:bg-[#111111] text-[#6B7280] dark:text-[#A1A1AA] px-2 py-0.5 rounded text-[10px] font-bold border border-[#E5E7EB] dark:border-[#1F1F23]">{activeUsers.length} Online</span>
        </div>
        <PeerPermissionsDialog>
          <button className="px-3 py-1.5 bg-white dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#1F1F23] rounded text-[10px] font-bold text-[#6B7280] dark:text-[#A1A1AA] hover:border-gray-300 dark:hover:border-gray-600 transition-colors flex items-center gap-1.5 uppercase tracking-wide">
            <Filter size={14} /> Manage
          </button>
        </PeerPermissionsDialog>
      </div>

      <div className="overflow-y-auto scrollbar-hide flex-1">
        <table className="w-full text-left text-xs whitespace-nowrap min-w-[760px]">
          <thead className="bg-gray-50/50 dark:bg-[#111111]/50 text-[10px] uppercase text-[#6B7280] dark:text-[#A1A1AA] font-bold tracking-widest border-b border-[#E5E7EB] dark:border-[#1F1F23] sticky top-0 z-10">
            <tr>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Connection Status</th>
              <th className="px-5 py-3">Video Timestamp</th>
              <th className="px-5 py-3 text-right">Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#1F1F23]">
            {activeUsers.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-[#6B7280] dark:text-[#A1A1AA]">Waiting for peers to join...</td></tr>
            ) : (
              activeUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-bold text-[#111827] dark:text-[#EDEDED] flex items-center gap-2">{user.displayName}{user.id === currentUser?.id && <Badge variant="outline" className="text-[8px] h-4 px-1 py-0 border-blue-500/30 text-blue-500">YOU</Badge>}</div>
                  </td>
                  <td className="px-5 py-3 text-[#6B7280] dark:text-[#A1A1AA]">{user.isHost ? "Host" : "Viewer"}</td>
                  <td className="px-5 py-3"><span className={`inline-flex items-center gap-2 text-[#6B7280] dark:text-[#A1A1AA]`}><span className={`w-2 h-2 rounded-full ${user.connectionStatus === "idle" ? "bg-yellow-500" : "bg-green-500"}`}></span>{user.connectionStatus ?? "online"}</span></td>
                  <td className="px-5 py-3 font-mono text-[#6B7280] dark:text-[#A1A1AA]">{formatClock(user.videoTimestamp ?? 0)}</td>
                  <td className="px-5 py-3 text-right font-mono text-[#111827] dark:text-[#EDEDED]">{user.id === currentUser?.id ? `${latency}ms` : user.latency ? `${user.latency}ms` : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardHeader({ roomName, isDark, toggleDark }: { roomName: string; isDark: boolean; toggleDark: () => void; }) {
  return (
    <header className="w-full h-14 flex items-center justify-between px-4 md:px-6 border-b border-[#E5E7EB] dark:border-[#1F1F23] bg-[#FFFFFF] dark:bg-[#0A0A0A] sticky top-0 z-50">
      <h1 className="text-xs md:text-sm font-bold uppercase truncate">{roomName || "Sync Room"}</h1>
      <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#1C1C1C]" onClick={toggleDark}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
    </header>
  );
}

export function PlayerDashboard() {
  const { roomState, currentUser, latency, play, pause, seek, setLocalPlaybackTime } = useRoom();
  const [isDark, setIsDark] = useState(true);
  const playerRef = useRef<LocalVideoPlayerHandle>(null);
  const [localProgress, setLocalProgress] = useState({ current: 0, duration: 0, percent: 0 });
  const syncingRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    if (!roomState || !playerRef.current) return;
    syncingRef.current = true;
    const localPaused = playerRef.current.isPaused();
    if (roomState.paused && !localPaused) playerRef.current.pause();
    else if (!roomState.paused && localPaused) playerRef.current.play();
    const drift = Math.abs(playerRef.current.getCurrentTime() - roomState.currentTime);
    if (drift > 0.5) playerRef.current.seek(roomState.currentTime);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, [roomState?.currentTime, roomState?.paused]);

  const onVideoPlay = useCallback(() => {
    if (syncingRef.current) return;
    play(playerRef.current?.getCurrentTime() ?? 0);
  }, [play]);
  const onVideoPause = useCallback(() => {
    if (syncingRef.current) return;
    pause(playerRef.current?.getCurrentTime() ?? 0);
  }, [pause]);
  const onVideoSeek = useCallback((time: number) => {
    if (syncingRef.current) return;
    seek(time);
  }, [seek]);

  const activeUsers = roomState?.users || [];

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F4F6] dark:bg-[#050505]">
      <DashboardHeader roomName={roomState?.name || "Sync Room"} isDark={isDark} toggleDark={() => setIsDark((v) => !v)} />
      <main className="flex-1 w-full p-4 md:p-6 space-y-6">
        <section className="w-full">
          <LocalVideoPlayer
            ref={playerRef}
            onPlay={onVideoPlay}
            onPause={onVideoPause}
            onSeek={onVideoSeek}
            onTimeUpdate={(t, d) => {
              setLocalProgress({ current: t, duration: d, percent: d > 0 ? (t / d) * 100 : 0 });
              setLocalPlaybackTime(t);
            }}
          />

          <div className="mt-3 bg-white/95 dark:bg-[#0A0A0A]/95 border border-[#E5E7EB] dark:border-[#1F1F23] rounded-lg px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-4">
                <button onClick={() => roomState?.paused ? play(localProgress.current) : pause(localProgress.current)} className="text-[#111827] dark:text-[#EDEDED]" disabled={!roomState}>
                  {roomState?.paused ? <Play size={22} className="fill-current" /> : <Pause size={22} className="fill-current" />}
                </button>
                <span className="text-xs font-bold font-mono">{formatClock(localProgress.current)}</span>
              </div>
              <div className="flex items-center gap-5">
                <button onClick={() => playerRef.current?.toggleMute()}><Volume2 size={20} className="text-[#6B7280]" /></button>
                <RoomSettingsDialog><button><Settings size={20} className="text-[#6B7280]" /></button></RoomSettingsDialog>
                <button onClick={() => playerRef.current?.toggleFullscreen()}><Maximize size={20} className="text-[#6B7280]" /></button>
              </div>
            </div>
            <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#1F1F23] text-xs font-semibold">Avg Latency: {latency}ms</div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
          <ActiveMembersTable activeUsers={activeUsers} currentUser={currentUser} latency={latency} />
        </div>
      </main>
    </div>
  );
}
