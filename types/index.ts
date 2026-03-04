export interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVolume: () => number;
  isMuted: () => boolean;
  isPaused: () => boolean;
}

export interface VideoPlayerClassNames {
  /** Root container */
  root?: string;
  /** The <video> element */
  video?: string;
  /** Controls overlay wrapper */
  overlay?: string;
  /** Progress bar track */
  progressTrack?: string;
  /** Progress bar filled portion */
  progressFill?: string;
  /** Progress bar thumb/handle */
  progressThumb?: string;
  /** Bottom controls bar */
  controlsBar?: string;
  /** Left control group */
  controlsLeft?: string;
  /** Right control group */
  controlsRight?: string;
  /** Individual control button */
  button?: string;
  /** Volume slider track */
  volumeTrack?: string;
  /** Volume slider fill */
  volumeFill?: string;
  /** Time display text */
  timeDisplay?: string;
}

export type VideoPlayerSize = "sm" | "md" | "lg";

export interface VideoPlayerProps {
  /** Video source URL */
  src: string;
  /** Poster image URL */
  poster?: string;
  /** Subtitles file URL (.vtt) */
  subTitlesFile?: string;
  /** Subtitles language code */
  subtitlesLang?: string;
  /** Auto-play on mount */
  autoPlay?: boolean;
  /** Loop playback */
  loop?: boolean;
  /** Start muted */
  muted?: boolean;
  /** Show built-in controls overlay */
  showControls?: boolean;
  /** Preload behavior */
  preload?: "auto" | "metadata" | "none";

  // --- Customization ---

  /** Size preset affecting padding & icon sizing */
  size?: VideoPlayerSize;
  /** Accent color for progress bar & active states (any valid CSS color) */
  accentColor?: string;
  /** Class name overrides for sub-elements */
  classNames?: VideoPlayerClassNames;
  /** Additional className for root container */
  className?: string;
  /** Controls auto-hide delay in ms (0 = never hide) */
  controlsTimeout?: number;
  /** Seek step in seconds for keyboard arrows */
  seekStep?: number;
  /** Volume step for keyboard arrows (0-1) */
  volumeStep?: number;
  /** Disable keyboard shortcuts */
  disableKeyboardShortcuts?: boolean;

  // --- Callbacks ---

  /** Fired when playback starts */
  onPlay?: () => void;
  /** Fired when playback pauses */
  onPause?: () => void;
  /** Fired when currentTime updates */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Fired when video metadata is loaded */
  onLoadedMetadata?: (duration: number) => void;
  /** Fired when video ends */
  onEnded?: () => void;
  /** Fired when volume changes */
  onVolumeChange?: (volume: number, muted: boolean) => void;
  /** Fired when fullscreen state changes */
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /** Fired when seeking */
  onSeek?: (time: number) => void;

  // --- Render Slots ---

  /** Replace the play/pause button */
  renderPlayButton?: (
    isPlaying: boolean,
    toggle: () => void,
  ) => React.ReactNode;
  /** Replace the mute button */
  renderMuteButton?: (isMuted: boolean, toggle: () => void) => React.ReactNode;
  /** Replace the fullscreen button */
  renderFullscreenButton?: (
    isFullscreen: boolean,
    toggle: () => void,
  ) => React.ReactNode;
  /** Replace the time display */
  renderTimeDisplay?: (
    currentTime: number,
    duration: number,
    formatted: { current: string; total: string },
  ) => React.ReactNode;
  /** Render extra controls in the left group */
  renderExtraControlsLeft?: () => React.ReactNode;
  /** Render extra controls in the right group */
  renderExtraControlsRight?: () => React.ReactNode;
}

export interface User {
  id: string;
  fullName: string;
  username: string;
}

export interface Room {
  id: string;
  name: string;
  videoSrc: string;
  videoId: string;
  users: User[];
}
