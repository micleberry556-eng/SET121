import { useState } from "react";
import { Search, Plus, Hash, Users, Pin, Sparkles } from "lucide-react";
import { Chat } from "@/data/mockData";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

interface ChatSidebarProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (id: string) => void;
}

const TypeIcon = ({ type }: { type: Chat["type"] }) => {
  if (type === "channel") return <Hash className="h-3 w-3 text-accent" />;
  if (type === "group") return <Users className="h-3 w-3 text-primary" />;
  return null;
};

export function ChatSidebar({ chats, selectedChatId, onSelectChat }: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "dm" | "group" | "channel">("all");

  const filtered = chats.filter((c) => {
    if (filter !== "all" && c.type !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pinned = filtered.filter((c) => c.pinned);
  const unpinned = filtered.filter((c) => !c.pinned);

  return (
    <div className="relative flex h-full w-full md:w-80 flex-col border-r border-border/40 glass-strong">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-60 w-60 rounded-full bg-primary/20 blur-3xl" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-serif italic text-lg gradient-text font-semibold">Meshlink</span>
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">decentralized</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeSwitcher />
          <button className="rounded-lg p-2 gradient-primary shadow-glow transition-all hover:scale-105">
            <Plus className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative px-4 py-3">
        <div className="group flex items-center gap-2.5 rounded-2xl glass border border-border/50 px-4 py-2.5 transition-all focus-within:border-primary/50 focus-within:shadow-glow">
          <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search the mesh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">&#x2318;K</kbd>
        </div>
      </div>

      {/* Filters */}
      <div className="relative flex gap-1.5 px-4 pb-3">
        {(["all", "dm", "group", "channel"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`relative rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
              filter === f
                ? "gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            {f === "dm" ? "Direct" : f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
          </button>
        ))}
      </div>

      {/* Chat list */}
      <div className="relative flex-1 overflow-y-auto scrollbar-thin">
        {pinned.length > 0 && (
          <div className="px-3 py-1">
            <div className="flex items-center gap-1.5 px-2 py-2">
              <Pin className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] gradient-text">Pinned</span>
              <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
            </div>
            {pinned.map((chat, i) => (
              <ChatItem key={chat.id} chat={chat} selected={chat.id === selectedChatId} onSelect={onSelectChat} index={i} />
            ))}
          </div>
        )}

        <div className="px-3 py-1">
          {pinned.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-2 mt-2">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-muted-foreground">Recent</span>
              <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
            </div>
          )}
          {unpinned.map((chat, i) => (
            <ChatItem key={chat.id} chat={chat} selected={chat.id === selectedChatId} onSelect={onSelectChat} index={i} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="relative border-t border-border/40 px-4 py-3 glass">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl gradient-primary text-xs font-bold text-primary-foreground shadow-glow">
              ME
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-online shadow-lg shadow-online/50" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">Anonymous</p>
            <p className="text-[10px] font-mono text-muted-foreground truncate">peer:7f3a...e9b1</p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-mono text-online">● ONLINE</span>
            <span className="text-[9px] font-mono text-muted-foreground">3 relays</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatItem({ chat, selected, onSelect, index }: { chat: Chat; selected: boolean; onSelect: (id: string) => void; index: number }) {
  return (
    <button
      onClick={() => onSelect(chat.id)}
      style={{ animationDelay: `${index * 30}ms` }}
      className={`group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all animate-fade-in-up ${
        selected
          ? "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 shadow-glow"
          : "hover:bg-surface-hover border border-transparent"
      }`}
    >
      {selected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full gradient-primary" />
      )}

      <div className="relative flex-shrink-0">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-bold transition-transform group-hover:scale-105 ${
          chat.type === "channel"
            ? "bg-gradient-to-br from-accent/30 to-accent/10 text-accent border border-accent/20"
            : chat.type === "group"
            ? "bg-gradient-to-br from-primary/30 to-primary-glow/10 text-primary border border-primary/20"
            : "bg-gradient-to-br from-secondary to-muted text-foreground border border-border"
        }`}>
          {chat.avatar}
        </div>
        {chat.online && (
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-online shadow-lg shadow-online/40" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <TypeIcon type={chat.type} />
            <span className="text-sm font-semibold text-foreground truncate">{chat.name}</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">{chat.lastMessageTime}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-muted-foreground truncate pr-2">{chat.lastMessage}</p>
          {chat.unread > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full gradient-primary px-1.5 text-[10px] font-bold text-primary-foreground flex-shrink-0 shadow-glow">
              {chat.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
