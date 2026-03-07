"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useRoom } from "@/lib/room-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings2, Users, Search, MoreVertical, Ban } from "lucide-react";

export function PeerPermissionsDialog({ children }: { children: React.ReactNode }) {
  const { roomState, currentUser, kick, updatePermissions, updateRole } = useRoom();
  const users = roomState?.users || [];
  const isHost = Boolean(currentUser?.isHost);
  const [open, setOpen] = useState(false);

  const perms = useMemo(
    () => roomState?.permissions ?? { viewersCanChat: true, viewersCanControl: false },
    [roomState?.permissions],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl bg-[#FFFFFF] dark:bg-[#0A0A0A] border-[#E5E7EB] dark:border-[#1F1F23] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 py-5 border-b border-[#E5E7EB] dark:border-[#1F1F23] bg-gray-50/50 dark:bg-[#111111]/50 text-left">
          <DialogTitle className="text-lg font-bold">Peer Permissions</DialogTitle>
          <DialogDescription className="text-xs mt-1">Manage access control and participant capabilities for this session.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 border-b border-[#E5E7EB] dark:border-[#1F1F23]">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2"><Settings2 size={16} />Global Permissions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex flex-col"><span className="text-sm font-medium">Allow Chat</span><span className="text-[10px]">Participants can send messages</span></div>
                <Switch checked={perms.viewersCanChat} disabled={!isHost} onCheckedChange={(value) => updatePermissions({ ...perms, viewersCanChat: value })} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex flex-col"><span className="text-sm font-medium">Playback Control</span><span className="text-[10px]">Viewers can pause/seek</span></div>
                <Switch checked={perms.viewersCanControl} disabled={!isHost} onCheckedChange={(value) => updatePermissions({ ...perms, viewersCanControl: value })} />
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Users size={16} />Participants</h3>
              <div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-2"><Search size={16} className="text-gray-400" /></span><input type="text" placeholder="Search user..." className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 border rounded-md w-48" /></div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/50 text-[10px] uppercase font-bold tracking-widest border-b"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3 w-32">Role</th><th className="px-4 py-3 text-right w-24">Actions</th></tr></thead>
                <tbody className="divide-y bg-white dark:bg-[#0A0A0A]">
                  {users.map((user) => {
                    const isMe = user.id === currentUser?.id;
                    return (
                      <tr key={user.id} className="group hover:bg-gray-50 dark:hover:bg-[#111111]">
                        <td className="px-4 py-3">{user.displayName}</td>
                        <td className="px-4 py-3">
                          <Select value={user.isHost ? "host" : "viewer"} disabled={!isHost || isMe} onValueChange={(value) => updateRole(user.id, value === "host")}>
                            <SelectTrigger className="h-7 text-xs border-0 bg-transparent ring-1 ring-inset ring-gray-200"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="viewer">Viewer</SelectItem><SelectItem value="host">Host</SelectItem></SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button disabled={!isHost || user.isHost || isMe} onClick={() => kick(user.id)} className="transition-colors rounded p-1 flex justify-end w-full disabled:opacity-50">
                            {user.isHost ? <MoreVertical size={18} /> : <Ban size={18} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50/50 flex justify-end gap-3">
          <button className="px-4 py-2 text-xs font-semibold" onClick={() => setOpen(false)}>Cancel</button>
          <button className="px-4 py-2 text-xs font-semibold text-white bg-[#111111] dark:bg-white dark:text-black rounded" onClick={() => setOpen(false)}>Save Changes</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
