"use client";

import React, {
  useCallback,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useEffect,
} from "react";
import { VideoPlayer, VideoPlayerHandle } from "@/components/video-player";
import { useRoom } from "@/lib/room-context";
import {
  Upload,
  Film,
  Subtitles,
  Link,
  HardDrive,
  Share2,
  Play,
  AlertCircle,
  CheckCircle2,
  X,
  Globe,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* IndexedDB Helpers */
/* ------------------------------------------------------------------ */

const DB_NAME = "turbosync_db";
const STORE_NAME = "files";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveFile(roomId: string, file: File): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(file, `video_${roomId}`);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to save to indexedDB", err);
  }
}

async function getFile(roomId: string): Promise<File | undefined> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(`video_${roomId}`);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to read from indexedDB", err);
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Public handle — same shape as VideoPlayerHandle */
/* ------------------------------------------------------------------ */

export type LocalVideoPlayerHandle = VideoPlayerHandle;

/* ------------------------------------------------------------------ */
/* Props */
/* ------------------------------------------------------------------ */

export interface LocalVideoPlayerProps {
  /** The id of the room, required for caching */
  roomId: string;
  /** Called when user plays the video locally */
  onPlay?: (currentTime: number) => void;
  /** Called when user pauses the video locally */
  onPause?: (currentTime: number) => void;
  /** Called when user seeks the video locally */
  onSeek?: (currentTime: number) => void;
  /** Called on every timeupdate */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Called when metadata loads (resolution available) */
  onLoadedMetadata?: () => void;
  /** Called when video src is set (for reporting loaded status) */
  onVideoSrcChange?: (hasVideo: boolean) => void;
}

/* ------------------------------------------------------------------ */
/* Validation & URL Helpers */
/* ------------------------------------------------------------------ */

function isValidUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function getVideoFileName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop() || "video";
    return decodeURIComponent(filename);
  } catch {
    return "video";
  }
}

function hasVideoExtension(url: string): boolean {
  const videoExtensions = [
    ".mp4",
    ".webm",
    ".mkv",
    ".mov",
    ".avi",
    ".m4v",
    ".ogv",
  ];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some((ext) => lowerUrl.includes(ext));
}

async function validateVideoUrl(url: string): Promise<{
  valid: boolean;
  error?: string;
  corsIssue?: boolean;
}> {
  if (!isValidUrl(url)) {
    return {
      valid: false,
      error: "Invalid URL format. Must start with http:// or https://",
    };
  }

  // Check for video-like extension or path pattern
  if (!hasVideoExtension(url)) {
    // Don't block - some URLs don't have extensions but still work
    console.warn("URL doesn't have typical video extension");
  }

  try {
    // Try a HEAD request to check if the resource exists and is accessible
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "HEAD",
      mode: "no-cors",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // no-cors mode doesn't give us status, but if it doesn't throw, the resource exists
    return { valid: true };
  } catch (err) {
    // If HEAD fails, it might be a CORS issue - the video might still work
    // in the video element since it uses different fetching rules
    console.log("HEAD request failed, assuming potential CORS issue:", err);
    return { valid: true, corsIssue: true };
  }
}

/* ------------------------------------------------------------------ */
/* Component */
/* ------------------------------------------------------------------ */

export const LocalVideoPlayer = forwardRef<
  LocalVideoPlayerHandle,
  LocalVideoPlayerProps
