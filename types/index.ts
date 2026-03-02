export interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export interface VideoPlayerProps {
  src: string;
  subTitlesFile?: string;
  subtitlesLang?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  showControls?: boolean;
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
