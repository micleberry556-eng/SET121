import { useState, useRef, useEffect } from "react";
import {
  Phone, Video, MoreVertical, Paperclip, Smile, Send,
  Lock, Hash, Users, Sparkles, Mic, ArrowLeft,
} from "lucide-react";
import { Chat, Message } from "@/data/mockData";

interface ChatViewProps {
  chat: Chat;
  onSendMessage: (chatId: string, text: string) => void;
  onBack: () => void;
}

export function ChatView({ chat, onSendMessage, onBack }: ChatViewProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(chat.id, input.trim());
    setInput("");
  };

  return (
    <div className="relative flex h-full flex-1 flex-col bg-background overflow-hidden">
      {/* Decorative background glows */}
      <div className="pointer-events-none absolute top-1/4 right-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 left-1/3 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-border/40 px-4 md:px-6 py-3.5 glass-strong">
        <div className="flex items-center gap-3">
          {/* Back button on mobile */}
          <button
            onClick={onBack}
            className="md:hidden rounded-xl p-2 hover:bg-surface-hover transition-all"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>

          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold ${
            chat.type === "channel"
              ? "bg-gradient-to-br from-accent/30 to-accent/10 text-accent border border-accent/20"
              : chat.type === "group"
              ? "bg-gradient-to-br from-primary/30 to-primary-glow/10 text-primary border border-primary/20"
              : "bg-gradient-to-br from-secondary to-muted text-foreground border border-border"
          }`}>
            {chat.avatar}
          </div>
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
                ) : (
                  "last seen recently"
                )
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
          {chat.type === "dm" && (
            <>
              <button className="hidden sm:flex rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:scale-105 hover:text-primary">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </button>
              <button className="hidden sm:flex rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:scale-105 hover:text-primary">
                <Video className="h-4 w-4 text-muted-foreground" />
              </button>
            </>
          )}
          <button className="rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:scale-105">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
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

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 md:px-6 py-6 scrollbar-thin">
        <div className="mx-auto max-w-3xl space-y-4">
          {chat.messages.map((msg, i) => (
            <MessageBubble key={msg.id} message={msg} index={i} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="relative z-10 border-t border-border/40 px-4 md:px-6 py-3 md:py-4 glass-strong">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <button className="hidden sm:flex rounded-2xl p-3 hover:bg-surface-hover transition-all hover:scale-105 hover:text-primary">
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
              input.trim()
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
        <p className={`text-sm whitespace-pre-line leading-relaxed ${isOwn ? "text-white" : "text-foreground"}`}>
          {message.text}
        </p>
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
