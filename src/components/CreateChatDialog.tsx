import { useState, useRef, useEffect } from "react";
import { X, Hash, Users, Image, Camera, Search, Check, UserPlus, Loader2 } from "lucide-react";
import { Chat } from "@/data/mockData";

interface SearchUser {
  userId: string;
  displayName: string;
}

interface CreateChatDialogProps {
  open: boolean;
  type: "group" | "channel";
  onClose: () => void;
  onCreate: (chat: Chat) => void;
  onSearchUsers?: (term: string) => Promise<SearchUser[]>;
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no ctx")); return; }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
}

export function CreateChatDialog({ open, type, onClose, onCreate, onSearchUsers }: CreateChatDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<SearchUser[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Debounced member search
  useEffect(() => {
    if (!memberSearch.trim() || !onSearchUsers) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await onSearchUsers(memberSearch.trim());
        const selectedIds = new Set(selectedMembers.map((m) => m.userId));
        setSearchResults(results.filter((r) => !selectedIds.has(r.userId)));
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [memberSearch, onSearchUsers, selectedMembers]);

  if (!open) return null;

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const url = await resizeImage(file);
      setAvatarUrl(url);
    } catch { /* ignore */ }
  };

  const addMember = (user: SearchUser) => {
    setSelectedMembers((prev) => [...prev, user]);
    setMemberSearch("");
    setSearchResults([]);
  };

  const removeMember = (userId: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const handleCreate = () => {
    if (!name.trim()) return;

    const initials = getInitials(name.trim());

    const newChat: Chat = {
      id: `chat-${Date.now()}`,
      name: type === "channel" ? `# ${name.trim()}` : name.trim(),
      avatar: initials,
      avatarUrl,
      type,
      lastMessage: description.trim() || "Chat created",
      lastMessageTime: "now",
      unread: 0,
      members: 1 + selectedMembers.length,
      memberIds: ["me", ...selectedMembers.map((m) => m.userId)],
      topics: type === "group" ? [{ id: "general", name: "General", icon: "#", messageCount: 0, lastMessage: "Topic created", lastMessageTime: "now" }] : undefined,
      messages: [
        {
          id: `msg-${Date.now()}`,
          senderId: "system",
          text: description.trim()
            ? `${type === "channel" ? "Channel" : "Group"} created\n\n${description.trim()}`
            : `${type === "channel" ? "Channel" : "Group"} "${name.trim()}" created. Start sharing!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          read: true,
        },
      ],
    };

    onCreate(newChat);
    setName("");
    setDescription("");
    setAvatarUrl(null);
    setSelectedMembers([]);
    setMemberSearch("");
    onClose();
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setAvatarUrl(null);
    setSelectedMembers([]);
    setMemberSearch("");
    onClose();
  };

  const isChannel = type === "channel";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up" onClick={handleClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-3xl glass-strong border border-border/60 shadow-elegant p-6 max-h-[90vh] overflow-y-auto scrollbar-thin">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-serif italic gradient-text">
            {isChannel ? "New Channel" : "New Group"}
          </h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-20 w-20 rounded-3xl object-cover border-2 border-primary/30 shadow-glow group-hover:opacity-80 transition-opacity" />
              ) : (
                <div className={`flex h-20 w-20 items-center justify-center rounded-3xl text-xl font-bold transition-transform group-hover:scale-105 ${
                  isChannel
                    ? "bg-gradient-to-br from-accent/30 to-accent/10 text-accent border border-accent/20"
                    : "bg-gradient-to-br from-primary/30 to-primary-glow/10 text-primary border border-primary/20"
                }`}>
                  {name.trim() ? getInitials(name.trim()) : isChannel ? <Hash className="h-8 w-8" /> : <Users className="h-8 w-8" />}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/0 group-hover:bg-black/30 transition-colors">
                <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <button onClick={() => fileRef.current?.click()} className="text-[11px] font-medium text-primary hover:underline">
              {avatarUrl ? "Change Photo" : "Add Photo"}
            </button>
            {avatarUrl && (
              <button onClick={() => setAvatarUrl(null)} className="text-[11px] font-medium text-destructive hover:underline">Remove</button>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">
              {isChannel ? "Channel name" : "Group name"}
            </label>
            <input type="text" placeholder={isChannel ? "e.g. announcements" : "e.g. Project Alpha"} value={name} onChange={(e) => setName(e.target.value)} autoFocus
              className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:shadow-glow transition-all bg-transparent" />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Description (optional)</label>
            <textarea placeholder="What is this about?" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:shadow-glow transition-all bg-transparent resize-none" />
          </div>

          {/* Add Members (for groups) */}
          {type === "group" && onSearchUsers && (
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Add Members</label>

              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedMembers.map((m) => (
                    <button key={m.userId} onClick={() => removeMember(m.userId)}
                      className="flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/25 transition-colors">
                      {m.displayName.split(" ")[0]}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2.5 rounded-2xl glass border border-border/50 px-4 py-2.5 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search users to invite..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                {searching && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto scrollbar-thin space-y-0.5 rounded-xl glass border border-border/50 p-2">
                  {searchResults.map((user) => (
                    <button key={user.userId} onClick={() => addMember(user)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-hover transition-all">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary-glow/5 text-[10px] font-bold text-primary border border-primary/20">
                        {getInitials(user.displayName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{user.displayName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{user.userId}</p>
                      </div>
                      <UserPlus className="h-3.5 w-3.5 text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
            <Image className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              {type === "group"
                ? selectedMembers.length > 0
                  ? `${selectedMembers.length} member${selectedMembers.length > 1 ? "s" : ""} will be invited`
                  : "You can add members now or invite them later"
                : "Members can share photos, videos, and files"}
            </p>
          </div>

          {/* Create button */}
          <button onClick={handleCreate} disabled={!name.trim()}
            className={`w-full rounded-2xl py-3 text-sm font-semibold transition-all ${
              name.trim() ? "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]" : "bg-secondary text-muted-foreground cursor-not-allowed"
            }`}>
            Create {isChannel ? "Channel" : "Group"}
          </button>
        </div>
      </div>
    </div>
  );
}
