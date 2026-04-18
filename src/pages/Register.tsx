import { useState, useRef } from "react";
import {
  Sparkles, Camera, ChevronRight, ChevronLeft, Globe, Monitor,
  Smartphone, Download, Check, Search, User, AtSign, Lock, Eye, EyeOff,
} from "lucide-react";
import { languages, platforms, PlatformId } from "@/data/languages";
import { UserProfile } from "@/data/mockData";

interface RegisterPageProps {
  onComplete: (profile: UserProfile, language: string, platform: PlatformId | null) => void;
}

type Step = "welcome" | "language" | "platform" | "profile" | "done";

function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
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

export default function RegisterPage({ onComplete }: RegisterPageProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [lang, setLang] = useState("en");
  const [langSearch, setLangSearch] = useState("");
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredLangs = languages.filter(
    (l) =>
      !langSearch ||
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.native.toLowerCase().includes(langSearch.toLowerCase()),
  );

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const url = await resizeAvatar(file);
      setAvatarUrl(url);
    } catch { /* ignore */ }
  };

  const handleFinish = () => {
    const initials = name.trim().split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "ME";
    const peerId = "peer:" + Math.random().toString(36).slice(2, 6) + "..." + Math.random().toString(36).slice(2, 6);
    const profile: UserProfile = {
      name: name.trim() || "Anonymous",
      username: username.trim() || "user_" + Math.random().toString(36).slice(2, 8),
      bio: "",
      avatarUrl,
      avatarInitials: initials,
      peerId,
      privacy: {
        lastSeen: "everyone",
        profilePhoto: "everyone",
        forwarding: "everyone",
        calls: "everyone",
        groups: "contacts",
        readReceipts: true,
        onlineStatus: true,
      },
    };
    onComplete(profile, lang, platform);
  };

  const handleDownload = (fileName: string) => {
    // Simulate download -- in production this would link to real files
    const a = document.createElement("a");
    a.href = "#";
    a.download = fileName;
    // Show alert since we don't have real binaries
    alert(`Download started: ${fileName}\n\nIn production, this downloads the real installer.`);
  };

  const canProceedProfile = name.trim().length >= 2;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background mesh */}
      <div className="pointer-events-none fixed inset-0" style={{ backgroundImage: "var(--gradient-mesh)", backgroundAttachment: "fixed" }} />
      <div className="pointer-events-none fixed top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/15 blur-3xl animate-float" />
      <div className="pointer-events-none fixed bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-accent/15 blur-3xl animate-float" style={{ animationDelay: "2s" }} />

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />

      <div className="relative w-full max-w-md">
        {/* ===== WELCOME ===== */}
        {step === "welcome" && (
          <div className="flex flex-col items-center gap-8 text-center animate-fade-in-up">
            <div className="relative">
              <div className="absolute inset-0 gradient-primary blur-2xl opacity-50 animate-glow rounded-3xl" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl gradient-primary shadow-elegant">
                <Sparkles className="h-12 w-12 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h1 className="font-serif italic text-5xl gradient-text mb-3">Meshlink</h1>
              <p className="text-base text-muted-foreground max-w-sm leading-relaxed">
                Decentralized, end-to-end encrypted messenger for the post-cloud era.
              </p>
            </div>
            <button
              onClick={() => setStep("language")}
              className="w-full max-w-xs rounded-2xl py-3.5 text-sm font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all"
            >
              Get Started
            </button>
            <p className="text-[10px] font-mono text-muted-foreground">
              No phone number required - fully anonymous
            </p>
          </div>
        )}

        {/* ===== LANGUAGE ===== */}
        {step === "language" && (
          <div className="rounded-3xl glass-strong border border-border/60 shadow-elegant p-6 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setStep("welcome")} className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="flex-1">
                <h2 className="text-lg font-serif italic gradient-text">Choose Language</h2>
                <p className="text-[11px] text-muted-foreground">Select your preferred language</p>
              </div>
              <Globe className="h-5 w-5 text-primary" />
            </div>

            {/* Search */}
            <div className="flex items-center gap-2.5 rounded-2xl glass border border-border/50 px-4 py-2.5 mb-4 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search language..."
                value={langSearch}
                onChange={(e) => setLangSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>

            {/* Language list */}
            <div className="max-h-[45vh] overflow-y-auto scrollbar-thin space-y-1 -mx-1 px-1">
              {filteredLangs.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all ${
                    lang === l.code
                      ? "bg-primary/10 border border-primary/30 shadow-glow"
                      : "hover:bg-surface-hover border border-transparent"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{l.native}</p>
                    <p className="text-[11px] text-muted-foreground">{l.name}</p>
                  </div>
                  {lang === l.code && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full gradient-primary">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep("platform")}
              className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all"
            >
              Continue
              <ChevronRight className="h-4 w-4 inline ml-1" />
            </button>
          </div>
        )}

        {/* ===== PLATFORM ===== */}
        {step === "platform" && (
          <div className="rounded-3xl glass-strong border border-border/60 shadow-elegant p-6 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setStep("language")} className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="flex-1">
                <h2 className="text-lg font-serif italic gradient-text">Your Device</h2>
                <p className="text-[11px] text-muted-foreground">Download the app for your platform</p>
              </div>
              <Monitor className="h-5 w-5 text-primary" />
            </div>

            <div className="space-y-2 mb-4">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                    platform === p.id
                      ? "border-primary/50 bg-primary/10 shadow-glow"
                      : "border-border/50 hover:border-primary/30 hover:bg-surface-hover"
                  }`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold ${
                    p.id === "windows" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                    p.id === "linux" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                    p.id === "android" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                    "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                  }`}>
                    {p.id === "windows" ? <Monitor className="h-5 w-5" /> :
                     p.id === "linux" ? "L" :
                     <Smartphone className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.description}</p>
                  </div>
                  {platform === p.id && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full gradient-primary">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Download button */}
            {platform && (
              <button
                onClick={() => handleDownload(platforms.find((p) => p.id === platform)!.fileName)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-accent/40 py-2.5 text-sm font-medium text-accent hover:bg-accent/10 transition-all mb-4"
              >
                <Download className="h-4 w-4" />
                Download {platforms.find((p) => p.id === platform)!.fileName}
                <span className="text-[10px] text-muted-foreground">({platforms.find((p) => p.id === platform)!.fileSize})</span>
              </button>
            )}

            <button
              onClick={() => setStep("profile")}
              className="w-full rounded-2xl py-3 text-sm font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all"
            >
              {platform ? "Continue to Registration" : "Skip & Use Web Version"}
              <ChevronRight className="h-4 w-4 inline ml-1" />
            </button>
          </div>
        )}

        {/* ===== PROFILE ===== */}
        {step === "profile" && (
          <div className="rounded-3xl glass-strong border border-border/60 shadow-elegant p-6 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setStep("platform")} className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="flex-1">
                <h2 className="text-lg font-serif italic gradient-text">Create Account</h2>
                <p className="text-[11px] text-muted-foreground">Set up your profile</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-24 w-24 rounded-3xl object-cover border-2 border-primary/30 shadow-glow group-hover:opacity-80 transition-opacity" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-3xl gradient-primary text-2xl font-bold text-primary-foreground shadow-glow group-hover:opacity-80 transition-opacity">
                      {name.trim() ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : <Camera className="h-8 w-8" />}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/0 group-hover:bg-black/30 transition-colors">
                    <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <button onClick={() => fileRef.current?.click()} className="text-[11px] font-medium text-primary hover:underline">
                  {avatarUrl ? "Change Photo" : "Add Photo"}
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Display Name *</label>
                <div className="flex items-center gap-3 rounded-2xl glass border border-border/50 px-4 py-3 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoFocus
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Username</label>
                <div className="flex items-center gap-3 rounded-2xl glass border border-border/50 px-4 py-3 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="username"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Password</label>
                <div className="flex items-center gap-3 rounded-2xl glass border border-border/50 px-4 py-3 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  <button onClick={() => setShowPassword((s) => !s)} className="text-muted-foreground hover:text-primary transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                <Lock className="h-4 w-4 text-primary flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground">
                  No phone or email needed. Your identity is cryptographic.
                </p>
              </div>

              {/* Register button */}
              <button
                onClick={() => setStep("done")}
                disabled={!canProceedProfile}
                className={`w-full rounded-2xl py-3.5 text-sm font-semibold transition-all ${
                  canProceedProfile
                    ? "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]"
                    : "bg-secondary text-muted-foreground cursor-not-allowed"
                }`}
              >
                Create Account
              </button>
            </div>
          </div>
        )}

        {/* ===== DONE ===== */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-6 text-center animate-fade-in-up">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-online/30 animate-ping" style={{ animationDuration: "1.5s" }} />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-online/20 border-2 border-online shadow-lg">
                <Check className="h-10 w-10 text-online" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">Welcome, {name.trim() || "Anonymous"}!</h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Your encrypted identity has been generated. You're ready to start messaging.
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-border/50">
              <span className="h-2 w-2 rounded-full bg-online animate-pulse" />
              <p className="text-xs font-mono text-muted-foreground">
                peer:{Math.random().toString(36).slice(2, 6)}...{Math.random().toString(36).slice(2, 6)} connected
              </p>
            </div>
            <button
              onClick={handleFinish}
              className="w-full max-w-xs rounded-2xl py-3.5 text-sm font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all"
            >
              Enter Meshlink
            </button>
          </div>
        )}

        {/* Step indicator */}
        {step !== "welcome" && step !== "done" && (
          <div className="flex justify-center gap-2 mt-6">
            {(["language", "platform", "profile"] as const).map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === step ? "w-8 gradient-primary" :
                  (["language", "platform", "profile"].indexOf(step) > i) ? "w-4 bg-primary/40" :
                  "w-4 bg-muted"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
