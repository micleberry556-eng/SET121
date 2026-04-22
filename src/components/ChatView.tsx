import { useState, useRef, useEffect, useCallback } from "react";
import {
  Phone, Video, MoreVertical, Paperclip, Smile, Send,
  Lock, Hash, Users, Sparkles, Mic, ArrowLeft,
  Image, Film, Music, X, Download, Reply, Forward, Search,
  Square,
} from "lucide-react";
import { Chat, Message, MediaAttachment, Topic } from "@/data/mockData";
import { TopicsBar } from "@/components/TopicsBar";

interface ChatViewProps {
  chat: Chat;
  onSendMessage: (chatId: string, text: string, media?: MediaAttachment[], topicId?: string | null, replyToId?: string) => void;
  onBack: () => void;
  onCall?: (type: "audio" | "video") => void;
  onReaction?: (chatId: string, messageId: string, emoji: string) => void;
  onForward?: (messageId: string, toRoomId: string) => void;
  forwardTargets?: { id: string; name: string; avatar: string }[];
  onCreateTopic?: (chatId: string, name: string, icon: string) => void;
  onDeleteTopic?: (chatId: string, topicId: string) => void;
  onSettingsClick?: () => void;
  onDmSettingsClick?: () => void;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function downloadMedia(attachment: MediaAttachment) {
  try {
    const resp = await fetch(attachment.url);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl; a.download = attachment.name; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 100);
  } catch {
    const a = document.createElement("a"); a.href = attachment.url; a.download = attachment.name; a.click();
  }
}

