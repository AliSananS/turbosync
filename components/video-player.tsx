"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface VideoPlayerProps {
  src: string;
  subTitlesFile?: string;
  subtitlesLang?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  showControls?: boolean;
}

interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export const VideoPlayer = React.forwardRef<
  VideoPlayerHandle,
  VideoPlayerProps
>(
  (
    {
      src,
      subTitlesFile,
      subtitlesLang = "en",
      autoPlay = false,
      loop = false,
      muted = false,
      showControls = true,
    },
    ref,
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(muted);
    const [volume, setVolume] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showControlsUI, setShowControlsUI] = useState(true);
    const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Expose methods via ref
    useEffect(() => {
      if (!ref) return;

      const handle: VideoPlayerHandle = {
        play: () => {
          videoRef.current?.play().catch(() => {});
        },
        pause: () => {
          videoRef.current?.pause();
        },
        seek: (time) => {
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(
              0,
              Math.min(time, videoRef.current.duration),
            );
          }
        },
        getCurrentTime: () => videoRef.current?.currentTime ?? 0,
        getDuration: () => videoRef.current?.duration ?? 0,
      };

      if (typeof ref === "function") {
        ref(handle);
      } else {
        ref.current = handle;
      }
    }, [ref]);

    // Handle play/pause state
    const handlePlayPause = useCallback(() => {
      if (videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    }, []);

    // Handle seeking
    const handleSeek = useCallback((time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(
          0,
          Math.min(time, videoRef.current.duration || 0),
        );
      }
    }, []);

    // Handle volume
    const handleVolumeChange = useCallback((newVolume: number) => {
      if (videoRef.current) {
        const vol = Math.max(0, Math.min(1, newVolume));
        videoRef.current.volume = vol;
        setVolume(vol);
      }
    }, []);

    // Handle mute/unmute
    const handleMuteToggle = useCallback(() => {
      if (videoRef.current) {
        videoRef.current.muted = !videoRef.current.muted;
        setIsMuted(!videoRef.current.muted);
      }
    }, []);

    // Handle fullscreen
    const handleFullscreen = useCallback(() => {
      if (!containerRef.current) return;

      if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen().catch(() => {});
        } else if (
          (containerRef.current as unknown as Record<string, unknown>)
            .webkitRequestFullscreen
        ) {
          const webkit = containerRef.current as unknown as Record<
            string,
            () => void
          >;
          webkit.webkitRequestFullscreen?.();
        }
        setIsFullscreen(true);
      } else {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else if (
          (document as unknown as Record<string, unknown>)
            .webkitFullscreenElement
        ) {
          (
            document as unknown as Record<string, () => void>
          ).webkitExitFullscreen?.();
        }
        setIsFullscreen(false);
      }
    }, [isFullscreen]);

    // Auto-hide controls on mouse move
    const handleMouseMove = useCallback(() => {
      setShowControlsUI(true);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
      if (isPlaying && showControls) {
        hideControlsTimeoutRef.current = setTimeout(() => {
          setShowControlsUI(false);
        }, 3000);
      }
    }, [isPlaying, showControls]);

    // Clean up timeout on unmount
    useEffect(() => {
      return () => {
        if (hideControlsTimeoutRef.current) {
          clearTimeout(hideControlsTimeoutRef.current);
        }
      };
    }, []);

    // Format time helper
    const formatTime = (seconds: number): string => {
      if (!Number.isFinite(seconds)) return "0:00";
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          backgroundColor: "#000",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <video
          ref={videoRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
          }}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          onTimeUpdate={() =>
            setCurrentTime(videoRef.current?.currentTime ?? 0)
          }
          onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          <source src={src} type="video/mp4" />
          <track
            kind="captions"
            srcLang={subtitlesLang}
            src={subTitlesFile}
            default
          />
          Your browser does not support the video tag.
        </video>

        {showControls && (
          <section
            aria-label="Video player controls overlay"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              top: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              background: showControlsUI
                ? "linear-gradient(transparent, rgba(0, 0, 0, 0.7))"
                : "transparent",
              transition: "background 0.3s ease",
              cursor: isPlaying && !showControlsUI ? "none" : "default",
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              if (hideControlsTimeoutRef.current) {
                clearTimeout(hideControlsTimeoutRef.current);
              }
            }}
          >
            {/* Progress bar */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Video progress"
              aria-valuemin={0}
              aria-valuemax={Math.ceil(duration)}
              aria-valuenow={Math.ceil(currentTime)}
              style={{
                width: "100%",
                height: "5px",
                backgroundColor: "rgba(255, 255, 255, 0.3)",
                cursor: "pointer",
                position: "relative",
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const newTime =
                  ((e.clientX - rect.left) / rect.width) * duration;
                handleSeek(newTime);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  handleSeek(Math.max(0, currentTime - 5));
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  handleSeek(Math.min(duration, currentTime + 5));
                }
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                (e.currentTarget as HTMLElement).style.setProperty(
                  "--progress",
                  `${percent}%`,
                );
              }}
            >
              <div
                style={{
                  height: "100%",
                  backgroundColor: "#ef4444",
                  width: `${(currentTime / duration) * 100}%`,
                  transition: isPlaying ? "none" : "width 0.1s",
                }}
              />
            </div>

            {/* Controls */}
            {showControlsUI && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  gap: "12px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  {/* Play/Pause Button */}
                  <button
                    type="button"
                    onClick={handlePlayPause}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "20px",
                      padding: "4px 8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? "⏸" : "▶"}
                  </button>

                  {/* Mute Button */}
                  <button
                    type="button"
                    onClick={handleMuteToggle}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "18px",
                      padding: "4px 8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? "🔇" : "🔊"}
                  </button>

                  {/* Volume Slider */}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume * 100}
                    onChange={(e) =>
                      handleVolumeChange(parseInt(e.target.value) / 100)
                    }
                    style={{
                      width: "80px",
                      cursor: "pointer",
                    }}
                    title="Volume"
                  />

                  {/* Time Display */}
                  <div
                    style={{
                      color: "#fff",
                      fontSize: "14px",
                      whiteSpace: "nowrap",
                      fontFamily: "monospace",
                    }}
                  >
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>

                {/* Fullscreen Button */}
                <button
                  type="button"
                  onClick={handleFullscreen}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "18px",
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label={
                    isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                  }
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? "⛶" : "⛶"}
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    );
  },
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
