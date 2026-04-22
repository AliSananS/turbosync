"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useRoom } from "@/lib/room-context";
import type { RoomPermissions } from "@/types";
import { Settings, Shield, Sliders, Lock, Users } from "lucide-react";
import { toast } from "sonner";

export function RoomSettingsDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const { roomState, updatePermissions } = useRoom();
  const permissions = roomState?.permissions;

  const [syncThreshold, setSyncThreshold] = useState(2.0);
  const [autoPauseOnBuffering, setAutoPauseOnBuffering] = useState(true);
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
  }, []);

  const handleSave = () => {
    // Apply permissions changes
    toast.success("Room settings updated", {
      description: `Sync threshold: ${syncThreshold}s`,
    });
    setOpen(false);
  };

  const handleDiscard = () => {
    setOpen(false);
  };

  const handlePermissionChange = (
    key: keyof RoomPermissions,
    value: boolean,
  ) => {
    if (permissions) {
      updatePermissions({ ...permissions, [key]: value });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-[#FFFFFF] dark:bg-[#0A0A0A] border-[#E5E7EB] dark:border-[#1F1F23] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 py-5 border-b border-[#E5E7EB] dark:border-[#1F1F23] bg-gray-50/50 dark:bg-[#111111]/50 text-left">
          <DialogTitle className="text-lg font-bold text-[#111827] dark:text-[#EDEDED] tracking-tight flex items-center gap-2">
            <Settings size={20} />
            Room Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">
            Configure synchronization and room access. Anyone can change these
            settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Synchronization */}
          <div className="px-6 py-6 border-b border-[#E5E7EB] dark:border-[#1F1F23]">
            <h3 className="text-xs font-bold text-[#111827] dark:text-[#EDEDED] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sliders size={16} />
              Synchronization
            </h3>

            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-[#111827] dark:text-[#EDEDED]">
                    Sync Threshold
                  </label>
                  <span className="text-xs font-mono text-[#6B7280] dark:text-[#A1A1AA]">
                    {syncThreshold}s
                  </span>
                </div>
                <Slider
                  value={[syncThreshold]}
                  onValueChange={([v]) => setSyncThreshold(v)}
                  min={0.1}
                  max={5}
                  step={0.1}
                  className="w-full"
                />
                <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] mt-1.5">
                  Maximum allowed drift before forced re-sync. Lower = tighter
                  sync, higher = smoother playback.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] dark:border-[#1F1F23] bg-gray-50 dark:bg-[#111111]">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#111827] dark:text-[#EDEDED]">
                    Auto-Pause on Buffering
                  </span>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                    Pause all viewers when one is buffering
                  </span>
                </div>
                <Switch
                  checked={autoPauseOnBuffering}
                  onCheckedChange={setAutoPauseOnBuffering}
                />
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="px-6 py-6 border-b border-[#E5E7EB] dark:border-[#1F1F23]">
            <h3 className="text-xs font-bold text-[#111827] dark:text-[#EDEDED] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users size={16} />
              Room Permissions
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] dark:border-[#1F1F23] bg-gray-50 dark:bg-[#111111]">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#111827] dark:text-[#EDEDED]">
                    Allow Playback Control
                  </span>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                    Everyone can play, pause, and seek
                  </span>
                </div>
                <Switch
                  checked={permissions?.viewersCanControl ?? true}
                  onCheckedChange={(checked) =>
                    handlePermissionChange("viewersCanControl", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] dark:border-[#1F1F23] bg-gray-50 dark:bg-[#111111]">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#111827] dark:text-[#EDEDED]">
                    Allow Chat
                  </span>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                    Everyone can send chat messages
                  </span>
                </div>
                <Switch
                  checked={permissions?.viewersCanChat ?? true}
                  onCheckedChange={(checked) =>
                    handlePermissionChange("viewersCanChat", checked)
                  }
                />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="px-6 py-6">
            <h3 className="text-xs font-bold text-[#111827] dark:text-[#EDEDED] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield size={16} />
              About This Room
            </h3>
            <div className="p-3 rounded-lg border border-[#E5E7EB] dark:border-[#1F1F23] bg-gray-50 dark:bg-[#111111] text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              <p className="mb-2">
                <strong className="text-[#111827] dark:text-[#EDEDED]">
                  Room ID:
                </strong>{" "}
                {roomState?.id}
              </p>
              <p className="mb-2">
                <strong className="text-[#111827] dark:text-[#EDEDED]">
                  Auto-deletion:
                </strong>{" "}
                Room will be deleted after 24 hours of inactivity
              </p>
              <p>
                <strong className="text-[#111827] dark:text-[#EDEDED]">
                  Democracy mode:
                </strong>{" "}
                Anyone can control playback and change settings
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#1F1F23] bg-gray-50/50 dark:bg-[#111111]/50 flex justify-end gap-3">
          <Button variant="ghost" onClick={handleDiscard} className="text-xs">
            Close
          </Button>
          <Button onClick={handleSave} className="text-xs">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