export function ChatView({ chat, onSendMessage, onBack, onCall, onReaction, onForward, forwardTargets, onCreateTopic, onDeleteTopic, onSettingsClick, onDmSettingsClick }: ChatViewProps) {
  const [input, setInput] = useState("");
  const [pendingMedia, setPendingMedia] = useState<MediaAttachment[]>([]);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat.messages]);

  const handleSend = () => {
    if (!input.trim() && pendingMedia.length === 0) return;
    onSendMessage(chat.id, input.trim(), pendingMedia.length > 0 ? pendingMedia : undefined, activeTopic, replyTo?.id);
    setInput(""); setPendingMedia([]); setReplyTo(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    Array.from(files).forEach((file) => {
      let type: MediaAttachment["type"] = "image";
      if (file.type.startsWith("video/")) type = "video";
      else if (file.type.startsWith("audio/")) type = "audio";
      setPendingMedia((prev) => [...prev, { id: `media-${Date.now()}-${Math.random().toString(36).slice(2)}`, type, name: file.name, url: URL.createObjectURL(file), size: file.size, mimeType: file.type }]);
    });
    e.target.value = "";
  };

  const removePendingMedia = (id: string) => {
    setPendingMedia((prev) => { const item = prev.find((m) => m.id === id); if (item) URL.revokeObjectURL(item.url); return prev.filter((m) => m.id !== id); });
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setPendingMedia((prev) => [...prev, { id: `voice-${Date.now()}`, type: "audio", name: `voice-${new Date().toISOString().slice(11, 19)}.webm`, url: URL.createObjectURL(blob), size: blob.size, mimeType: "audio/webm" }]);
      };
      recorder.start(); mediaRecorderRef.current = recorder;
      setIsRecording(true); setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch { console.error("Microphone access denied"); }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null; setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current!.ondataavailable = null; mediaRecorderRef.current!.onstop = null;
      mediaRecorderRef.current!.stop(); mediaRecorderRef.current!.stream.getTracks().forEach((t) => t.stop());
    }
    mediaRecorderRef.current = null; audioChunksRef.current = []; setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }, []);

  const fmtRec = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const filteredMessages = searchOpen && searchQuery.trim()
    ? chat.messages.filter((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : chat.messages;

  return (
    <div className="relative flex h-full flex-1 flex-col bg-background overflow-hidden">
      <div className="pointer-events-none absolute top-1/4 right-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 left-1/3 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*,application/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt" className="hidden" onChange={handleFileSelect} />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-border/40 px-4 md:px-6 py-3.5 glass-strong">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden rounded-xl p-2 hover:bg-surface-hover transition-all"><ArrowLeft className="h-5 w-5 text-foreground" /></button>
          {chat.avatarUrl ? <img src={chat.avatarUrl} alt="" className="h-10 w-10 rounded-2xl object-cover border border-border/40" /> : (
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold ${chat.type === "channel" ? "bg-gradient-to-br from-accent/30 to-accent/10 text-accent border border-accent/20" : chat.type === "group" ? "bg-gradient-to-br from-primary/30 to-primary-glow/10 text-primary border border-primary/20" : "bg-gradient-to-br from-secondary to-muted text-foreground border border-border"}`}>{chat.avatar}</div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              {chat.type === "channel" && <Hash className="h-3.5 w-3.5 text-accent" />}
              {chat.type === "group" && <Users className="h-3.5 w-3.5 text-primary" />}
              <h2 className="text-base font-semibold text-foreground tracking-tight">{chat.name}</h2>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              {chat.type === "dm" ? (chat.online ? (<><span className="h-1.5 w-1.5 rounded-full bg-online animate-pulse" /><span>online</span></>) : "last seen recently") : (<><Users className="h-3 w-3" /><span>{chat.members} members</span></>)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setSearchOpen((s) => !s)} className="rounded-xl p-2.5 hover:bg-surface-hover transition-all" title="Search"><Search className="h-4 w-4 text-muted-foreground" /></button>
          {(chat.type === "dm" || chat.type === "group") && onCall && (<>
            <button onClick={() => onCall("audio")} className="rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:text-primary" title="Audio call"><Phone className="h-4 w-4 text-muted-foreground" /></button>
            <button onClick={() => onCall("video")} className="rounded-xl p-2.5 hover:bg-surface-hover transition-all hover:text-primary" title="Video call"><Video className="h-4 w-4 text-muted-foreground" /></button>
          </>)}
          {(chat.type === "group" || chat.type === "channel") && onSettingsClick && <button onClick={onSettingsClick} className="rounded-xl p-2.5 hover:bg-surface-hover transition-all"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>}
          {chat.type === "dm" && <button onClick={onDmSettingsClick} className="rounded-xl p-2.5 hover:bg-surface-hover transition-all"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>}
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="relative z-10 flex items-center gap-2 px-4 md:px-6 py-2 border-b border-border/30 glass">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search in chat..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          <span className="text-[10px] text-muted-foreground">{searchQuery.trim() ? `${filteredMessages.length} found` : ""}</span>
          <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="rounded-lg p-1 hover:bg-surface-hover"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
      )}

      {/* E2EE banner */}
      <div className="relative z-10 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 border-b border-border/30">
        <Lock className="h-3 w-3 text-primary" /><span className="text-[10px] font-mono uppercase tracking-[0.15em] gradient-text font-semibold">end-to-end encrypted</span><Sparkles className="h-3 w-3 text-accent" />
      </div>

      {chat.type === "group" && chat.topics && chat.topics.length > 0 && (
        <TopicsBar topics={chat.topics} activeTopic={activeTopic} onSelectTopic={setActiveTopic} onCreateTopic={(name, icon) => onCreateTopic?.(chat.id, name, icon)} onDeleteTopic={(topicId) => onDeleteTopic?.(chat.id, topicId)} />
      )}

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 md:px-6 py-6 scrollbar-thin">
        <div className="mx-auto max-w-3xl space-y-4">
          {(() => {
            const hasTopics = chat.type === "group" && chat.topics && chat.topics.length > 0;
            const msgs = hasTopics && activeTopic !== null ? filteredMessages.filter((m) => m.topicId === activeTopic || m.senderId === "system") : filteredMessages;
            return msgs.length > 0 ? msgs.map((msg, i) => (
              <MessageBubble key={msg.id} message={msg} index={i} chatId={chat.id} onReply={(m) => { setReplyTo(m); inputRef.current?.focus(); }} onReaction={onReaction} onForward={(msgId) => setForwardingMsg(msgId)} showEmojiFor={showEmojiFor} setShowEmojiFor={setShowEmojiFor} />
            )) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Hash className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{searchQuery ? "No messages match your search" : "No messages yet"}</p>
              </div>
            );
          })()}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Forward dialog */}
      {forwardingMsg && forwardTargets && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setForwardingMsg(null)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl glass-strong border border-border/60 shadow-elegant p-5 max-h-[60vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Forward to...</h3>
              <button onClick={() => setForwardingMsg(null)} className="rounded-lg p-1 hover:bg-surface-hover"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1">
              {forwardTargets.map((t) => (
                <button key={t.id} onClick={() => { onForward?.(forwardingMsg, t.id); setForwardingMsg(null); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-surface-hover transition-all">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary-glow/5 text-[10px] font-bold text-primary border border-primary/20">{t.avatar}</div>
                  <span className="text-sm font-medium text-foreground truncate">{t.name}</span>
                  <Forward className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                </button>
              ))}
              {forwardTargets.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No other chats</p>}
            </div>
          </div>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="relative z-10 flex items-center gap-3 px-4 md:px-6 py-2 border-t border-border/30 glass">
          <div className="w-1 h-8 rounded-full bg-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-primary">{replyTo.senderName || replyTo.senderId}</p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.text || "Media"}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="rounded-lg p-1 hover:bg-surface-hover"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
      )}

      {/* Pending media */}
      {pendingMedia.length > 0 && (
        <div className="relative z-10 border-t border-border/30 px-4 md:px-6 py-3 glass">
          <div className="mx-auto max-w-3xl flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {pendingMedia.map((m) => (
              <div key={m.id} className="relative flex-shrink-0 group">
                {m.type === "image" ? <img src={m.url} alt={m.name} className="h-16 w-16 rounded-xl object-cover border border-border/40" />
                : m.type === "video" ? <div className="h-16 w-16 rounded-xl bg-secondary border border-border/40 flex items-center justify-center"><Film className="h-6 w-6 text-primary" /></div>
                : <div className="h-16 w-16 rounded-xl bg-secondary border border-border/40 flex items-center justify-center"><Music className="h-6 w-6 text-accent" /></div>}
                <button onClick={() => removePendingMedia(m.id)} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                <p className="text-[9px] text-muted-foreground truncate w-16 mt-0.5">{m.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="relative z-10 border-t border-border/40 px-4 md:px-6 py-3 md:py-4 glass-strong">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="rounded-2xl p-2.5 md:p-3 hover:bg-surface-hover transition-all hover:scale-105 hover:text-primary"><Paperclip className="h-4 w-4 text-muted-foreground" /></button>
          {isRecording ? (
            <div className="group flex flex-1 items-center gap-3 rounded-2xl glass border border-destructive/50 px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-mono text-destructive">{fmtRec(recordingTime)}</span>
              <span className="text-xs text-muted-foreground">Recording...</span>
              <button onClick={cancelRecording} className="ml-auto rounded-lg p-1.5 hover:bg-destructive/10" title="Cancel"><X className="h-4 w-4 text-destructive" /></button>
              <button onClick={stopRecording} className="rounded-lg p-1.5 hover:bg-primary/10" title="Stop"><Square className="h-4 w-4 text-primary" /></button>
            </div>
          ) : (
            <div className="group flex flex-1 items-center gap-2 rounded-2xl glass border border-border/50 px-3 md:px-4 py-2.5 md:py-3 transition-all focus-within:border-primary/50 focus-within:shadow-glow">
              <input ref={inputRef} type="text" placeholder="Type a secure message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
              <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "image/*"; fileInputRef.current.click(); fileInputRef.current.accept = "image/*,video/*,audio/*,application/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"; } }} className="hidden sm:flex hover:text-primary transition-colors" title="Photo"><Image className="h-4 w-4 text-muted-foreground" /></button>
              <button className="hidden sm:flex hover:text-primary transition-colors"><Smile className="h-4 w-4 text-muted-foreground" /></button>
              <button onClick={startRecording} className="hidden sm:flex hover:text-primary transition-colors" title="Voice message"><Mic className="h-4 w-4 text-muted-foreground" /></button>
            </div>
          )}
          <button onClick={isRecording ? stopRecording : handleSend} className={`rounded-2xl p-2.5 md:p-3 transition-all hover:scale-105 ${input.trim() || pendingMedia.length > 0 || isRecording ? "gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}><Send className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

function MediaDisplay({ attachment }: { attachment: MediaAttachment }) {
  if (attachment.isFile) {
    return (<div className="mt-2 rounded-xl glass border border-border/40 p-3"><div className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-primary flex-shrink-0" /><div className="flex-1 min-w-0"><span className="text-xs text-foreground truncate block">{attachment.name}</span>{attachment.size > 0 && <span className="text-[10px] text-muted-foreground font-mono">{formatFileSize(attachment.size)}</span>}</div><button onClick={() => downloadMedia(attachment)} className="hover:text-primary transition-colors flex-shrink-0"><Download className="h-4 w-4 text-muted-foreground" /></button></div></div>);
  }
  if (attachment.type === "image") {
    return (<div className="relative group mt-2 rounded-xl overflow-hidden"><img src={attachment.url} alt={attachment.name} className="max-w-full max-h-64 rounded-xl object-cover" /><button onClick={() => downloadMedia(attachment)} className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Download className="h-4 w-4 text-white" /></button></div>);
  }
  if (attachment.type === "video") {
    return (<div className="mt-2 rounded-xl overflow-hidden"><video src={attachment.url} controls className="max-w-full max-h-64 rounded-xl" /><div className="flex items-center justify-between mt-1"><span className="text-[10px] text-muted-foreground font-mono">{attachment.name}</span><button onClick={() => downloadMedia(attachment)} className="hover:text-primary transition-colors"><Download className="h-3.5 w-3.5 text-muted-foreground" /></button></div></div>);
  }
  if (attachment.type === "audio") {
    return (<div className="mt-2 rounded-xl glass border border-border/40 p-3"><div className="flex items-center gap-2 mb-2"><Music className="h-4 w-4 text-accent flex-shrink-0" /><span className="text-xs text-foreground truncate">{attachment.name}</span><span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{formatFileSize(attachment.size)}</span><button onClick={() => downloadMedia(attachment)} className="ml-auto hover:text-primary transition-colors"><Download className="h-3.5 w-3.5 text-muted-foreground" /></button></div><audio src={attachment.url} controls className="w-full h-8" /></div>);
  }
  return null;
}

interface MBProps { message: Message; index: number; chatId: string; onReply: (m: Message) => void; onReaction?: (chatId: string, msgId: string, emoji: string) => void; onForward?: (msgId: string) => void; showEmojiFor: string | null; setShowEmojiFor: (id: string | null) => void; }

function MessageBubble({ message, index, chatId, onReply, onReaction, onForward, showEmojiFor, setShowEmojiFor }: MBProps) {
  const isOwn = message.senderId === "me";
  const isSystem = message.senderId === "system";
  const reactions = message.reactions || {};
  const hasReactions = Object.keys(reactions).length > 0;

  if (isSystem) {
    return (<div className="flex justify-center animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}><div className="max-w-[90%] md:max-w-[80%] rounded-2xl glass border border-primary/20 px-4 md:px-5 py-3 md:py-4 shadow-soft"><p className="text-xs font-mono text-foreground whitespace-pre-line leading-relaxed">{message.text}</p><p className="mt-2 text-[10px] font-mono text-muted-foreground text-center">{message.timestamp}</p></div></div>);
  }

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-fade-in-up group/msg`} style={{ animationDelay: `${index * 30}ms` }}>
      <div className="relative max-w-[85%] md:max-w-[75%]">
        {/* Hover actions */}
        <div className={`absolute top-0 ${isOwn ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"} flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity z-10`}>
          <button onClick={() => onReply(message)} className="rounded-lg p-1.5 hover:bg-surface-hover" title="Reply"><Reply className="h-3.5 w-3.5 text-muted-foreground" /></button>
          <button onClick={() => setShowEmojiFor(showEmojiFor === message.id ? null : message.id)} className="rounded-lg p-1.5 hover:bg-surface-hover" title="React"><Smile className="h-3.5 w-3.5 text-muted-foreground" /></button>
          <button onClick={() => onForward?.(message.id)} className="rounded-lg p-1.5 hover:bg-surface-hover" title="Forward"><Forward className="h-3.5 w-3.5 text-muted-foreground" /></button>
        </div>

        {/* Quick emoji picker */}
        {showEmojiFor === message.id && (
          <div className={`absolute ${isOwn ? "right-0" : "left-0"} -top-10 z-20 flex gap-0.5 rounded-2xl glass-strong border border-border/60 shadow-elegant px-2 py-1.5`}>
            {QUICK_REACTIONS.map((emoji) => (
              <button key={emoji} onClick={() => { onReaction?.(chatId, message.id, emoji); setShowEmojiFor(null); }} className="text-base hover:scale-125 transition-transform px-0.5">{emoji}</button>
            ))}
          </div>
        )}

        {/* Bubble */}
        <div className={`rounded-3xl px-4 py-2.5 ${isOwn ? "rounded-br-md text-primary-foreground shadow-elegant" : "rounded-bl-md bg-chat-other border border-border/40"}`} style={isOwn ? { background: "var(--gradient-bubble-own)" } : undefined}>
          {message.replyTo && (
            <div className="flex items-start gap-2 mb-2 rounded-xl bg-black/10 px-3 py-2 border-l-2 border-primary/60">
              <div className="min-w-0">
                <p className={`text-[10px] font-semibold ${isOwn ? "text-white/80" : "text-primary"}`}>{message.replyTo.senderName}</p>
                <p className={`text-[11px] truncate ${isOwn ? "text-white/60" : "text-muted-foreground"}`}>{message.replyTo.text || "Media"}</p>
              </div>
            </div>
          )}
          {!isOwn && <p className="text-[11px] font-semibold gradient-text-accent mb-1">{message.senderName || message.senderId.split(":")[0].replace("@", "")}</p>}
          {message.text && <p className={`text-sm whitespace-pre-line leading-relaxed ${isOwn ? "text-white" : "text-foreground"}`}>{message.text}</p>}
          {message.media && message.media.map((m) => <MediaDisplay key={m.id} attachment={m} />)}
          <p className={`mt-1 text-[10px] ${isOwn ? "text-white/70" : "text-muted-foreground"} text-right font-mono`}>
            {message.timestamp}{isOwn && <span className="ml-1">{message.read ? "\u2713\u2713" : "\u2713"}</span>}
          </p>
        </div>

        {/* Reactions */}
        {hasReactions && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactions).map(([emoji, data]) => (
              <button key={emoji} onClick={() => onReaction?.(chatId, message.id, emoji)}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all ${data.myReaction ? "bg-primary/20 border border-primary/40 text-primary" : "bg-secondary/80 border border-border/40 text-foreground hover:bg-secondary"}`}>
                <span>{emoji}</span><span className="text-[10px] font-mono">{data.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
