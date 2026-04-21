import { useState, useRef, useEffect } from "react";
import {
  Phone, Video, MoreVertical, Paperclip, Smile, Send,
  Lock, Hash, Users, Sparkles, Mic, ArrowLeft,
  Image, Film, Music, X, Download,
} from "lucide-react";
import { Chat, Message, MediaAttachment, Topic } from "@/data/mockData";
import { TopicsBar } from "@/components/TopicsBar";

interface ChatViewProps {
  chat: Chat;
  onSendMessage: (chatId: string, text: string, media?: MediaAttachment[], topicId?: string | null) => void;
  onBack: () => void;
  onCall?: (type: "audio" | "video") => void;
  onCreateTopic?: (chatId: string, name: string, icon: string) => void;
  onDeleteTopic?: (chatId: string, topicId: string) => void;
  onSettingsClick?: () => void;
  onDmSettingsClick?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function downloadMedia(attachment: MediaAttachment) {
  const a = document.createElement("a");
  a.href = attachment.url;
  a.download = attachment.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function ChatView({ chat, onSendMessage, onBack, onCall, onCreateTopic, onDeleteTopic, onSettingsClick, onDmSettingsClick }: ChatViewProps) {
  const [input, setInput] = useState("");
  const [pendingMedia, setPendingMedia] = useState<MediaAttachment[]>([]);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const handleSend = () => {
    if (!input.trim() && pendingMedia.length === 0) return;
    onSendMessage(chat.id, input.trim(), pendingMedia.length > 0 ? pendingMedia : undefined, activeTopic);
    setInput("");
    setPendingMedia([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      let type: MediaAttachment["type"] = "image";
      if (file.type.startsWith("video/")) type = "video";
      else if (file.type.startsWith("audio/")) type = "audio";

      const url = URL.createObjectURL(file);
      setPendingMedia((prev) => [
        ...prev,
        {
          id: `media-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type,
          name: file.name,
          url,
          size: file.size,
          mimeType: file.type,
        },
      ]);
    });

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const removePendingMedia = (id: string) => {
    setPendingMedia((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((m) => m.id !== id);
    });
  };

  return (
    <div className="relative flex h-full flex-1 flex-col bg-background overflow-hidden">
      {/* Background glows */}
      <div className="pointer-events-none absolute top-1/4 right-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 left-1/3 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-border/40 px-4 md:px-6 py-3.5 glass-strong">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden rounded-xl p-2 hover:bg-surface-hover transition-all">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          {chat.avatarUrl ? (
            <img src={chat.avatarUrl} alt="" className="h-10 w-10 rounded-2xl object-cover border border-border/40" />
          ) : (
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold ${
              chat.type === "channel"
                ? "bg-gradient-to-br from-accent/30 to-accent/10 text-accent border border-accent/20"
                : chat.type === "group"
                ? "bg-gradient-to-br from-primary/30 to-primary-glow/10 text-primary border border-primary/20"
                : "bg-gradient-to-br from-secondary to-muted text-foreground border border-border"
            }`}>
              {chat.avatar}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              {chat.type === "channel" && <Hash className="h-3.5 w-3.5 text-accent" />}
              {chat.type === "group" && <Users className="h-3.5 w-3.5 text-primary" />}
              <h2 className="text-base font-semibold text-foreground tracking-tight">{chat.name}</h2>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              {chat.type === "dm" ? (
                chat.online ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-online animate-pulse" />
                    <span>online - encrypted</span>
                  </>
                ) : "last seen recently"
              ) : (
                <>
                  <Users className="h-3 w-3" />
                  <span>{chat.members} members - {Math.floor((chat.members ?? 0) * 0.6)} online</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(chat.type === "dm" || chat.type === "group") && onCall && (
            <>
              <button
                onClick={() => onCall("audio")}
                className="rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:scale-105 hover:text-primary"
                title="Audio call"
              >
                <Phone className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => onCall("video")}
                className="rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:scale-105 hover:text-primary"
                title="Video call"
              >
                <Video className="h-4 w-4 text-muted-foreground" />
              </button>
            </>
          )}
          {(chat.type === "group" || chat.type === "channel") && onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:scale-105"
              title="Settings"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          {chat.type === "dm" && (
            <button
              onClick={onDmSettingsClick}
              className="rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:scale-105"
              title="Chat settings"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* E2EE banner */}
      <div className="relative z-10 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 border-b border-border/30">
        <Lock className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] gradient-text font-semibold">
          end-to-end encrypted - X3DH + Double Ratchet
        </span>
        <Sparkles className="h-3 w-3 text-accent" />
      </div>

      {/* Topics bar for groups */}
      {chat.type === "group" && chat.topics && chat.topics.length > 0 && (
        <TopicsBar
          topics={chat.topics}
          activeTopic={activeTopic}
          onSelectTopic={setActiveTopic}
          onCreateTopic={(name, icon) => onCreateTopic?.(chat.id, name, icon)}
          onDeleteTopic={(topicId) => onDeleteTopic?.(chat.id, topicId)}
        />
      )}

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 md:px-6 py-6 scrollbar-thin">
        <div className="mx-auto max-w-3xl space-y-4">
          {(() => {
            const hasTopics = chat.type === "group" && chat.topics && chat.topics.length > 0;
            const filtered = hasTopics && activeTopic !== null
              ? chat.messages.filter((m) => m.topicId === activeTopic || m.senderId === "system")
              : chat.messages;
            return filtered.length > 0 ? (
              filtered.map((msg, i) => (
                <MessageBubble key={msg.id} message={msg} index={i} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Hash className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No messages in this topic yet</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Be the first to write something</p>
              </div>
            );
          })()}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pending media preview */}
      {pendingMedia.length > 0 && (
        <div className="relative z-10 border-t border-border/30 px-4 md:px-6 py-3 glass">
          <div className="mx-auto max-w-3xl flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {pendingMedia.map((m) => (
              <div key={m.id} className="relative flex-shrink-0 group">
                {m.type === "image" ? (
                  <img src={m.url} alt={m.name} className="h-16 w-16 rounded-xl object-cover border border-border/40" />
                ) : m.type === "video" ? (
                  <div className="h-16 w-16 rounded-xl bg-secondary border border-border/40 flex items-center justify-center">
                    <Film className="h-6 w-6 text-primary" />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-secondary border border-border/40 flex items-center justify-center">
                    <Music className="h-6 w-6 text-accent" />
                  </div>
                )}
                <button
                  onClick={() => removePendingMedia(m.id)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
                <p className="text-[9px] text-muted-foreground truncate w-16 mt-0.5">{m.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="relative z-10 border-t border-border/40 px-4 md:px-6 py-3 md:py-4 glass-strong">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl p-2.5 md:p-3 hover:bg-surface-hover transition-all hover:scale-105 hover:text-primary"
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="group flex flex-1 items-center gap-2 rounded-2xl glass border border-border/50 px-3 md:px-4 py-2.5 md:py-3 transition-all focus-within:border-primary/50 focus-within:shadow-glow">
            <input
              type="text"
              placeholder="Type a secure message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {/* Quick media buttons */}
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.click();
                  fileInputRef.current.accept = "image/*,video/*,audio/*";
                }
              }}
              className="hidden sm:flex hover:text-primary transition-colors"
              title="Send photo"
            >
              <Image className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="hidden sm:flex hover:text-primary transition-colors">
              <Smile className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="hidden sm:flex hover:text-primary transition-colors">
              <Mic className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <button
            onClick={handleSend}
            className={`rounded-2xl p-2.5 md:p-3 transition-all hover:scale-105 ${
              input.trim() || pendingMedia.length > 0
                ? "gradient-primary text-primary-foreground shadow-glow"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MediaDisplay({ attachment }: { attachment: MediaAttachment }) {
  if (attachment.type === "image") {
    return (
      <div className="relative group mt-2 rounded-xl overflow-hidden">
        <img src={attachment.url} alt={attachment.name} className="max-w-full max-h-64 rounded-xl object-cover" />
        <button
          onClick={() => downloadMedia(attachment)}
          className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Download className="h-4 w-4 text-white" />
        </button>
      </div>
    );
  }

  if (attachment.type === "video") {
    return (
      <div className="mt-2 rounded-xl overflow-hidden">
        <video src={attachment.url} controls className="max-w-full max-h-64 rounded-xl" />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted-foreground font-mono">{attachment.name}</span>
          <button onClick={() => downloadMedia(attachment)} className="hover:text-primary transition-colors">
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  if (attachment.type === "audio") {
    return (
      <div className="mt-2 rounded-xl glass border border-border/40 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Music className="h-4 w-4 text-accent flex-shrink-0" />
          <span className="text-xs text-foreground truncate">{attachment.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{formatFileSize(attachment.size)}</span>
          <button onClick={() => downloadMedia(attachment)} className="ml-auto hover:text-primary transition-colors">
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
        <audio src={attachment.url} controls className="w-full h-8" />
      </div>
    );
  }

  return null;
}

function MessageBubble({ message, index }: { message: Message; index: number }) {
  const isOwn = message.senderId === "me";
  const isSystem = message.senderId === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
        <div className="max-w-[90%] md:max-w-[80%] rounded-2xl glass border border-primary/20 px-4 md:px-5 py-3 md:py-4 shadow-soft">
          <p className="text-xs font-mono text-foreground whitespace-pre-line leading-relaxed">{message.text}</p>
          <p className="mt-2 text-[10px] font-mono text-muted-foreground text-center">{message.timestamp}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-fade-in-up`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-3xl px-4 py-2.5 ${
          isOwn
            ? "rounded-br-md text-primary-foreground shadow-elegant"
            : "rounded-bl-md bg-chat-other border border-border/40"
        }`}
        style={isOwn ? { background: "var(--gradient-bubble-own)" } : undefined}
      >
        {!isOwn && (
          <p className="text-[11px] font-semibold gradient-text-accent mb-1">
            {message.senderId.charAt(0).toUpperCase() + message.senderId.slice(1)}
          </p>
        )}
        {message.text && (
          <p className={`text-sm whitespace-pre-line leading-relaxed ${isOwn ? "text-white" : "text-foreground"}`}>
            {message.text}
          </p>
        )}
        {message.media && message.media.map((m) => (
          <MediaDisplay key={m.id} attachment={m} />
        ))}
        <p className={`mt-1 text-[10px] ${isOwn ? "text-white/70" : "text-muted-foreground"} text-right font-mono`}>
          {message.timestamp}
          {isOwn && (
            <span className="ml-1">{message.read ? "\u2713\u2713" : "\u2713"}</span>
          )}
        </p>
      </div>
    </div>
  );
}
