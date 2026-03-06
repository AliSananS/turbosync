"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRoom } from "@/lib/room-context";
import { LatencyChart } from "@/components/latency-chart";
import { PeerPermissionsDialog } from "@/components/peer-permissions-dialog";
import { RoomSettingsDialog } from "@/components/room-settings-dialog";
import VideoPlayer, { type VideoPlayerHandle } from "@/components/video-player";
import { Badge } from "@/components/ui/badge";
import {
  Sun,
  Moon,
  Play,
  Pause,
  Volume2,
  Settings,
  Maximize,
  Activity,
  Filter,
  Monitor,
  Video as VideoIcon,
} from "lucide-react";

import { type User } from "@/types";

export function ActiveMembersTable({
  activeUsers,
  currentUser,
  latency,
}: {
  activeUsers: User[];
  currentUser: User | null;
  latency: number;
}) {
  return (
    <div className="lg:col-span-8 bg-[#FFFFFF] dark:bg-[#0A0A0A] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-xl shadow-sm overflow-hidden flex flex-col h-70 relative">
      <div className="px-5 py-4 border-b border-[#E5E7EB] dark:border-[#1F1F23] flex flex-wrap items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-bold text-[#111827] dark:text-[#EDEDED] uppercase tracking-wider">
            Active Members
          </h3>
          <span className="bg-gray-100 dark:bg-[#111111] text-[#6B7280] dark:text-[#A1A1AA] px-2 py-0.5 rounded text-[10px] font-bold border border-[#E5E7EB] dark:border-[#1F1F23]">
            {activeUsers.length} Online
          </span>
        </div>

        <div className="flex gap-2">
          <PeerPermissionsDialog>
            <button className="px-3 py-1.5 bg-white dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#1F1F23] rounded text-[10px] font-bold text-[#6B7280] dark:text-[#A1A1AA] hover:border-gray-300 dark:hover:border-gray-600 transition-colors flex items-center gap-1.5 uppercase tracking-wide">
              <Filter size={14} />
              Manage
            </button>
          </PeerPermissionsDialog>
        </div>
      </div>

      <div className="overflow-y-auto scrollbar-hide flex-1">
        <table className="w-full text-left text-xs whitespace-nowrap min-w-[500px]">
          <thead className="bg-gray-50/50 dark:bg-[#111111]/50 text-[10px] uppercase text-[#6B7280] dark:text-[#A1A1AA] font-bold tracking-widest border-b border-[#E5E7EB] dark:border-[#1F1F23] sticky top-0 z-10">
            <tr>
              <th className="px-5 py-3" scope="col">
                User
              </th>
              <th className="px-5 py-3" scope="col">
                Status
              </th>
              <th className="px-5 py-3" scope="col">
                Device Info
              </th>
              <th className="px-5 py-3 text-right" scope="col">
                Latency
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#1F1F23]">
            {activeUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-[#6B7280] dark:text-[#A1A1AA]"
                >
                  Waiting for peers to join...
                </td>
              </tr>
            ) : (
              activeUsers.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full ${user.avatar || "bg-linear-to-br from-indigo-400 to-purple-500"} flex items-center justify-center text-white text-[10px] font-black border border-white/20`}
                      >
                        {user.displayName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-[#111827] dark:text-[#EDEDED] flex items-center gap-2">
                          {user.displayName}
                          {user.id === currentUser?.id && (
                            <Badge
                              variant="outline"
                              className="text-[8px] h-4 px-1 py-0 border-blue-500/30 text-blue-500"
                            >
                              YOU
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                          {user.isHost ? "Host / Primary" : "Viewer"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${user.isHost ? "bg-green-500" : "bg-blue-500"}`}
                      ></span>
                      <span className="text-[#6B7280] dark:text-[#A1A1AA] font-medium uppercase tracking-tight text-[10px]">
                        {user.isHost ? "Watching" : "Synced"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[#6B7280] dark:text-[#A1A1AA]">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase">
                      <Monitor size={14} /> Browser
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-[10px] font-bold font-mono text-[#111827] dark:text-[#EDEDED]">
                      {user.id === currentUser?.id ? `${latency}ms` : `< 50ms`}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardHeader({
  roomName,
  isDark,
  toggleDark,
}: {
  roomName: string;
  isDark: boolean;
  toggleDark: () => void;
}) {
  return (
    <header className="w-full h-14 flex items-center justify-between px-4 md:px-6 border-b border-[#E5E7EB] dark:border-[#1F1F23] bg-[#FFFFFF] dark:bg-[#0A0A0A] transition-colors duration-200 sticky top-0 z-50">
      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden sm:block w-4 h-4 bg-[#111111] dark:bg-white rounded-full"></div>
        <h1 className="text-xs md:text-sm font-bold tracking-tight uppercase truncate max-w-30 sm:max-w-50">
          {roomName || "Sync Room"}
        </h1>
        <span className="hidden sm:inline-flex bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest border border-green-200 dark:border-green-800">
          Direct Live
        </span>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-wider">
          <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="hidden sm:inline">Connection Stable</span>
          <span className="sm:hidden">Stable</span>
        </div>
        <div className="h-4 w-px bg-[#E5E7EB] dark:bg-[#1F1F23] mx-0.5 md:mx-1"></div>

        <button
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#1C1C1C] text-[#6B7280] dark:text-[#A1A1AA] transition-colors"
          onClick={toggleDark}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}

export function PlayerDashboard() {
  const { roomState, currentUser, latency, play, pause, seek } = useRoom();
  const [isDark, setIsDark] = useState(true);
  const playerRef = useRef<VideoPlayerHandle>(null);

  // Local media states
  const [localVideoSrc, setLocalVideoSrc] = useState<string | null>(null);
  const [localSubtitleSrc, setLocalSubtitleSrc] = useState<string | null>(null);
  const [resolution, setResolution] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [localProgress, setLocalProgress] = useState({
    current: 0,
    duration: 0,
    percent: 0,
  });

  // Toggle dark mode via the HTML class for Tailwind compatibility
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // Guard to prevent feedback loops when applying remote state
  const syncingRef = useRef(false);

  // Apply remote room state changes to local player
  useEffect(() => {
    if (!roomState || !playerRef.current) return;

    syncingRef.current = true;

    // Sync play/pause state
    const localPaused = playerRef.current.isPaused();
    if (roomState.paused && !localPaused) {
      playerRef.current.pause();
    } else if (!roomState.paused && localPaused) {
      playerRef.current.play();
    }

    // Sync time if drift > 0.5s
    const internalTime = playerRef.current.getCurrentTime();
    const drift = Math.abs(internalTime - roomState.currentTime);
    if (drift > 0.5) {
      playerRef.current.seek(roomState.currentTime);
    }

    // Release guard after a tick so the resulting video events are ignored
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, [roomState?.currentTime, roomState?.paused]);

  const activeUsers = roomState?.users || [];

  // Handlers that broadcast to the room (called from custom control bar)
  const handlePlay = (time: number) => {
    play(time);
    playerRef.current?.play();
  };
  const handlePause = (time: number) => {
    pause(time);
    playerRef.current?.pause();
  };

  // Callbacks from the VideoPlayer's built-in controls → broadcast to room
  const onVideoPlay = useCallback(() => {
    if (syncingRef.current) return;
    const t = playerRef.current?.getCurrentTime() || 0;
    play(t);
  }, [play]);

  const onVideoPause = useCallback(() => {
    if (syncingRef.current) return;
    const t = playerRef.current?.getCurrentTime() || 0;
    pause(t);
  }, [pause]);

  const onVideoSeek = useCallback(
    (time: number) => {
      if (syncingRef.current) return;
      seek(time);
    },
    [seek],
  );

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setLocalVideoSrc(URL.createObjectURL(file));
  };

  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setLocalSubtitleSrc(URL.createObjectURL(file));
  };

  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);

    // Automatically match files to inputs
    const videoFile = files.find((f) => f.type.startsWith("video/"));
    const subtitleFile = files.find((f) => f.name.endsWith(".vtt"));

    if (videoFile) setLocalVideoSrc(URL.createObjectURL(videoFile));
    if (subtitleFile) setLocalSubtitleSrc(URL.createObjectURL(subtitleFile));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F4F6] dark:bg-[#050505] text-[#111827] dark:text-[#EDEDED] antialiased transition-colors duration-200">
      <DashboardHeader
        roomName={roomState?.name || "Sync Room"}
        isDark={isDark}
        toggleDark={() => setIsDark(!isDark)}
      />

      {/* Main Content */}
      <main
        className="flex-1 w-full max-w-350 mx-auto p-4 md:p-6 space-y-6"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* Local Media Picker */}
        <section className="bg-white dark:bg-[#0A0A0A] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4 md:gap-6 transition-all">
          <div className="flex-1">
            <label className="block text-xs font-bold text-[#111827] dark:text-[#EDEDED] uppercase tracking-wider mb-2">
              Select Local Video File
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="block w-full text-sm text-[#6B7280] dark:text-[#A1A1AA] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#111111] file:text-white hover:file:bg-black dark:file:bg-white dark:file:text-black dark:hover:file:bg-gray-200 cursor-pointer"
            />
          </div>
          <div className="hidden md:block h-10 w-px bg-[#E5E7EB] dark:bg-[#1F1F23]"></div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-[#111827] dark:text-[#EDEDED] uppercase tracking-wider mb-2">
              Select Subtitles (.vtt)
            </label>
            <input
              type="file"
              accept=".vtt"
              onChange={handleSubtitleUpload}
              className="block w-full text-sm text-[#6B7280] dark:text-[#A1A1AA] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#111111] file:text-white hover:file:bg-black dark:file:bg-white dark:file:text-black dark:hover:file:bg-gray-200 cursor-pointer"
            />
          </div>
        </section>

        {/* Video Player Section */}
        <section className="w-full">
          <div className="bg-black rounded-xl overflow-hidden shadow-2xl relative border border-[#E5E7EB] dark:border-[#1F1F23] aspect-video max-h-[70vh] flex flex-col mx-auto cursor-default">
            {!localVideoSrc && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-center p-6 text-white font-medium border border-[#333] m-4 rounded-xl border-dashed">
                <VideoIcon size={48} className="mb-4 text-[#A1A1AA]" />
                <h3 className="text-xl font-bold mb-2">No Media Selected</h3>
                <p className="text-sm text-[#A1A1AA]">
                  Please select a local video file from the picker above to
                  begin playback.
                </p>
              </div>
            )}

            <div className="absolute top-4 left-4 md:top-6 md:left-6 flex flex-wrap gap-2 md:gap-3 z-20 pointer-events-none">
              <span className="bg-red-600 text-white text-[10px] md:text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg border border-red-500/50 hover:bg-red-700 transition">
                LIVE
              </span>
              {resolution && (
                <span className="bg-black/60 text-white text-[10px] md:text-[11px] font-medium px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                  {resolution.w}x{resolution.h}
                </span>
              )}
            </div>

            <div className="flex-1 relative bg-black flex items-center justify-center">
              {localVideoSrc && (
                <VideoPlayer
                  ref={playerRef}
                  src={localVideoSrc}
                  showControls={true}
                  size="lg"
                  onPlay={onVideoPlay}
                  onPause={onVideoPause}
                  onSeek={onVideoSeek}
                  onTimeUpdate={(t, d) =>
                    setLocalProgress({
                      current: t,
                      duration: d,
                      percent: d > 0 ? (t / d) * 100 : 0,
                    })
                  }
                  onLoadedMetadata={() => {
                    const w = playerRef.current?.getVideoWidth() || 0;
                    const h = playerRef.current?.getVideoHeight() || 0;
                    if (w > 0 && h > 0) setResolution({ w, h });

                    // Auto-sync with room state on load
                    if (roomState && playerRef.current) {
                      syncingRef.current = true;
                      playerRef.current.seek(roomState.currentTime);
                      if (!roomState.paused) {
                        playerRef.current.play();
                      } else {
                        playerRef.current.pause();
                      }
                      requestAnimationFrame(() => {
                        syncingRef.current = false;
                      });
                    }
                  }}
                >
                  {localSubtitleSrc && (
                    <track kind="captions" src={localSubtitleSrc} default />
                  )}
                </VideoPlayer>
              )}

              {localVideoSrc && roomState?.paused && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-black/40">
                  <button
                    onClick={() =>
                      handlePlay(playerRef.current?.getCurrentTime() || 0)
                    }
                    className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all transform hover:scale-105 pointer-events-auto"
                  >
                    <Play size={40} className="text-white fill-current ml-2" />
                  </button>
                </div>
              )}
            </div>

            {/* Custom Control Bar overlay matched to Screen 5 */}
            <div className="bg-[#FFFFFF] dark:bg-[#0A0A0A] border-t border-[#E5E7EB] dark:border-[#1F1F23] px-6 py-4 z-20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-6">
                  <button
                    onClick={() =>
                      roomState?.paused
                        ? handlePlay(roomState.currentTime)
                        : handlePause(roomState?.currentTime || 0)
                    }
                    className="text-[#111827] dark:text-[#EDEDED] hover:text-[#111111] dark:hover:text-white transition-colors"
                    disabled={!localVideoSrc}
                  >
                    {roomState?.paused ? (
                      <Play size={22} className="fill-current" />
                    ) : (
                      <Pause size={22} className="fill-current" />
                    )}
                  </button>

                  <div className="hidden sm:flex items-center gap-4">
                    <span className="text-xs font-bold font-mono text-[#111827] dark:text-[#EDEDED]">
                      {new Date((localProgress.current || 0) * 1000)
                        .toISOString()
                        .substr(11, 8)}
                    </span>
                    <div
                      className="w-48 lg:w-64 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden cursor-pointer"
                      onClick={(e) => {
                        if (!playerRef.current || !localProgress.duration)
                          return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = Math.max(
                          0,
                          Math.min(1, (e.clientX - rect.left) / rect.width),
                        );
                        handlePlay(pct * localProgress.duration);
                      }}
                    >
                      <div
                        className="h-full bg-[#111111] dark:bg-white transition-all duration-300"
                        style={{ width: `${localProgress.percent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <button onClick={() => playerRef.current?.toggleMute()}>
                    <Volume2
                      size={20}
                      className="text-[#6B7280] dark:text-[#A1A1AA] hover:text-white"
                    />
                  </button>

                  <RoomSettingsDialog>
                    <button className="flex items-center">
                      <Settings
                        size={20}
                        className="text-[#6B7280] dark:text-[#A1A1AA] hover:text-white"
                      />
                    </button>
                  </RoomSettingsDialog>

                  <button onClick={() => playerRef.current?.toggleFullscreen()}>
                    <Maximize
                      size={20}
                      className="text-[#6B7280] dark:text-[#A1A1AA] hover:text-white"
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB] dark:border-[#1F1F23]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest">
                      Avg Latency
                    </span>
                    <span className="text-xs font-bold text-[#111827] dark:text-[#EDEDED]">
                      {latency}ms
                    </span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${latency < 100 ? "bg-green-500" : "bg-yellow-500"}`}
                    ></span>
                  </div>
                  <div className="h-3 w-px bg-[#E5E7EB] dark:bg-[#1F1F23]"></div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest">
                      Network Score
                    </span>
                    <span className="text-xs font-bold text-[#111827] dark:text-[#EDEDED]">
                      {latency < 50 ? "98" : latency < 150 ? "75" : "40"}/100
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-medium italic">
                  Optimal streaming conditions detected.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
          {/* Latency History Panel */}
          <div className="lg:col-span-4 bg-[#FFFFFF] dark:bg-[#0A0A0A] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-xl p-5 shadow-sm flex flex-col h-70">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity
                  size={18}
                  className="text-[#6B7280] dark:text-[#A1A1AA]"
                />
                <h3 className="text-xs font-bold text-[#111827] dark:text-[#EDEDED] uppercase tracking-wider">
                  Sync Latency History
                </h3>
              </div>
              <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-mono">
                LIVE FEED
              </span>
            </div>

            <div className="relative flex-1 min-h-[140px] w-full mt-2">
              <LatencyChart />
            </div>

            <div className="mt-4 flex justify-between text-[9px] text-[#6B7280] dark:text-[#A1A1AA] font-bold uppercase tracking-widest">
              <span>60s ago</span>
              <span>30s ago</span>
              <span className="text-[#111111] dark:text-[#EDEDED]">Now</span>
            </div>
          </div>

          <ActiveMembersTable
            activeUsers={activeUsers}
            currentUser={currentUser}
            latency={latency}
          />
        </div>
      </main>
    </div>
  );
}
