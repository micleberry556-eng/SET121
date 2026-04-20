import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Camera, ChevronRight, ChevronLeft, Globe, Monitor,
  Smartphone, Download, Check, Search, User, AtSign, Lock, Eye, EyeOff,
  Loader2, AlertCircle,
} from "lucide-react";
import { languages, platforms, PlatformId } from "@/data/languages";
import { UserProfile } from "@/data/mockData";
import { matrixRegister, storeSession, checkHomeserver } from "@/lib/matrix";

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

function detectPlatform(): PlatformId {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/win/.test(ua)) return "windows";
  return "linux";
}

export default function RegisterPage({ onComplete }: RegisterPageProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [lang, setLang] = useState("en");
  const [langSearch, setLangSearch] = useState("");
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-detect platform when step opens
  useEffect(() => {
    if (step === "platform" && !platform) {
      setPlatform(detectPlatform());
    }
  }, [step, platform]);

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

  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  // Check if Matrix homeserver is reachable on mount
  useEffect(() => {
    checkHomeserver().then(setServerOnline);
  }, []);

  const handleFinish = async () => {
    const finalUsername = username.trim() || "user_" + Math.random().toString(36).slice(2, 8);
    const finalName = name.trim() || "Anonymous";
    const initials = finalName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "ME";

    setRegistering(true);
    setRegError(null);

    try {
      // Register on the Matrix homeserver
      const session = await matrixRegister(finalUsername, password, finalName);
      storeSession(session);

      const profile: UserProfile = {
        name: finalName,
        username: finalUsername,
        bio: "",
        avatarUrl,
        avatarInitials: initials,
        peerId: session.user_id,
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setRegError(message);
    } finally {
      setRegistering(false);
    }
  };

  /** Force-download a file from server by fetching as blob */
  const forceDownload = async (url: string, fileName: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
    }
  };

  const handleInstall = async () => {
    if (!platform) return;

    if (platform === "android" || platform === "ios") {
      // Mobile: no download needed, just go to profile
      setStep("profile");
      return;
    }

    setDownloading(true);
    try {
      if (platform === "linux") {
        await forceDownload("/installers/meshlink-install.sh", "meshlink-install.sh");
      } else {
        await forceDownload("/installers/Meshlink-Install.bat", "Meshlink-Install.bat");
      }
    } finally {
      setTimeout(() => {
        setDownloading(false);
        setStep("profile");
      }, 1500);
    }
  };

  const canProceedProfile = name.trim().length >= 2;

  const detectedPlatformInfo = platform ? platforms.find((p) => p.id === platform) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
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
            <p className="text-[10px] font-mono text-muted-foreground">No phone number required - fully anonymous</p>
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

            <div className="flex items-center gap-2.5 rounded-2xl glass border border-border/50 px-4 py-2.5 mb-4 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search language..." value={langSearch} onChange={(e) => setLangSearch(e.target.value)} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            </div>

            <div className="max-h-[45vh] overflow-y-auto scrollbar-thin space-y-1 -mx-1 px-1">
              {filteredLangs.map((l) => (
                <button key={l.code} onClick={() => setLang(l.code)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all ${lang === l.code ? "bg-primary/10 border border-primary/30 shadow-glow" : "hover:bg-surface-hover border border-transparent"}`}>
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

            <button onClick={() => setStep("platform")} className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all">
              Continue <ChevronRight className="h-4 w-4 inline ml-1" />
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
                <h2 className="text-lg font-serif italic gradient-text">Install App</h2>
                <p className="text-[11px] text-muted-foreground">
                  {detectedPlatformInfo ? `Detected: ${detectedPlatformInfo.name}` : "Choose your platform"}
                </p>
              </div>
              <Monitor className="h-5 w-5 text-primary" />
            </div>

            {/* Platform selector */}
            <div className="flex gap-2 mb-5">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`flex-1 flex flex-col items-center gap-1.5 rounded-2xl border py-3 transition-all ${
                    platform === p.id
                      ? "border-primary/50 bg-primary/10 shadow-glow"
                      : "border-border/50 hover:border-primary/30 hover:bg-surface-hover"
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                    p.id === "windows" ? "bg-blue-500/20 text-blue-400" :
                    p.id === "linux" ? "bg-orange-500/20 text-orange-400" :
                    p.id === "android" ? "bg-green-500/20 text-green-400" :
                    "bg-gray-500/20 text-gray-400"
                  }`}>
                    {p.id === "windows" ? <Monitor className="h-4 w-4" /> :
                     p.id === "linux" ? "L" :
                     p.id === "ios" ? "i" :
                     <Smartphone className="h-4 w-4" />}
                  </div>
                  <span className="text-[11px] font-medium text-foreground">{p.name}</span>
                  {platform === p.id && <Check className="h-3 w-3 text-primary" />}
                </button>
              ))}
            </div>

            {/* Install info for selected platform */}
            {detectedPlatformInfo && (
              <div className="rounded-2xl glass border border-border/50 p-4 mb-4">
                <p className="text-sm font-semibold text-foreground mb-2">{detectedPlatformInfo.name}</p>

                {platform === "android" && (
                  <div className="space-y-2 text-[12px] text-muted-foreground">
                    <p>This app works directly in your browser. To add it to your home screen:</p>
                    <div className="space-y-1.5 pl-1">
                      <p>1. After registration, tap <b className="text-foreground">menu ⋮</b> in Chrome</p>
                      <p>2. Tap <b className="text-foreground">"Install app"</b> or <b className="text-foreground">"Add to Home screen"</b></p>
                      <p>3. The app icon will appear on your home screen</p>
                    </div>
                  </div>
                )}

                {platform === "ios" && (
                  <div className="space-y-2 text-[12px] text-muted-foreground">
                    <p>This app works directly in Safari. To add it to your home screen:</p>
                    <div className="space-y-1.5 pl-1">
                      <p>1. After registration, tap <b className="text-foreground">Share ↑</b> in Safari</p>
                      <p>2. Tap <b className="text-foreground">"Add to Home Screen"</b></p>
                      <p>3. The app icon will appear on your home screen</p>
                    </div>
                  </div>
                )}

                {platform === "windows" && (
                  <div className="space-y-2 text-[12px] text-muted-foreground">
                    <p>Downloads <b className="text-foreground">Meshlink-Install.bat</b></p>
                    <div className="space-y-1.5 pl-1">
                      <p>1. Double-click the downloaded file</p>
                      <p>2. Installer creates a shortcut on Desktop and Start Menu</p>
                      <p>3. Opens Meshlink automatically</p>
                    </div>
                  </div>
                )}

                {platform === "linux" && (
                  <div className="space-y-2 text-[12px] text-muted-foreground">
                    <p>Downloads <b className="text-foreground">meshlink-install.sh</b></p>
                    <div className="space-y-1.5 pl-1">
                      <p>1. Open terminal in Downloads folder</p>
                      <p>2. Run: <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[11px]">chmod +x meshlink-install.sh && ./meshlink-install.sh</code></p>
                      <p>3. Creates Desktop shortcut and opens Meshlink</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Install button */}
            <button
              onClick={handleInstall}
              disabled={!platform || downloading}
              className={`w-full rounded-2xl py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                !platform || downloading
                  ? "bg-secondary text-muted-foreground cursor-not-allowed"
                  : "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]"
              }`}
            >
              {downloading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Downloading...</>
              ) : (platform === "android" || platform === "ios") ? (
                <>Continue <ChevronRight className="h-4 w-4" /></>
              ) : (
                <><Download className="h-4 w-4" /> Download & Install</>
              )}
            </button>

            {/* Skip */}
            <button
              onClick={() => setStep("profile")}
              className="mt-3 w-full rounded-2xl py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all"
            >
              Skip — use in browser
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

              <div>
                <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Display Name *</label>
                <div className="flex items-center gap-3 rounded-2xl glass border border-border/50 px-4 py-3 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Username</label>
                <div className="flex items-center gap-3 rounded-2xl glass border border-border/50 px-4 py-3 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="username" className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Password</label>
                <div className="flex items-center gap-3 rounded-2xl glass border border-border/50 px-4 py-3 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                  <button onClick={() => setShowPassword((s) => !s)} className="text-muted-foreground hover:text-primary transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                <Lock className="h-4 w-4 text-primary flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground">
                  {serverOnline === false
                    ? "Server offline — registration will use local mode."
                    : "No phone or email needed. Your identity is cryptographic."}
                </p>
              </div>

              {regError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <p className="text-[11px] text-destructive">{regError}</p>
                </div>
              )}

              <button
                onClick={() => { setStep("done"); handleFinish(); }}
                disabled={!canProceedProfile || registering}
                className={`w-full rounded-2xl py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  canProceedProfile && !registering ? "gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02]" : "bg-secondary text-muted-foreground cursor-not-allowed"
                }`}
              >
                {registering ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creating Account...</>
                ) : (
                  "Create Account"
                )}
              </button>
            </div>
          </div>
        )}

        {/* ===== DONE ===== */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-6 text-center animate-fade-in-up">
            {registering ? (
              <>
                <div className="relative">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 border-2 border-primary shadow-lg">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">Creating account...</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">Registering on the Meshlink server and generating encryption keys.</p>
                </div>
              </>
            ) : regError ? (
              <>
                <div className="relative">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-destructive/20 border-2 border-destructive shadow-lg">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">Registration failed</h2>
                  <p className="text-sm text-destructive max-w-xs mx-auto">{regError}</p>
                </div>
                <button onClick={() => setStep("profile")} className="w-full max-w-xs rounded-2xl py-3.5 text-sm font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all">
                  Go Back
                </button>
              </>
            ) : (
              <>
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-online/30 animate-ping" style={{ animationDuration: "1.5s" }} />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-online/20 border-2 border-online shadow-lg">
                    <Check className="h-10 w-10 text-online" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">Welcome, {name.trim() || "Anonymous"}!</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">Your encrypted identity has been generated. You're ready to start messaging.</p>
                </div>
                <p className="text-[11px] font-mono text-muted-foreground">Redirecting to Meshlink...</p>
              </>
            )}
          </div>
        )}

        {/* Step indicator */}
        {step !== "welcome" && step !== "done" && (
          <div className="flex justify-center gap-2 mt-6">
            {(["language", "platform", "profile"] as const).map((s, i) => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${
                s === step ? "w-8 gradient-primary" :
                (["language", "platform", "profile"].indexOf(step) > i) ? "w-4 bg-primary/40" : "w-4 bg-muted"
              }`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
