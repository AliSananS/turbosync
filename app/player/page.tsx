"use client";
import { useRef, useState } from "react";
import VideoPlayer from "@/components/video-player";
import type { VideoPlayerHandle } from "@/types";

export default function PlayerPage() {
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [subTitlesSrc, setSubtitlesSrc] = useState<string>("");
  const playerRef = useRef<VideoPlayerHandle>(null);

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const videoURL = URL.createObjectURL(file);
      setVideoSrc(videoURL);
    }
  };

  const handleSubtitlesUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const subtitlesURL = URL.createObjectURL(file);
      setSubtitlesSrc(subtitlesURL);
    }
  };

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        gap: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "100%",
          maxWidth: "800px",
        }}
      >
        <div>
          <label
            htmlFor="video-upload"
            style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}
          >
            Upload Video File
          </label>
          <input
            id="video-upload"
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            aria-label="Upload video file"
          />
        </div>

        <div>
          <label
            htmlFor="subtitles-upload"
            style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}
          >
            Upload Subtitles File (.vtt)
          </label>
          <input
            id="subtitles-upload"
            type="file"
            accept=".vtt"
            aria-label="Upload subtitles file"
            onChange={handleSubtitlesUpload}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => playerRef.current?.play()}
            style={{
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Play
          </button>
          <button
            type="button"
            onClick={() => playerRef.current?.pause()}
            style={{
              padding: "8px 16px",
              backgroundColor: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Pause
          </button>
          <button
            type="button"
            onClick={() => playerRef.current?.seek(0)}
            style={{
              padding: "8px 16px",
              backgroundColor: "#8b5cf6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Restart
          </button>
        </div>
      </div>

      {videoSrc && (
        <div style={{ width: "100%", maxWidth: "800px" }}>
          <VideoPlayer
            ref={playerRef}
            src={videoSrc}
            subTitlesFile={subTitlesSrc}
            subtitlesLang="en"
            showControls={true}
          />
        </div>
      )}
    </main>
  );
}
