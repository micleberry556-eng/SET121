import { useState, useRef, useEffect } from "react";
import {
  X, ArrowLeft, Camera, Shield, Bell, BellOff, Star, Ban, Trash2,
  ChevronRight, Check, Lock, Paintbrush, UserX, Eye, EyeOff,
  Phone, MessageSquare, Forward,
} from "lucide-react";
import { Chat, ChatFolder } from "@/data/mockData";

interface DmSettingsDialogProps {
  open: boolean;
  chat: Chat;
  folders: ChatFolder[];
  onClose: () => void;
  onUpdateChat: (updated: Chat) => void;
  onDeleteChat: (chatId: string) => void;
  onFoldersChange: (folders: ChatFolder[]) => void;
  onBlockUser: (chatId: string) => void;
}

type Page = "main" | "background" | "privacy" | "favorites";

const BG_PRESETS = [
  { id: "default", label: "Default", value: "" },
  { id: "dark", label: "Dark", value: "linear-gradient(135deg, #0a0a12, #1a1a2e)" },
  { id: "ocean", label: "Ocean", value: "linear-gradient(135deg, #0c1445, #1a3a5c)" },
  { id: "forest", label: "Forest", value: "linear-gradient(135deg, #0a1f0a, #1a3a1a)" },
  { id: "sunset", label: "Sunset", value: "linear-gradient(135deg, #2d1b3d, #4a2040)" },
  { id: "midnight", label: "Midnight", value: "linear-gradient(135deg, #0d0d2b, #1a1a4e)" },
  { id: "warm", label: "Warm", value: "linear-gradient(135deg, #2b1810, #3d2518)" },
  { id: "arctic", label: "Arctic", value: "linear-gradient(135deg, #0e1a2b, #1a2d4a)" },
];

