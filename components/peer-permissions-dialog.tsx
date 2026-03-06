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
import { useRoom } from "@/lib/room-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings2, Users, Search, MoreVertical, Ban } from "lucide-react";

export function PeerPermissionsDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const { roomState, currentUser } = useRoom();
  const users = roomState?.users || [];

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl bg-[#FFFFFF] dark:bg-[#0A0A0A] border-[#E5E7EB] dark:border-[#1F1F23] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 py-5 border-b border-[#E5E7EB] dark:border-[#1F1F23] bg-gray-50/50 dark:bg-[#111111]/50 text-left">
          <DialogTitle className="text-lg font-bold text-[#111827] dark:text-[#EDEDED] tracking-tight">
            Peer Permissions
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">
            Manage access control and participant capabilities for this session.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Global Permissions Section */}
          <div className="px-6 py-6 border-b border-[#E5E7EB] dark:border-[#1F1F23]">
            <h3 className="text-xs font-bold text-[#111827] dark:text-[#EDEDED] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings2 size={16} />
              Global Permissions
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] dark:border-[#1F1F23] bg-gray-50 dark:bg-[#111111]">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#111827] dark:text-[#EDEDED]">
                    Allow Chat
                  </span>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                    Participants can send messages
                  </span>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] dark:border-[#1F1F23] bg-gray-50 dark:bg-[#111111]">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#111827] dark:text-[#EDEDED]">
                    Playback Control
                  </span>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                    Viewers can pause/seek
                  </span>
                </div>
                <Switch />
              </div>
            </div>
          </div>

          {/* Participants Table Section */}
          <div className="px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-[#111827] dark:text-[#EDEDED] uppercase tracking-wider flex items-center gap-2">
                <Users size={16} />
                Participants
                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-800 text-[#6B7280] border border-[#E5E7EB] dark:border-[#1F1F23]">
                  {users.length} Active
                </span>
              </h3>

              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2">
                  <Search size={16} className="text-gray-400" />
                </span>
                <input
                  type="text"
                  placeholder="Search user..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#1F1F23] rounded-md focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-transparent w-48 placeholder-gray-400 dark:placeholder-gray-600 outline-none text-[#111827] dark:text-[#EDEDED]"
                />
              </div>
            </div>

            <div className="border border-[#E5E7EB] dark:border-[#1F1F23] rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/50 dark:bg-[#111111]/50 text-[10px] uppercase text-[#6B7280] dark:text-[#A1A1AA] font-bold tracking-widest border-b border-[#E5E7EB] dark:border-[#1F1F23]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold w-32">Role</th>
                    <th className="px-4 py-3 font-semibold text-right w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#1F1F23] bg-white dark:bg-[#0A0A0A]">
                  {users.map((user) => {
                    const isMe = user.id === currentUser?.id;
                    return (
                      <tr
                        key={user.id}
                        className="group hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full ${user.avatar || "bg-gradient-to-br from-gray-400 to-gray-500"} flex items-center justify-center text-white text-[10px] font-black border border-white/20 shadow-sm`}
                            >
                              {user.displayName.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-[#111827] dark:text-[#EDEDED] text-sm leading-tight">
                                {user.displayName}
                              </span>
                              <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] leading-tight mt-0.5">
                                user_{user.id?.substring(0, 4)}
                              </span>
                            </div>
                            {isMe && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            defaultValue={user.isHost ? "host" : "viewer"}
                            disabled={user.isHost}
                          >
                            <SelectTrigger className="h-7 text-xs border-0 bg-transparent ring-1 ring-inset ring-gray-200 dark:ring-[#1F1F23] focus:ring-1 focus:ring-black dark:focus:ring-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer</SelectItem>
                              <SelectItem value="moderator">
                                Moderator
                              </SelectItem>
                              <SelectItem value="host">Host</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            disabled={user.isHost}
                            className={`transition-colors rounded p-1 flex justify-end w-full ${user.isHost ? "text-gray-300 dark:text-gray-700 cursor-not-allowed" : "text-[#6B7280] dark:text-[#A1A1AA] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10"}`}
                          >
                            {user.isHost ? (
                              <MoreVertical size={18} />
                            ) : (
                              <Ban size={18} />
                            )}
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

        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#1F1F23] bg-gray-50/50 dark:bg-[#111111]/50 flex justify-end gap-3">
          <button className="px-4 py-2 text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111827] dark:hover:text-[#EDEDED] border border-transparent hover:bg-gray-100 dark:hover:bg-[#1C1C1C] rounded transition-colors">
            Cancel
          </button>
          <button className="px-4 py-2 text-xs font-semibold text-white bg-[#111111] dark:bg-white dark:text-black rounded shadow-sm hover:opacity-90 transition-opacity">
            Save Changes
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
