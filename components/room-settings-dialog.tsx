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
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { Settings2, Shield, Unlock, Lock, CheckCircle2 } from "lucide-react";
import { useRoom } from "@/lib/room-context";

export function RoomSettingsDialog({ children }: { children: React.ReactNode }) {
  const { roomState, currentUser, updateSettings } = useRoom();
  const [open, setOpen] = useState(false);
  const [syncThreshold, setSyncThreshold] = useState([roomState?.settings?.syncThreshold ?? 150]);
  const [autoPause, setAutoPause] = useState(roomState?.settings?.autoPauseOnBuffering ?? true);
  const [isPrivate, setIsPrivate] = useState(roomState?.settings?.isPrivate ?? false);
  const isHost = Boolean(currentUser?.isHost);

  const save = () => {
    updateSettings({ syncThreshold: syncThreshold[0], autoPauseOnBuffering: autoPause, isPrivate });
    setOpen(false);
  };

  const reset = () => {
    setSyncThreshold([roomState?.settings?.syncThreshold ?? 150]);
    setAutoPause(roomState?.settings?.autoPauseOnBuffering ?? true);
    setIsPrivate(roomState?.settings?.isPrivate ?? false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-[#F3F4F6] dark:bg-[#050505] border-[#E5E7EB] dark:border-[#1F1F23]">
        <DialogHeader className="px-6 lg:px-8 py-5 border-b bg-white/80 dark:bg-[#0A0A0A]/80">
          <DialogTitle className="text-xl font-bold">Room Settings</DialogTitle>
          <DialogDescription className="text-sm">Manage synchronization parameters and access control.</DialogDescription>
        </DialogHeader>

        <div className="px-6 lg:px-8 py-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <section className="bg-white dark:bg-[#0A0A0A] border rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-4 mb-6"><div className="p-2.5 bg-amber-50 rounded-lg"><Settings2 className="text-amber-600" size={24} /></div><div><h2 className="text-lg font-bold">Synchronization</h2></div></div>
            <div className="space-y-5 max-w-3xl">
              <div>
                <div className="flex items-center justify-between mb-3"><span className="text-sm font-bold">Sync Threshold</span><span className="text-sm font-mono">{syncThreshold[0]}ms</span></div>
                <Slider value={syncThreshold} disabled={!isHost} min={50} max={2000} step={10} onValueChange={(value) => { setSyncThreshold(value); updateSettings({ syncThreshold: value[0] }); }} className="w-full" />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div><span className="text-sm font-bold block">Auto-Pause on Buffering</span></div>
                <Switch checked={autoPause} disabled={!isHost} onCheckedChange={(value) => { setAutoPause(value); updateSettings({ autoPauseOnBuffering: value }); }} />
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-[#0A0A0A] border rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-4 mb-6"><div className="p-2.5 bg-emerald-50 rounded-lg"><Shield className="text-emerald-600" size={24} /></div><div><h2 className="text-lg font-bold">Privacy & Access</h2></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
              <button type="button" disabled={!isHost} onClick={() => setIsPrivate(false)} className={`p-4 rounded-lg text-left relative ${!isPrivate ? "border-2 border-[#111111]" : "border"}`}><Unlock size={24} /> Public Room {!isPrivate && <CheckCircle2 size={18} className="absolute right-3 top-3" />}</button>
              <button type="button" disabled={!isHost} onClick={() => setIsPrivate(true)} className={`p-4 rounded-lg text-left relative ${isPrivate ? "border-2 border-[#111111]" : "border"}`}><Lock size={24} /> Private Room {isPrivate && <CheckCircle2 size={18} className="absolute right-3 top-3" />}</button>
            </div>
            <div className="mt-8 pt-6 border-t flex items-center justify-end gap-3">
              <button type="button" className="px-5 py-2.5 text-sm font-semibold" onClick={reset}>Discard Changes</button>
              <button type="button" disabled={!isHost} className="px-5 py-2.5 bg-[#111111] dark:bg-white text-white dark:text-black text-sm font-bold rounded-lg disabled:opacity-50" onClick={save}>Save Configuration</button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