export function DmSettingsDialog({ open, chat, folders, onClose, onUpdateChat, onDeleteChat, onFoldersChange, onBlockUser }: DmSettingsDialogProps) {
  const [page, setPage] = useState<Page>("main");
  const [muted, setMuted] = useState(false);
  const [selectedBg, setSelectedBg] = useState(chat.description || "");
  const [blocked, setBlocked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Privacy states
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [allowCalls, setAllowCalls] = useState(true);
  const [allowForward, setAllowForward] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);

  useEffect(() => {
    if (open) {
      setPage("main");
      setSelectedBg(chat.description || "");
    }
  }, [open, chat]);

  if (!open) return null;

  const isInAnyFolder = folders.some((f) => f.chatIds.includes(chat.id));

  const toggleFolderForChat = (folderId: string) => {
    onFoldersChange(folders.map((f) => {
      if (f.id !== folderId) return f;
      const has = f.chatIds.includes(chat.id);
      return { ...f, chatIds: has ? f.chatIds.filter((id) => id !== chat.id) : [...f.chatIds, chat.id] };
    }));
  };

  const handleBgSelect = (bg: string) => {
    setSelectedBg(bg);
    // Store bg in chat.description field for simplicity
    onUpdateChat({ ...chat, description: bg });
  };

  const handleCustomBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setSelectedBg(url);
      onUpdateChat({ ...chat, description: url });
    };
    reader.readAsDataURL(file);
  };

  const handleBlock = () => {
    setBlocked(true);
    onBlockUser(chat.id);
    onClose();
  };

  const goBack = () => {
    if (page !== "main") setPage("main");
    else onClose();
  };

  const contactName = chat.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCustomBg} />

      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-3xl glass-strong border border-border/60 shadow-elegant max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40">
          <button onClick={goBack} className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
            {page === "main" ? <X className="h-4 w-4 text-muted-foreground" /> : <ArrowLeft className="h-4 w-4 text-muted-foreground" />}
          </button>
          <h2 className="text-lg font-serif italic gradient-text flex-1">
            {page === "main" ? "Chat Settings" :
             page === "background" ? "Background" :
             page === "privacy" ? "Privacy" : "Add to Favorites"}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">

          {/* ===== MAIN ===== */}
          {page === "main" && (
            <div className="space-y-5">
              {/* Contact info */}
              <div className="flex flex-col items-center gap-3">
                {chat.avatarUrl ? (
                  <img src={chat.avatarUrl} alt="" className="h-20 w-20 rounded-3xl object-cover border-2 border-primary/30 shadow-glow" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-secondary to-muted text-xl font-bold text-foreground border-2 border-border shadow-glow">
                    {chat.avatar}
                  </div>
                )}
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">{contactName}</p>
                  <p className="text-xs text-muted-foreground">{chat.online ? "online" : "last seen recently"}</p>
                </div>
              </div>

              {/* Menu */}
              <div className="space-y-1">
                <MenuItem icon={<Star className={`h-4 w-4 ${isInAnyFolder ? "text-primary" : ""}`} />} label={isInAnyFolder ? "In Favorites" : "Add to Favorites"} sub="Save to a folder" onClick={() => setPage("favorites")} />
                <MenuItem icon={<Paintbrush className="h-4 w-4" />} label="Chat Background" sub="Custom wallpaper" onClick={() => setPage("background")} />
                <MenuItem icon={<Shield className="h-4 w-4" />} label="Privacy" sub="Calls, last seen, read receipts" onClick={() => setPage("privacy")} />
                <MenuItem icon={muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />} label={muted ? "Unmute" : "Mute Notifications"} onClick={() => setMuted((m) => !m)} />
              </div>

              {/* Danger */}
              <div className="pt-3 border-t border-border/40 space-y-1">
                <MenuItem icon={<Ban className="h-4 w-4 text-destructive" />} label="Block User" labelClass="text-destructive" sub="Stop all messages and calls" onClick={handleBlock} />
                <MenuItem icon={<Trash2 className="h-4 w-4 text-destructive" />} label="Delete Chat" labelClass="text-destructive" onClick={() => { onDeleteChat(chat.id); onClose(); }} />
              </div>
            </div>
          )}

          {/* ===== BACKGROUND ===== */}
          {page === "background" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Choose a background for this conversation:</p>

              <div className="grid grid-cols-2 gap-2">
                {BG_PRESETS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => handleBgSelect(bg.value)}
                    className={`relative h-24 rounded-2xl border-2 transition-all overflow-hidden ${
                      selectedBg === bg.value ? "border-primary shadow-glow" : "border-border/40 hover:border-primary/40"
                    }`}
                    style={{ background: bg.value || "hsl(var(--background))" }}
                  >
                    <span className="absolute bottom-1.5 left-2 text-[10px] font-medium text-white/80 drop-shadow">{bg.label}</span>
                    {selectedBg === bg.value && (
                      <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full gradient-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom image */}
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-all"
              >
                <Camera className="h-4 w-4" /> Upload Custom Image
              </button>

              {/* Preview */}
              {selectedBg && selectedBg.startsWith("data:") && (
                <div className="rounded-2xl overflow-hidden border border-border/40 h-24">
                  <img src={selectedBg} alt="Custom bg" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          )}

          {/* ===== PRIVACY ===== */}
          {page === "privacy" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Privacy settings for {contactName}:</p>

              <ToggleRow icon={<Eye className="h-4 w-4" />} label="Show Last Seen" sub={`Let ${contactName.split(" ")[0]} see when you were online`} checked={showLastSeen} onChange={setShowLastSeen} />
              <ToggleRow icon={<Phone className="h-4 w-4" />} label="Allow Calls" sub={`Let ${contactName.split(" ")[0]} call you`} checked={allowCalls} onChange={setAllowCalls} />
              <ToggleRow icon={<Forward className="h-4 w-4" />} label="Allow Forwarding" sub="Allow forwarding your messages" checked={allowForward} onChange={setAllowForward} />
              <ToggleRow icon={<MessageSquare className="h-4 w-4" />} label="Read Receipts" sub="Show when you read messages" checked={readReceipts} onChange={setReadReceipts} />

              <div className="pt-3 border-t border-border/40">
                <button onClick={handleBlock} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-destructive/5 transition-all">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10"><Ban className="h-4 w-4 text-destructive" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">Block {contactName.split(" ")[0]}</p>
                    <p className="text-[11px] text-muted-foreground">No messages, calls, or status updates</p>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                <Lock className="h-4 w-4 text-primary flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground">These settings apply only to this conversation</p>
              </div>
            </div>
          )}

          {/* ===== FAVORITES ===== */}
          {page === "favorites" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Choose folders for this chat:</p>
              {folders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No folders yet. Create one in the Favorites tab.</p>
              ) : (
                folders.map((f) => {
                  const inFolder = f.chatIds.includes(chat.id);
                  return (
                    <button key={f.id} onClick={() => toggleFolderForChat(f.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all ${inFolder ? "bg-primary/10 border border-primary/30 shadow-glow" : "hover:bg-surface-hover border border-transparent"}`}>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${inFolder ? "gradient-primary" : "bg-secondary/80"}`}>
                        <Star className={`h-4 w-4 ${inFolder ? "text-primary-foreground" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground">{f.chatIds.length} items</p>
                      </div>
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full transition-all ${inFolder ? "gradient-primary" : "border border-border/60"}`}>
                        {inFolder && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, sub, labelClass, onClick }: { icon: React.ReactNode; label: string; sub?: string; labelClass?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-hover transition-all">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/80 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${labelClass || "text-foreground"}`}>{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
      {onClick && !labelClass && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

function ToggleRow({ icon, label, sub, checked, onChange }: { icon: React.ReactNode; label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-surface-hover transition-all">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <div className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </div>
    </button>
  );
}
