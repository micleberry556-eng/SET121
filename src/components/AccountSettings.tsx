import { useState, useRef, useCallback, useEffect } from "react";
import {
  X, Camera, ArrowLeft, User, AtSign, FileText, Shield,
  Eye, EyeOff, Phone, Users, MessageSquare, CheckCheck,
  Wifi, ChevronRight, Trash2, LogOut, Lock,
} from "lucide-react";
import { UserProfile } from "@/data/mockData";

interface AccountSettingsProps {
  open: boolean;
  profile: UserProfile;
  onClose: () => void;
  onUpdate: (profile: UserProfile) => void;
}

type Page = "main" | "editProfile" | "privacy";
type PrivacyOption = "everyone" | "contacts" | "nobody";

const privacyLabels: Record<PrivacyOption, string> = {
  everyone: "Everyone",
  contacts: "My Contacts",
  nobody: "Nobody",
};

/** Resize image to max 256x256 and return a data URL (persistent, not blob). */
function resizeImageToDataUrl(file: File, maxSize: number = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;

        // Crop to square from center
        const side = Math.min(w, h);
        const sx = (w - side) / 2;
        const sy = (h - side) / 2;

        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("No canvas context")); return; }

        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AccountSettings({ open, profile, onClose, onUpdate }: AccountSettingsProps) {
  const [page, setPage] = useState<Page>("main");
  const [draft, setDraft] = useState<UserProfile>({ ...profile });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-sync draft from profile every time dialog opens
  useEffect(() => {
    if (open) {
      setDraft({ ...profile });
      setAvatarPreview(profile.avatarUrl);
      setPage("main");
    }
  }, [open, profile]);

  if (!open) return null;

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      setAvatarPreview(dataUrl);
      setDraft((d) => ({ ...d, avatarUrl: dataUrl }));
    } catch {
      // Fallback: use raw blob URL
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
      setDraft((d) => ({ ...d, avatarUrl: url }));
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setDraft((d) => ({ ...d, avatarUrl: null }));
  };

  const handleSaveProfile = () => {
    const initials = draft.name.trim().split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "ME";
    const updated = { ...draft, avatarUrl: avatarPreview, avatarInitials: initials };
    onUpdate(updated);
    setPage("main");
  };

  const handleSavePrivacy = () => {
    onUpdate({ ...draft, avatarUrl: avatarPreview });
    setPage("main");
  };

  const updatePrivacy = <K extends keyof UserProfile["privacy"]>(key: K, value: UserProfile["privacy"][K]) => {
    setDraft((d) => ({ ...d, privacy: { ...d.privacy, [key]: value } }));
  };

  const handleClose = () => {
    onClose();
  };

  const goBack = () => {
    if (page !== "main") {
      // Discard edits, reset to saved profile
      setDraft({ ...profile });
      setAvatarPreview(profile.avatarUrl);
      setPage("main");
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up" onClick={handleClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl glass-strong border border-border/60 shadow-elegant max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40">
          <button onClick={goBack} className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
            {page === "main" ? <X className="h-4 w-4 text-muted-foreground" /> : <ArrowLeft className="h-4 w-4 text-muted-foreground" />}
          </button>
          <h2 className="text-lg font-serif italic gradient-text flex-1">
            {page === "main" ? "Settings" : page === "editProfile" ? "Edit Profile" : "Privacy & Security"}
          </h2>
          {page !== "main" && (
            <button
              onClick={page === "editProfile" ? handleSaveProfile : handleSavePrivacy}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Save
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {page === "main" && <MainPage profile={profile} avatarPreview={avatarPreview} setPage={setPage} onClose={handleClose} />}
          {page === "editProfile" && (
            <EditProfilePage
              draft={draft}
              avatarPreview={avatarPreview}
              setDraft={setDraft}
              onAvatarClick={() => fileInputRef.current?.click()}
              onRemoveAvatar={handleRemoveAvatar}
            />
          )}
          {page === "privacy" && <PrivacyPage draft={draft} updatePrivacy={updatePrivacy} />}
        </div>
      </div>
    </div>
  );
}

/* ===== Main Settings Page ===== */
function MainPage({
  profile,
  avatarPreview,
  setPage,
  onClose,
}: {
  profile: UserProfile;
  avatarPreview: string | null;
  setPage: (p: Page) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Profile card */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" className="h-20 w-20 rounded-3xl object-cover border-2 border-primary/30 shadow-glow" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl gradient-primary text-xl font-bold text-primary-foreground shadow-glow">
              {profile.avatarInitials}
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card bg-online shadow-lg shadow-online/50" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{profile.name}</p>
          <p className="text-xs font-mono text-muted-foreground">@{profile.username}</p>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">{profile.peerId}</p>
        </div>
      </div>

      {/* Menu items */}
      <div className="space-y-1">
        <MenuItem icon={<User className="h-4 w-4" />} label="Edit Profile" sub="Name, username, bio, photo" onClick={() => setPage("editProfile")} />
        <MenuItem icon={<Shield className="h-4 w-4" />} label="Privacy & Security" sub="Last seen, read receipts, calls" onClick={() => setPage("privacy")} />
        <MenuItem icon={<Lock className="h-4 w-4" />} label="Encryption" sub="X3DH + Double Ratchet active" />
        <MenuItem icon={<Wifi className="h-4 w-4" />} label="Network" sub="3 relay nodes connected" />
      </div>

      {/* Danger zone */}
      <div className="pt-3 border-t border-border/40 space-y-1">
        <MenuItem icon={<LogOut className="h-4 w-4 text-destructive" />} label="Log Out" labelClass="text-destructive" onClick={onClose} />
      </div>
    </div>
  );
}

/* ===== Edit Profile Page ===== */
function EditProfilePage({
  draft,
  avatarPreview,
  setDraft,
  onAvatarClick,
  onRemoveAvatar,
}: {
  draft: UserProfile;
  avatarPreview: string | null;
  setDraft: React.Dispatch<React.SetStateAction<UserProfile>>;
  onAvatarClick: () => void;
  onRemoveAvatar: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative group cursor-pointer" onClick={onAvatarClick}>
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" className="h-24 w-24 rounded-3xl object-cover border-2 border-primary/30 shadow-glow group-hover:opacity-80 transition-opacity" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl gradient-primary text-2xl font-bold text-primary-foreground shadow-glow group-hover:opacity-80 transition-opacity">
              {draft.avatarInitials}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/0 group-hover:bg-black/30 transition-colors">
            <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onAvatarClick} className="text-xs font-medium text-primary hover:underline">
            {avatarPreview ? "Change Photo" : "Add Photo"}
          </button>
          {avatarPreview && (
            <button onClick={onRemoveAvatar} className="text-xs font-medium text-destructive hover:underline">
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Fields */}
      <FieldInput
        label="Name"
        icon={<User className="h-4 w-4 text-muted-foreground" />}
        value={draft.name}
        onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
        placeholder="Your display name"
      />
      <FieldInput
        label="Username"
        icon={<AtSign className="h-4 w-4 text-muted-foreground" />}
        value={draft.username}
        onChange={(v) => setDraft((d) => ({ ...d, username: v.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
        placeholder="username"
        prefix="@"
      />
      <div>
        <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">Bio</label>
        <div className="flex items-start gap-3 rounded-2xl glass border border-border/50 px-4 py-3 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
          <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
          <textarea
            value={draft.bio}
            onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
            placeholder="Tell about yourself..."
            rows={3}
            maxLength={140}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
          />
        </div>
        <p className="text-[10px] text-muted-foreground text-right mt-1">{draft.bio.length}/140</p>
      </div>
    </div>
  );
}

/* ===== Privacy Page ===== */
function PrivacyPage({
  draft,
  updatePrivacy,
}: {
  draft: UserProfile;
  updatePrivacy: <K extends keyof UserProfile["privacy"]>(key: K, value: UserProfile["privacy"][K]) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">Control who can see your information and contact you.</p>

      <div className="space-y-4">
        <PrivacySelect icon={<Eye className="h-4 w-4" />} label="Last Seen" value={draft.privacy.lastSeen} onChange={(v) => updatePrivacy("lastSeen", v)} />
        <PrivacySelect icon={<Camera className="h-4 w-4" />} label="Profile Photo" value={draft.privacy.profilePhoto} onChange={(v) => updatePrivacy("profilePhoto", v)} />
        <PrivacySelect icon={<MessageSquare className="h-4 w-4" />} label="Forwarded Messages" value={draft.privacy.forwarding} onChange={(v) => updatePrivacy("forwarding", v)} />
        <PrivacySelect icon={<Phone className="h-4 w-4" />} label="Calls" value={draft.privacy.calls} onChange={(v) => updatePrivacy("calls", v)} />
        <PrivacySelect icon={<Users className="h-4 w-4" />} label="Groups & Channels" value={draft.privacy.groups} onChange={(v) => updatePrivacy("groups", v)} />
      </div>

      <div className="border-t border-border/40 pt-4 space-y-3">
        <PrivacyToggle icon={<CheckCheck className="h-4 w-4" />} label="Read Receipts" sub="Show when you've read messages" checked={draft.privacy.readReceipts} onChange={(v) => updatePrivacy("readReceipts", v)} />
        <PrivacyToggle icon={<Wifi className="h-4 w-4" />} label="Online Status" sub="Show when you're online" checked={draft.privacy.onlineStatus} onChange={(v) => updatePrivacy("onlineStatus", v)} />
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
        <Lock className="h-4 w-4 text-primary flex-shrink-0" />
        <p className="text-[11px] text-muted-foreground">All settings are stored locally and encrypted on your device</p>
      </div>
    </div>
  );
}

/* ===== Reusable sub-components ===== */

function MenuItem({ icon, label, sub, labelClass, onClick }: {
  icon: React.ReactNode; label: string; sub?: string; labelClass?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-hover transition-all">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/80 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${labelClass || "text-foreground"}`}>{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
      {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
    </button>
  );
}

function FieldInput({ label, icon, value, onChange, placeholder, prefix }: {
  label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; placeholder: string; prefix?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex items-center gap-3 rounded-2xl glass border border-border/50 px-4 py-3 focus-within:border-primary/50 focus-within:shadow-glow transition-all">
        {icon}
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
      </div>
    </div>
  );
}

function PrivacySelect({ icon, label, value, onChange }: {
  icon: React.ReactNode; label: string; value: PrivacyOption; onChange: (v: PrivacyOption) => void;
}) {
  const options: PrivacyOption[] = ["everyone", "contacts", "nobody"];
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="flex gap-1.5 ml-7">
        {options.map((opt) => (
          <button key={opt} onClick={() => onChange(opt)} className={`flex-1 rounded-xl py-2 text-[11px] font-medium transition-all ${
            value === opt ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-surface-hover border border-border/50"
          }`}>
            {privacyLabels[opt]}
          </button>
        ))}
      </div>
    </div>
  );
}

function PrivacyToggle({ icon, label, sub, checked, onChange }: {
  icon: React.ReactNode; label: string; sub: string; checked: boolean; onChange: (v: boolean) => void;
}) {
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
