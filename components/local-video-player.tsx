"use client";

import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import VideoPlayer, { type VideoPlayerHandle } from "@/components/video-player";
import { Upload, FileVideo, Captions } from "lucide-react";

export interface LocalVideoPlayerHandle {
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  toggleMute: () => void;
  toggleFullscreen: () => Promise<void>;
  getVideoWidth: () => number;
  getVideoHeight: () => number;
  isPaused: () => boolean;
  isMuted: () => boolean;
}

interface LocalVideoPlayerProps {
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onLoadedMetadata?: () => void;
}

export const LocalVideoPlayer = forwardRef<
  LocalVideoPlayerHandle,
  LocalVideoPlayerProps
>(({ onPlay, onPause, onSeek, onTimeUpdate, onLoadedMetadata }, ref) => {
  const playerRef = useRef<VideoPlayerHandle>(null);
  const [localVideoSrc, setLocalVideoSrc] = useState<string | null>(null);
  const [localSubtitleSrc, setLocalSubtitleSrc] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resolution, setResolution] = useState<{ w: number; h: number } | null>(null);

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    const videoFile = list.find((f) => f.type.startsWith("video/"));
    const subtitleFile = list.find((f) => f.name.toLowerCase().endsWith(".vtt"));
    if (videoFile) setLocalVideoSrc(URL.createObjectURL(videoFile));
    if (subtitleFile) setLocalSubtitleSrc(URL.createObjectURL(subtitleFile));
  };

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.play() ?? Promise.resolve(),
    pause: () => playerRef.current?.pause(),
    seek: (time: number) => playerRef.current?.seek(time),
    getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
    getDuration: () => playerRef.current?.getDuration() ?? 0,
    toggleMute: () => playerRef.current?.toggleMute(),
    toggleFullscreen: () => playerRef.current?.toggleFullscreen() ?? Promise.resolve(),
    getVideoWidth: () => playerRef.current?.getVideoWidth() ?? 0,
    getVideoHeight: () => playerRef.current?.getVideoHeight() ?? 0,
    isPaused: () => playerRef.current?.isPaused() ?? true,
    isMuted: () => playerRef.current?.isMuted() ?? false,
  }));

  return (
    <div className="w-screen max-w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`relative bg-black rounded-xl overflow-hidden shadow-2xl border transition-all duration-300 ${dragging ? "border-blue-400 shadow-blue-500/20 scale-[1.002]" : "border-[#1F1F23]"} aspect-video max-h-[70vh]`}
      >
        {!localVideoSrc && (
          <div className={`absolute inset-4 z-30 flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-300 ${dragging ? "border-blue-400 bg-blue-500/10" : "border-[#333] bg-black/70"}`}>
            <FileVideo className="text-white/80 mb-3" size={44} />
            <p className="text-white font-semibold">Drop .mp4 or .vtt files here</p>
            <p className="text-xs text-white/60 mt-1 mb-4">Or pick files manually</p>
            <div className="flex gap-2">
              <label className="px-3 py-2 text-xs rounded bg-white text-black cursor-pointer flex items-center gap-1.5">
                <Upload size={14} /> Video
                <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
              </label>
              <label className="px-3 py-2 text-xs rounded border border-white/30 text-white cursor-pointer flex items-center gap-1.5">
                <Captions size={14} /> Subtitles
                <input type="file" accept=".vtt" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
              </label>
            </div>
          </div>
        )}

        {resolution && (
          <span className="absolute top-4 left-4 z-20 bg-black/60 text-white text-[11px] px-3 py-1 rounded-full border border-white/10">
            {resolution.w}x{resolution.h}
          </span>
        )}

        {localVideoSrc && (
          <VideoPlayer
            ref={playerRef}
            src={localVideoSrc}
            showControls={isFullscreen}
            accentColor={isFullscreen ? "#ffffff" : "#000000"}
            size="lg"
            onPlay={onPlay}
            onPause={onPause}
            onSeek={onSeek}
            onTimeUpdate={onTimeUpdate}
            onFullscreenChange={setIsFullscreen}
            onLoadedMetadata={() => {
              const w = playerRef.current?.getVideoWidth() ?? 0;
              const h = playerRef.current?.getVideoHeight() ?? 0;
              setResolution(w && h ? { w, h } : null);
              onLoadedMetadata?.();
            }}
          >
            {localSubtitleSrc ? (
              <track kind="captions" src={localSubtitleSrc} default />
            ) : null}
          </VideoPlayer>
        )}
      </div>
    </div>
  );
});

LocalVideoPlayer.displayName = "LocalVideoPlayer";