>(
  (
    {
      roomId,
      onPlay,
      onPause,
      onSeek,
      onTimeUpdate,
      onLoadedMetadata,
      onVideoSrcChange,
    },
    ref,
  ) => {
    const playerRef = useRef<VideoPlayerHandle>(null);
    const {
      roomState,
      setVideoUrl,
      reportVideoLoaded,
      pendingVideoUrl,
      clearPendingVideoUrl,
    } = useRoom();

    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [subtitleSrc, setSubtitleSrc] = useState<string | null>(null);
    const [resolution, setResolution] = useState<{
      w: number;
      h: number;
    } | null>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const [sourceMode, setSourceMode] = useState<"file" | "url">("file");
    const [videoUrlInput, setVideoUrlInput] = useState("");
    const [subtitleUrlInput, setSubtitleUrlInput] = useState("");
    const [isLoadingUrl, setIsLoadingUrl] = useState(false);
    const [urlValidation, setUrlValidation] = useState<{
      status: "idle" | "validating" | "valid" | "invalid";
      message?: string;
      corsWarning?: boolean;
    }>({ status: "idle" });

    const [showSharePrompt, setShowSharePrompt] = useState(false);
    const [corsError, setCorsError] = useState(false);
    const [videoLoadError, setVideoLoadError] = useState<string | null>(null);

    const videoInputRef = useRef<HTMLInputElement>(null);
    const subtitleInputRef = useRef<HTMLInputElement>(null);
    const videoElementRef = useRef<HTMLVideoElement | null>(null);

    // Forward handle from inner VideoPlayer
    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.play(),
      pause: () => playerRef.current?.pause(),
      seek: (t: number) => playerRef.current?.seek(t),
      setVolume: (v: number) => playerRef.current?.setVolume(v),
      toggleMute: () => playerRef.current?.toggleMute(),
      toggleFullscreen: () => playerRef.current?.toggleFullscreen(),
      toggleSubtitles: () => playerRef.current?.toggleSubtitles(),
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      getDuration: () => playerRef.current?.getDuration() ?? 0,
      getVolume: () => playerRef.current?.getVolume() ?? 0,
      isMuted: () => playerRef.current?.isMuted() ?? false,
      isPaused: () => playerRef.current?.isPaused() ?? true,
      areSubtitlesVisible: () =>
        playerRef.current?.areSubtitlesVisible() ?? false,
      hasSubtitles: () => playerRef.current?.hasSubtitles() ?? false,
      getVideoWidth: () => playerRef.current?.getVideoWidth() ?? 0,
      getVideoHeight: () => playerRef.current?.getVideoHeight() ?? 0,
    }));

    /* ---- File handling -------------------------------------------- */

    const handleVideoFile = useCallback(
      (file: File, restore = false) => {
        if (!file.type.startsWith("video/")) {
          toast.error("Invalid file", {
            description: "Please select a video file (.mp4, .mkv, .webm).",
          });
          return;
        }
        setVideoSrc(URL.createObjectURL(file));
        setCorsError(false);
        setVideoLoadError(null);
        if (!restore) {
          saveFile(roomId, file);
          toast.success("Video loaded", { description: file.name });
          // Clear any shared URL since we're loading a local file
          setVideoUrlInput("");
          setUrlValidation({ status: "idle" });
        } else {
          toast.info("Restored previous video", { description: file.name });
        }
        // Report video loaded to room
        reportVideoLoaded();
        onVideoSrcChange?.(true);
      },
      [roomId, reportVideoLoaded, onVideoSrcChange],
    );

    const handleSubtitleFile = useCallback((file: File) => {
      if (!file.name.endsWith(".vtt") && !file.name.endsWith(".srt")) {
        toast.error("Invalid file", {
          description: "Please select a subtitle file (.vtt or .srt).",
        });
        return;
      }
      setSubtitleSrc(URL.createObjectURL(file));
      toast.success("Subtitles loaded", { description: file.name });
    }, []);

    /* ---- URL validation ------------------------------------------- */

    const validateUrlInput = useCallback(async (url: string) => {
      if (!url.trim()) {
        setUrlValidation({ status: "idle" });
        return;
      }

      setUrlValidation({ status: "validating" });

      const result = await validateVideoUrl(url);

      if (result.valid) {
        setUrlValidation({
          status: "valid",
          message: result.corsIssue
            ? "URL is valid but may have CORS restrictions"
            : "URL looks valid",
          corsWarning: result.corsIssue,
        });
      } else {
        setUrlValidation({
          status: "invalid",
          message: result.error || "Invalid URL",
        });
      }
    }, []);

    // Debounced validation
    useEffect(() => {
      const timeoutId = setTimeout(() => {
        if (videoUrlInput) {
          validateUrlInput(videoUrlInput);
        } else {
          setUrlValidation({ status: "idle" });
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    }, [videoUrlInput, validateUrlInput]);

    /* ---- URL handling --------------------------------------------- */

    const handleVideoUrl = useCallback(
      async (url?: string, skipValidation = false) => {
        const targetUrl = (url || videoUrlInput).trim();
        if (!targetUrl) {
          toast.error("No URL", { description: "Please enter a video URL." });
          return;
        }

        if (!isValidUrl(targetUrl)) {
          toast.error("Invalid URL", {
            description: "Enter a valid http:// or https:// URL.",
          });
          return;
        }

        setIsLoadingUrl(true);
        setCorsError(false);
        setVideoLoadError(null);

        if (!skipValidation) {
          const validation = await validateVideoUrl(targetUrl);
          if (!validation.valid) {
            toast.error("URL Validation Failed", {
              description: validation.error,
            });
            setIsLoadingUrl(false);
            return;
          }

          if (validation.corsIssue) {
            toast.warning("CORS Warning", {
              description:
                "This URL may be blocked by CORS. If the video doesn't load, try a different source.",
            });
          }
        }

        setVideoSrc(targetUrl);
        setVideoUrlInput(targetUrl);
        toast.success("Video URL set", {
          description: getVideoFileName(targetUrl),
        });
        setIsLoadingUrl(false);
        setSourceMode("url");
        // Report video loaded to room
        reportVideoLoaded();
        onVideoSrcChange?.(true);
      },
      [videoUrlInput, reportVideoLoaded, onVideoSrcChange],
    );

    const handleSubtitleUrl = useCallback(() => {
      const url = subtitleUrlInput.trim();
      if (!url) {
        toast.error("No URL", {
          description: "Please enter a subtitle URL.",
        });
        return;
      }
      if (!isValidUrl(url)) {
        toast.error("Invalid URL", {
          description: "Enter a valid http:// or https:// URL.",
        });
        return;
      }
      // Proxy subtitle through our worker to avoid CORS issues
      const proxiedUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      setSubtitleSrc(proxiedUrl);
      toast.success("Subtitle URL set", {
        description: url.length > 60 ? `${url.slice(0, 60)}...` : url,
      });
    }, [subtitleUrlInput]);

    /* ---- Video sharing -------------------------------------------- */

     const handleShareVideo = useCallback(() => {
       if (!videoSrc || videoSrc.startsWith("blob:")) {
         toast.error("Cannot share", {
           description: "Only URL-based videos can be shared with the room.",
         });
         return;
       }

       setVideoUrl(videoSrc);
       setShowSharePrompt(false);
       toast.success("Video shared with room", {
         description: "Everyone in the room will now see and can load this video.",
       });
     }, [videoSrc, setVideoUrl]);

    const handleLoadSharedVideo = useCallback(
      (url: string) => {
        handleVideoUrl(url, true);
        clearPendingVideoUrl();
        toast.success("Loading shared video", {
          description: getVideoFileName(url),
        });
      },
      [handleVideoUrl, clearPendingVideoUrl],
    );

    const handleDeclineSharedVideo = useCallback(() => {
      clearPendingVideoUrl();
      toast.info("Declined shared video");
    }, [clearPendingVideoUrl]);

    /* ---- Drag & Drop --------------------------------------------- */

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);

        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
          if (file.type.startsWith("video/")) {
            handleVideoFile(file);
          } else if (file.name.endsWith(".vtt") || file.name.endsWith(".srt")) {
            handleSubtitleFile(file);
          }
        }
      },
      [handleVideoFile, handleSubtitleFile],
    );

    /* ---- Restore from IndexedDB on mount ------------------------- */

    useEffect(() => {
      if (!roomId) return;
      let mounted = true;
      getFile(roomId).then((file) => {
        if (mounted && file) {
          handleVideoFile(file, true);
        }
      });
      return () => {
        mounted = false;
      };
    }, [roomId, handleVideoFile]);

    /* ---- Check for pending shared video -------------------------- */

    useEffect(() => {
      if (pendingVideoUrl && pendingVideoUrl !== videoSrc) {
        // Show a toast notification
        toast.info("New video available", {
          description: "Someone shared a video. Click to load it.",
          action: {
            label: "Load",
            onClick: () => handleLoadSharedVideo(pendingVideoUrl),
          },
          duration: 10000,
        });
      }
    }, [pendingVideoUrl, videoSrc, handleLoadSharedVideo]);

    /* ---- Auto-load room's shared video when available ------------ */

    // Track the last loaded shared video URL to avoid reloading
    const lastLoadedSharedRef = useRef<string | null>(null);

    useEffect(() => {
      const sharedUrl = roomState?.videoUrl;
      // Skip if no shared URL, or it's the same as already loaded, or we have a local file
      if (!sharedUrl || sharedUrl === videoSrc || videoSrc?.startsWith("blob:")) {
        return;
      }

      // Skip if we've already handled this specific URL
      if (lastLoadedSharedRef.current === sharedUrl) {
        return;
      }

      // Mark this URL as handled
      lastLoadedSharedRef.current = sharedUrl;

      // Auto-load the shared video
      toast.info("Loading shared video...", {
        description: getVideoFileName(sharedUrl),
        duration: 3000,
      });
      handleVideoUrl(sharedUrl, true);
    }, [roomState?.videoUrl, videoSrc, handleVideoUrl]);

    /* ---- Metadata loaded: sync with room state ------------------- */

    const handleLoadedMetadata = useCallback(() => {
      const w = playerRef.current?.getVideoWidth() || 0;
      const h = playerRef.current?.getVideoHeight() || 0;
      if (w > 0 && h > 0) setResolution({ w, h });

      // Sync with room state on first load (seek to server time, play if room is playing)
      if (roomState && playerRef.current) {
        playerRef.current.seek(roomState.currentTime);
        // Don't autoplay — only play if room is currently playing
        if (!roomState.paused) {
          playerRef.current.play();
        }
      }

      onLoadedMetadata?.();
    }, [roomState, onLoadedMetadata]);

    /* ---- Video error handling ------------------------------------ */

    const handleVideoError = useCallback(() => {
      const video = videoElementRef.current;
      if (video && video.error) {
        const errorCode = video.error.code;
        let errorMessage = "Failed to load video";
        let isCors = false;

        switch (errorCode) {
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = "Video format not supported or invalid URL";
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = "Network error - check your connection";
            isCors = true;
            break;
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = "Video loading was aborted";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = "Video decoding error - file may be corrupted";
            break;
          default:
            errorMessage = "Failed to load video (possible CORS restriction)";
            isCors = true;
        }

        setVideoLoadError(errorMessage);
        setCorsError(isCors);

        toast.error("Video Error", {
          description: errorMessage,
        });
      }
    }, []);

    /* ---- Resolution label ---------------------------------------- */

    const resLabel = resolution ? `${resolution.w}×${resolution.h}` : null;

    /* ---- Render: no video loaded → source picker ------------------- */

    if (!videoSrc) {
      return (
        <div
          className="w-full"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Shared video prompt */}
          {roomState?.videoUrl && (
            <div className="mb-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-[#111827] dark:text-[#EDEDED]">
                    Shared video available
                  </h4>
                  <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1 truncate">
                    {getVideoFileName(roomState.videoUrl)}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => handleLoadSharedVideo(roomState.videoUrl!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      <Play size={12} />
                      Load this video
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSharePrompt(false)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F3F4F6] dark:hover:bg-[#111111] transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Source mode tabs */}
          <div className="flex items-center gap-1 mb-3 p-1 rounded-lg bg-[#F3F4F6] dark:bg-[#111111] w-fit">
            <button
              type="button"
              onClick={() => setSourceMode("file")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                sourceMode === "file"
                  ? "bg-white dark:bg-[#1A1A1A] text-[#111827] dark:text-[#EDEDED] shadow-sm"
                  : "text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111827] dark:hover:text-[#EDEDED]"
              }`}
            >
              <HardDrive size={13} />
              Local File
            </button>
            <button
              type="button"
              onClick={() => setSourceMode("url")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                sourceMode === "url"
                  ? "bg-white dark:bg-[#1A1A1A] text-[#111827] dark:text-[#EDEDED] shadow-sm"
                  : "text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111827] dark:hover:text-[#EDEDED]"
              }`}
            >
              <Link size={13} />
              Direct URL
            </button>
          </div>

          {sourceMode === "file" ? (
            /* ---- File mode: drag & drop zone ---- */
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className={`
                relative w-full aspect-video rounded-xl border-2 border-dashed
                flex flex-col items-center justify-center gap-4
                transition-all duration-300 cursor-pointer text-left
                ${
                  isDraggingOver
                    ? "border-blue-500 bg-blue-500/10 scale-[1.01] shadow-lg shadow-blue-500/20"
                    : "border-[#E5E7EB] dark:border-[#1F1F23] bg-[#FAFAFA] dark:bg-[#0A0A0A] hover:border-[#999] dark:hover:border-[#444]"
                }
              `}
            >
              {/* Animated upload icon */}
              <div
                className={`
                  p-4 rounded-2xl transition-all duration-300
                  ${isDraggingOver ? "bg-blue-500/20 scale-110" : "bg-[#F3F4F6] dark:bg-[#111111]"}
                `}
              >
                <Upload
                  size={32}
                  className={`transition-colors duration-300 ${
                    isDraggingOver
                      ? "text-blue-500"
                      : "text-[#6B7280] dark:text-[#A1A1AA]"
                  }`}
                />
              </div>

              <div className="text-center">
                <p
                  className={`text-sm font-semibold transition-colors ${
                    isDraggingOver
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-[#111827] dark:text-[#EDEDED]"
                  }`}
                >
                  {isDraggingOver
                    ? "Drop your file here"
                    : "Drag & drop a video file"}
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">
                  or click to browse · MP4, WebM, MKV
                </p>
              </div>

              {/* Subtitle upload button */}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  subtitleInputRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    subtitleInputRef.current?.click();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111827] dark:hover:text-[#EDEDED] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#111111] transition-colors"
              >
                <Subtitles size={14} />
                Add subtitles (.vtt)
              </span>

              {subtitleSrc && (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                  Subtitles loaded
                </span>
              )}
            </button>
          ) : (
            /* ---- URL mode: text inputs ---- */
            <div
              className={`
                relative w-full aspect-video rounded-xl border-2
                flex flex-col items-center justify-center gap-5 px-6
                transition-all duration-300
                border-[#E5E7EB] dark:border-[#1F1F23] bg-[#FAFAFA] dark:bg-[#0A0A0A]
              `}
            >
              <div className="p-3 rounded-2xl bg-[#F3F4F6] dark:bg-[#111111]">
                <Link
                  size={28}
                  className="text-[#6B7280] dark:text-[#A1A1AA]"
                />
              </div>

              {/* Video URL input */}
              <div className="w-full max-w-md flex flex-col gap-1.5">
                <label
                  htmlFor="video-url-input"
                  className="text-[11px] font-medium text-[#6B7280] dark:text-[#A1A1AA]"
                >
                  Video URL
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      id="video-url-input"
                      type="url"
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleVideoUrl();
                      }}
                      placeholder="https://example.com/video.mp4"
                      className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-[#0A0A0A] text-[#111827] dark:text-[#EDEDED] placeholder:text-[#9CA3AF] dark:placeholder:text-[#52525B] focus:outline-none focus:ring-2 transition-all ${
                        urlValidation.status === "valid"
                          ? "border-green-500 focus:ring-green-500/40 focus:border-green-500"
                          : urlValidation.status === "invalid"
                            ? "border-red-500 focus:ring-red-500/40 focus:border-red-500"
                            : "border-[#E5E7EB] dark:border-[#1F1F23] focus:ring-blue-500/40 focus:border-blue-500"
                      }`}
                    />
                    {urlValidation.status === "valid" && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                    {urlValidation.status === "invalid" && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    )}
                  </div>
                   <button
                     type="button"
                     onClick={() => {
                       handleVideoUrl();
                       // Load only for current user (doesn't share with room)
                     }}
                     disabled={
                       isLoadingUrl ||
                       !videoUrlInput.trim() ||
                       urlValidation.status === "invalid"
                     }
                     className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                   >
                     {isLoadingUrl ? "Loading..." : "Load for Me"}
                   </button>
                </div>
                {urlValidation.message && (
                  <p
                    className={`text-[11px] flex items-center gap-1 ${
                      urlValidation.status === "valid"
                        ? urlValidation.corsWarning
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {urlValidation.status === "valid" ? (
                      urlValidation.corsWarning ? (
                        <AlertCircle size={12} />
                      ) : (
                        <CheckCircle2 size={12} />
                      )
                    ) : (
                      <AlertCircle size={12} />
                    )}
                    {urlValidation.message}
                  </p>
                )}
              </div>

              {/* Subtitle URL input */}
              <div className="w-full max-w-md flex flex-col gap-1.5">
                <label
                  htmlFor="subtitle-url-input"
                  className="text-[11px] font-medium text-[#6B7280] dark:text-[#A1A1AA]"
                >
                  Subtitle URL
                  <span className="ml-1 font-normal text-[#9CA3AF] dark:text-[#52525B]">
                    (optional · .vtt or .srt)
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="subtitle-url-input"
                    type="url"
                    value={subtitleUrlInput}
                    onChange={(e) => setSubtitleUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubtitleUrl();
                    }}
                    placeholder="https://example.com/captions.vtt"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] dark:border-[#1F1F23] bg-white dark:bg-[#0A0A0A] text-[#111827] dark:text-[#EDEDED] placeholder:text-[#9CA3AF] dark:placeholder:text-[#52525B] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleSubtitleUrl}
                    disabled={!subtitleUrlInput.trim()}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-[#E5E7EB] dark:border-[#1F1F23] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F3F4F6] dark:hover:bg-[#111111] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Load
                  </button>
                </div>
              </div>

              <div className="text-[10px] text-[#9CA3AF] dark:text-[#52525B] text-center max-w-sm space-y-1">
                <p>
                  Paste a direct link to a video file. The URL must point to a
                  playable media file (MP4, WebM, etc).
                </p>
                <p className="text-amber-600 dark:text-amber-400">
                  Note: Some URLs may be blocked by CORS policies. If a video
                  doesn't load, try a different source.
                </p>
              </div>
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleVideoFile(file);
            }}
          />
          <input
            ref={subtitleInputRef}
            type="file"
            accept=".vtt,.srt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSubtitleFile(file);
            }}
          />
        </div>
      );
    }

    /* ---- Render: video loaded → player --------------------------- */

    return (
      <div
        className="w-full relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay on top of playing video */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-xl flex items-center justify-center backdrop-blur-sm pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <Upload size={40} className="text-blue-500" />
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                Drop to replace
              </span>
            </div>
          </div>
        )}

        {/* Resolution badge */}
        {resLabel && (
          <div className="absolute top-3 right-3 z-30 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] font-mono font-bold text-white/80 border border-white/10">
            {resLabel}
          </div>
        )}

        {/* CORS Error overlay */}
        {corsError && videoLoadError && (
          <div className="absolute inset-0 z-40 bg-black/80 flex items-center justify-center rounded-xl">
            <div className="max-w-md p-6 text-center">
              <div className="p-3 rounded-full bg-red-500/20 mx-auto w-fit mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Video Unavailable
              </h3>
              <p className="text-sm text-gray-300 mb-4">{videoLoadError}</p>
              <p className="text-xs text-gray-400 mb-4">
                This video is blocked by CORS (Cross-Origin Resource Sharing)
                policies. The server hosting this video doesn't allow it to be
                played on other websites.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setVideoSrc(null);
                    setCorsError(false);
                    setVideoLoadError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Try Another Source
                </button>
              </div>
            </div>
          </div>
        )}

        <VideoPlayer
          ref={playerRef}
          src={videoSrc}
          subTitlesFile={subtitleSrc || undefined}
          showControls={isFullscreen}
          size="lg"
          accentColor="white"
          className="w-full aspect-video rounded-xl overflow-hidden"
          onPlay={() => onPlay?.(playerRef.current?.getCurrentTime() ?? 0)}
          onPause={() => onPause?.(playerRef.current?.getCurrentTime() ?? 0)}
          onSeek={(time) => onSeek?.(time)}
          onTimeUpdate={(current, dur) => onTimeUpdate?.(current, dur)}
          onLoadedMetadata={handleLoadedMetadata}
          onFullscreenChange={(fs) => setIsFullscreen(fs)}
          onError={handleVideoError}
        />

        {/* Current video info bar */}
        <div className="mt-3 p-3 rounded-lg bg-[#F3F4F6] dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#1F1F23]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <Film
                size={16}
                className="text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0"
              />
              <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0">
                Current:
              </span>
              <span className="text-sm text-[#111827] dark:text-[#EDEDED] truncate font-medium">
                {videoSrc.startsWith("blob:")
                  ? "Local file"
                  : getVideoFileName(videoSrc)}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
               {!videoSrc.startsWith("blob:") && (
                 <button
                   type="button"
                   onClick={() => {
                     handleShareVideo();
                     // Also load the video locally when sharing with room
                     if (videoSrc) {
                       handleVideoUrl(videoSrc);
                     }
                   }}
                   className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                 >
                   <Share2 size={12} />
                   Load for Everyone
                 </button>
               )}
              {videoSrc.startsWith("blob:") ? (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111827] dark:hover:text-[#EDEDED] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#1A1A1A] transition-colors"
                >
                  <Upload size={12} />
                  Change Video
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setVideoSrc(null);
                    setVideoUrlInput("");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111827] dark:hover:text-[#EDEDED] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#1A1A1A] transition-colors"
                >
                  <Link size={12} />
                  Change Source
                </button>
              )}
            </div>
          </div>

          {/* Shared video info */}
          {roomState?.videoUrl && roomState.videoUrl !== videoSrc && (
            <div className="mt-3 pt-3 border-t border-[#E5E7EB] dark:border-[#1F1F23]">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe size={16} className="text-blue-500 flex-shrink-0" />
                  <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0">
                    Room video:
                  </span>
                  <span className="text-sm text-[#111827] dark:text-[#EDEDED] truncate font-medium">
                    {getVideoFileName(roomState.videoUrl)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (roomState?.videoUrl) {
                      handleLoadSharedVideo(roomState.videoUrl);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex-shrink-0"
                >
                  <Play size={12} />
                  Load Room Video
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom toolbar: swap video / add subtitles */}
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111827] dark:hover:text-[#EDEDED] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#111111] transition-colors"
          >
            <Film size={14} />
            Change Video
          </button>
          <button
            type="button"
            onClick={() => {
              setVideoSrc(null);
              setSubtitleSrc(null);
              setResolution(null);
              setSourceMode("url");
              setCorsError(false);
              setVideoLoadError(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111827] dark:hover:text-[#EDEDED] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#111111] transition-colors"
          >
            <Link size={14} />
            Load URL
          </button>
          <button
            type="button"
            onClick={() => subtitleInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111827] dark:hover:text-[#EDEDED] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#111111] transition-colors"
          >
            <Subtitles size={14} />
            {subtitleSrc ? "Change Subtitles" : "Add Subtitles"}
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleVideoFile(file);
          }}
        />
        <input
          ref={subtitleInputRef}
          type="file"
          accept=".vtt,.srt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleSubtitleFile(file);
          }}
        />
      </div>
    );
  },
);

LocalVideoPlayer.displayName = "LocalVideoPlayer";
