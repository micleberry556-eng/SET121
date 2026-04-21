import { useState, useRef, useEffect } from "react";
import {
  X, ArrowLeft, Camera, Users, UserPlus, UserMinus, Shield, Hash,
  Bell, BellOff, Lock, Trash2, LogOut, ChevronRight, Search, Check, Plus, Star,
} from "lucide-react";
import { Chat, Contact, Topic, ChatFolder } from "@/data/mockData";

interface GroupSettingsDialogProps {
  open: boolean;
  chat: Chat;
  contacts: Contact[];
  folders: ChatFolder[];
  onClose: () => void;
  onUpdateChat: (updated: Chat) => void;
  onDeleteChat: (chatId: string) => void;
  onFoldersChange: (folders: ChatFolder[]) => void;
}

type Page = "main" | "members" | "addMembers" | "privacy" | "topics" | "favorites";

function resizeImg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        const s = Math.min(img.width, img.height);
        c.width = 256; c.height = 256;
        const ctx = c.getContext("2d");
        if (!ctx) { reject("no ctx"); return; }
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function GroupSettingsDialog({ open, chat, contacts, folders, onClose, onUpdateChat, onDeleteChat, onFoldersChange }: GroupSettingsDialogProps) {
  const [page, setPage] = useState<Page>("main");
  const [draft, setDraft] = useState<Chat>({ ...chat });
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedAdd, setSelectedAdd] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft({ ...chat });
      setPage("main");
      setMemberSearch("");
      setSelectedAdd(new Set());
    }
  }, [open, chat]);

  if (!open) return null;

  const isChannel = chat.type === "channel";
  const memberList = (draft.memberIds || []).map((id) =>
    id === "me" ? { id: "me", name: "You", avatar: "ME", online: true, peerId: "" } : contacts.find((c) => c.id === id),
  ).filter(Boolean);

  const availableToAdd = contacts.filter((c) => !(draft.memberIds || []).includes(c.id));
  const filteredAdd = availableToAdd.filter((c) => !memberSearch || c.name.toLowerCase().includes(memberSearch.toLowerCase()));

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const url = await resizeImg(file);
      setDraft((d) => ({ ...d, avatarUrl: url }));
    } catch { /* */ }
  };

  const handleSave = () => {
    const initials = draft.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
    onUpdateChat({ ...draft, avatar: initials, members: (draft.memberIds || []).length });
    onClose();
  };

  const removeMember = (id: string) => {
    if (id === "me") return;
    setDraft((d) => ({ ...d, memberIds: (d.memberIds || []).filter((m) => m !== id) }));
  };

  const addMembers = () => {
    const ids = Array.from(selectedAdd);
    setDraft((d) => ({ ...d, memberIds: [...(d.memberIds || []), ...ids] }));
    setSelectedAdd(new Set());
    setPage("members");
  };

  const addTopic = (name: string, icon: string) => {
    const t: Topic = { id: `topic-${Date.now()}`, name, icon, messageCount: 0, lastMessage: "Created", lastMessageTime: "now" };
    setDraft((d) => ({ ...d, topics: [...(d.topics || []), t] }));
  };

  const deleteTopic = (id: string) => {
    setDraft((d) => ({ ...d, topics: (d.topics || []).filter((t) => t.id !== id) }));
  };

  const goBack = () => {
    if (page !== "main") setPage("main");
    else onClose();
  };

  const isInAnyFolder = folders.some((f) => f.chatIds.includes(chat.id));

  const toggleFolderForChat = (folderId: string) => {
    onFoldersChange(folders.map((f) => {
      if (f.id !== folderId) return f;
      const has = f.chatIds.includes(chat.id);
      return { ...f, chatIds: has ? f.chatIds.filter((id) => id !== chat.id) : [...f.chatIds, chat.id] };
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up" onClick={onClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-3xl glass-strong border border-border/60 shadow-elegant max-h-[90vh] flex flex-col overflow-hidden">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40">
          <button onClick={goBack} className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
            {page === "main" ? <X className="h-4 w-4 text-muted-foreground" /> : <ArrowLeft className="h-4 w-4 text-muted-foreground" />}
          </button>
          <h2 className="text-lg font-serif italic gradient-text flex-1">
            {page === "main" ? (isChannel ? "Channel Settings" : "Group Settings") :
             page === "members" ? "Members" :
             page === "addMembers" ? "Add Members" :
             page === "privacy" ? "Privacy" :
             page === "favorites" ? "Add to Favorites" : "Topics"}
          </h2>
          {page === "main" && (
            <button onClick={handleSave} className="text-xs font-semibold text-primary hover:underline">Save</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">

          {/* ===== MAIN ===== */}
          {page === "main" && (
            <div className="space-y-5">
              {/* Avatar + Name */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                  {draft.avatarUrl ? (
                    <img src={draft.avatarUrl} alt="" className="h-20 w-20 rounded-3xl object-cover border-2 border-primary/30 shadow-glow group-hover:opacity-80 transition-opacity" />
                  ) : (
                    <div className={`flex h-20 w-20 items-center justify-center rounded-3xl text-xl font-bold shadow-glow group-hover:opacity-80 transition-opacity ${
                      isChannel ? "bg-gradient-to-br from-accent/30 to-accent/10 text-accent border border-accent/20" : "bg-gradient-to-br from-primary/30 to-primary-glow/10 text-primary border border-primary/20"
                    }`}>
                      {draft.avatar}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/0 group-hover:bg-black/30 transition-colors">
                    <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <button onClick={() => fileRef.current?.click()} className="text-[11px] font-medium text-primary hover:underline">Change Photo</button>
              </div>

              {/* Name */}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Name</label>
                <input type="text" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:shadow-glow transition-all bg-transparent" />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Description</label>
                <textarea value={draft.description || ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={2}
                  className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:shadow-glow transition-all bg-transparent resize-none" />
              </div>

              {/* Menu */}
              <div className="space-y-1">
                <MenuItem icon={<Star className={`h-4 w-4 ${isInAnyFolder ? "text-primary" : ""}`} />} label={isInAnyFolder ? "In Favorites" : "Add to Favorites"} sub="Save to a folder" onClick={() => setPage("favorites")} />
                <MenuItem icon={<Users className="h-4 w-4" />} label="Members" sub={`${(draft.memberIds || []).length} members`} onClick={() => setPage("members")} />
                {!isChannel && <MenuItem icon={<Hash className="h-4 w-4" />} label="Topics" sub={`${(draft.topics || []).length} topics`} onClick={() => setPage("topics")} />}
                <MenuItem icon={<Shield className="h-4 w-4" />} label="Privacy" sub="Permissions & access" onClick={() => setPage("privacy")} />
                <MenuItem icon={muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />} label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)} />
              </div>

              {/* Danger */}
              <div className="pt-3 border-t border-border/40 space-y-1">
                <MenuItem icon={<LogOut className="h-4 w-4 text-destructive" />} label={isChannel ? "Leave Channel" : "Leave Group"} labelClass="text-destructive" onClick={onClose} />
                <MenuItem icon={<Trash2 className="h-4 w-4 text-destructive" />} label={isChannel ? "Delete Channel" : "Delete Group"} labelClass="text-destructive" onClick={() => { onDeleteChat(chat.id); onClose(); }} />
              </div>
            </div>
          )}

          {/* ===== MEMBERS ===== */}
          {page === "members" && (
            <div className="space-y-3">
              <button onClick={() => setPage("addMembers")} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/40 px-3 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-all">
                <UserPlus className="h-4 w-4" /> Add Members
              </button>
              {memberList.map((m) => m && (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-muted text-xs font-bold text-foreground border border-border">{m.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.name}{m.id === "me" ? " (you)" : ""}</p>
                    {m.online && <span className="text-[10px] text-online">online</span>}
                  </div>
                  {m.id !== "me" && (
                    <button onClick={() => removeMember(m.id)} className="rounded-lg p-1.5 hover:bg-destructive/10 transition-colors" title="Remove">
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ===== ADD MEMBERS ===== */}
          {page === "addMembers" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 rounded-2xl glass border border-border/50 px-4 py-2.5 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search contacts..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} autoFocus
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
              </div>
              {filteredAdd.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No contacts to add</p>
              ) : (
                filteredAdd.map((c) => {
                  const sel = selectedAdd.has(c.id);
                  return (
                    <button key={c.id} onClick={() => setSelectedAdd((prev) => { const n = new Set(prev); sel ? n.delete(c.id) : n.add(c.id); return n; })}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all ${sel ? "bg-primary/10 border border-primary/30" : "hover:bg-surface-hover border border-transparent"}`}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-muted text-xs font-bold text-foreground border border-border">{c.avatar}</div>
                      <div className="flex-1"><p className="text-sm font-medium text-foreground">{c.name}</p></div>
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full transition-all ${sel ? "gradient-primary" : "border border-border/60"}`}>
                        {sel && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })
              )}
              {selectedAdd.size > 0 && (
                <button onClick={addMembers} className="w-full rounded-2xl py-3 text-sm font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all">
                  Add {selectedAdd.size} member{selectedAdd.size > 1 ? "s" : ""}
                </button>
              )}
            </div>
          )}

          {/* ===== PRIVACY ===== */}
          {page === "privacy" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Control who can access this {isChannel ? "channel" : "group"}.</p>
              <PrivacyRow label="Who can send messages" value={isChannel ? "Admins only" : "All members"} />
              <PrivacyRow label="Who can add members" value="All members" />
              <PrivacyRow label="Who can edit info" value="Admins only" />
              <PrivacyRow label="Who can pin messages" value="Admins only" />
              <PrivacyRow label="Content visibility" value="Members only" />
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10 mt-4">
                <Lock className="h-4 w-4 text-primary flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground">All messages are end-to-end encrypted</p>
              </div>
            </div>
          )}

          {/* ===== TOPICS ===== */}
          {page === "topics" && (
            <TopicsPage topics={draft.topics || []} onAdd={addTopic} onDelete={deleteTopic} />
          )}

          {/* ===== FAVORITES ===== */}
          {page === "favorites" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Choose which folders to add this {isChannel ? "channel" : "group"} to:</p>
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

function PrivacyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl px-3 py-3 hover:bg-surface-hover transition-all">
      <p className="text-sm text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{value}</p>
    </div>
  );
}

const ICONS = ["#", "📢", "💡", "🔧", "🎨", "📊", "🚀", "❓", "📝", "🔒"];

function TopicsPage({ topics, onAdd, onDelete }: { topics: Topic[]; onAdd: (name: string, icon: string) => void; onDelete: (id: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("#");

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), icon);
    setName(""); setIcon("#"); setAdding(false);
  };

  return (
    <div className="space-y-3">
      {topics.map((t) => (
        <div key={t.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-surface-hover transition-all">
          <span className="text-lg">{t.icon}</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{t.name}</p>
            <p className="text-[10px] text-muted-foreground">{t.messageCount} messages</p>
          </div>
          <button onClick={() => onDelete(t.id)} className="rounded-lg p-1.5 hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="space-y-3 rounded-2xl glass border border-border/50 p-4">
          <div className="flex flex-wrap gap-2">
            {ICONS.map((ic) => (
              <button key={ic} onClick={() => setIcon(ic)} className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all ${icon === ic ? "gradient-primary text-primary-foreground" : "bg-secondary/60 hover:bg-surface-hover"}`}>{ic}</button>
            ))}
          </div>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Topic name" autoFocus onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full rounded-xl glass border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 bg-transparent" />
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 rounded-xl py-2 text-xs font-medium text-muted-foreground hover:bg-surface-hover border border-border/50">Cancel</button>
            <button onClick={handleAdd} disabled={!name.trim()} className={`flex-1 rounded-xl py-2 text-xs font-semibold ${name.trim() ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>Create</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-primary/40 px-3 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-all">
          <Plus className="h-4 w-4" /> New Topic
        </button>
      )}
    </div>
  );
}
