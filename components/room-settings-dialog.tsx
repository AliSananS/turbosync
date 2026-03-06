"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import {
  Video,
  Link2,
  Settings2,
  Shield,
  Unlock,
  Lock,
  CheckCircle2,
} from "lucide-react";

export function RoomSettingsDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const [syncThreshold, setSyncThreshold] = useState([150]);
  const [isPrivate, setIsPrivate] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-[#F3F4F6] dark:bg-[#050505] border-[#E5E7EB] dark:border-[#1F1F23]">
        <DialogHeader className="px-6 lg:px-8 py-5 border-b border-[#E5E7EB] dark:border-[#1F1F23] bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md">
          <div className="flex justify-between items-center w-full">
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-[#111827] dark:text-[#EDEDED]">
                Room Settings
              </DialogTitle>
              <DialogDescription className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mt-1">
                Manage video source, synchronization parameters and access
                control.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 lg:px-8 py-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Video Source Section */}
          <section className="bg-white dark:bg-[#0A0A0A] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Video className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#111827] dark:text-[#EDEDED]">
                  Video Source
                </h2>
                <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">
                  Configure the primary media stream for all connected viewers.
                </p>
              </div>
            </div>

            <div className="space-y-6 max-w-2xl">
              <div>
                <Label htmlFor="video-url" className="mb-2 block">
                  Stream URL
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-[#A1A1AA]">
                    <Link2 size={18} />
                  </span>
                  <Input
                    id="video-url"
                    type="url"
                    placeholder="https://..."
                    defaultValue="https://cdn.example.com/hls/stream_v4.m3u8"
                    className="pl-10 dark:bg-black dark:border-[#1F1F23]"
                  />
                </div>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1.5">
                  Supports HLS (.m3u8), DASH (.mpd), or direct MP4 links.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="stream-quality" className="mb-2 block">
                    Default Quality
                  </Label>
                  <Select defaultValue="auto">
                    <SelectTrigger
                      id="stream-quality"
                      className="dark:bg-black dark:border-[#1F1F23]"
                    >
                      <SelectValue placeholder="Select quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (Adaptive)</SelectItem>
                      <SelectItem value="1080p">1080p Source</SelectItem>
                      <SelectItem value="720p">720p High</SelectItem>
                      <SelectItem value="480p">480p SD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="buffer-health" className="mb-2 block">
                    Buffer Goal
                  </Label>
                  <Select defaultValue="standard">
                    <SelectTrigger
                      id="buffer-health"
                      className="dark:bg-black dark:border-[#1F1F23]"
                    >
                      <SelectValue placeholder="Select buffer size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low-latency">
                        Low Latency (2s)
                      </SelectItem>
                      <SelectItem value="standard">Standard (6s)</SelectItem>
                      <SelectItem value="high-stability">
                        High Stability (12s)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>

          {/* Synchronization Section */}
          <section className="bg-white dark:bg-[#0A0A0A] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <Settings2
                  className="text-amber-600 dark:text-amber-400"
                  size={24}
                />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#111827] dark:text-[#EDEDED]">
                  Synchronization
                </h2>
                <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">
                  Fine-tune how strictly viewers are kept in sync with the host.
                </p>
              </div>
            </div>

            <div className="space-y-8 max-w-2xl">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <Label htmlFor="sync-threshold" className="mb-0">
                    Sync Threshold
                  </Label>
                  <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/50">
                    {syncThreshold} ms
                  </span>
                </div>
                <Slider
                  defaultValue={syncThreshold}
                  min={50}
                  max={2000}
                  step={10}
                  onValueChange={setSyncThreshold}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-2 font-medium uppercase tracking-wider">
                  <span>Strict (50ms)</span>
                  <span>Relaxed (2000ms)</span>
                </div>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-3">
                  Determines the maximum allowed drift before a viewer is
                  forcibly re-synced.
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border border-[#E5E7EB] dark:border-[#1F1F23] rounded-lg bg-[#F3F4F6] dark:bg-black/50">
                <div>
                  <span className="text-sm font-bold text-[#111827] dark:text-[#EDEDED] block">
                    Auto-Pause on Buffering
                  </span>
                  <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] block mt-1">
                    Pause video for everyone if host buffers.
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </section>

          {/* Privacy & Access Section */}
          <section className="bg-white dark:bg-[#0A0A0A] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <Shield
                  className="text-emerald-600 dark:text-emerald-400"
                  size={24}
                />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#111827] dark:text-[#EDEDED]">
                  Privacy & Access
                </h2>
                <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">
                  Control who can enter the room and who has moderator
                  privileges.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
              <div
                onClick={() => setIsPrivate(false)}
                className={`p-4 rounded-lg bg-white dark:bg-[#0A0A0A] relative cursor-pointer group transition-colors ${!isPrivate ? "border-2 border-[#111111] dark:border-white" : "border border-[#E5E7EB] dark:border-[#1F1F23] hover:border-gray-400 dark:hover:border-gray-600"}`}
              >
                {!isPrivate && (
                  <div className="absolute top-4 right-4 text-[#111111] dark:text-white">
                    <CheckCircle2 size={24} />
                  </div>
                )}
                <div
                  className={`mb-3 ${!isPrivate ? "text-[#111827] dark:text-[#EDEDED]" : "text-[#6B7280] dark:text-[#A1A1AA] group-hover:text-[#111827] dark:group-hover:text-[#EDEDED]"} transition-colors`}
                >
                  <Unlock size={32} />
                </div>
                <h3
                  className={`font-bold mb-1 ${!isPrivate ? "text-[#111827] dark:text-[#EDEDED]" : "text-[#6B7280] dark:text-[#A1A1AA] group-hover:text-[#111827] dark:group-hover:text-[#EDEDED]"} transition-colors`}
                >
                  Public Room
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">
                  Anyone with the link can join as a viewer. No approval
                  required.
                </p>
              </div>

              <div
                onClick={() => setIsPrivate(true)}
                className={`p-4 rounded-lg bg-white dark:bg-[#0A0A0A] relative cursor-pointer group transition-colors ${isPrivate ? "border-2 border-[#111111] dark:border-white" : "border border-[#E5E7EB] dark:border-[#1F1F23] hover:border-gray-400 dark:hover:border-gray-600"}`}
              >
                {isPrivate && (
                  <div className="absolute top-4 right-4 text-[#111111] dark:text-white">
                    <CheckCircle2 size={24} />
                  </div>
                )}
                <div
                  className={`mb-3 ${isPrivate ? "text-[#111827] dark:text-[#EDEDED]" : "text-[#6B7280] dark:text-[#A1A1AA] group-hover:text-[#111827] dark:group-hover:text-[#EDEDED]"} transition-colors`}
                >
                  <Lock size={32} />
                </div>
                <h3
                  className={`font-bold mb-1 ${isPrivate ? "text-[#111827] dark:text-[#EDEDED]" : "text-[#6B7280] dark:text-[#A1A1AA] group-hover:text-[#111827] dark:group-hover:text-[#EDEDED]"} transition-colors`}
                >
                  Private Room
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">
                  Only users with an invite code or specific email domain can
                  join.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#E5E7EB] dark:border-[#1F1F23] flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-5 py-2.5 text-sm font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111827] dark:hover:text-[#EDEDED] transition-colors"
              >
                Discard Changes
              </button>
              <button
                type="button"
                className="px-5 py-2.5 bg-[#111111] dark:bg-white text-white dark:text-black text-sm font-bold rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-black/5 dark:shadow-white/5"
              >
                Save Configuration
              </button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
