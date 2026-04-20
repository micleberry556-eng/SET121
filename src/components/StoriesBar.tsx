import { useState, useRef, useEffect } from "react";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Story, StoryItem } from "@/data/mockData";

interface StoriesBarProps {
  stories: Story[];
  onAddStory: () => void;
}

export function StoriesBar({ stories, onAddStory }: StoriesBarProps) {
  const [viewingStory, setViewingStory] = useState<Story | null>(null);

  return (
    <>
      <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-thin border-b border-border/30">
        {/* My story / Add */}
        <button
          onClick={onAddStory}
          className="flex flex-col items-center gap-1 flex-shrink-0"
        >
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl gradient-primary text-xs font-bold text-primary-foreground shadow-glow">
              ME
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-accent border-2 border-card">
              <Plus className="h-3 w-3 text-accent-foreground" />
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">My Story</span>
        </button>

        {/* Other stories */}
        {stories.map((story) => (
          <button
            key={story.id}
            onClick={() => setViewingStory(story)}
            className="flex flex-col items-center gap-1 flex-shrink-0"
          >
            <div className={`p-0.5 rounded-xl ${story.viewed ? "bg-muted" : "gradient-primary"}`}>
              <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[10px] bg-card text-xs font-bold text-foreground border-2 border-card">
                {story.avatar}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium truncate w-14 text-center">
              {story.userName.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {viewingStory && (
        <StoryViewer
          story={viewingStory}
          onClose={() => setViewingStory(null)}
        />
      )}
    </>
  );
}

interface StoryViewerProps {
  story: Story;
  onClose: () => void;
}

function StoryViewer({ story, onClose }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const item = story.items[currentIndex];

  useEffect(() => {
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);

    const duration = item?.type === "video" ? 15000 : 5000;
    const step = 100 / (duration / 50);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < story.items.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, story.items.length, onClose, item?.type]);

  const goNext = () => {
    if (currentIndex < story.items.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
        {story.items.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{
                width: i < currentIndex ? "100%" : i === currentIndex ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3 mt-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
            {story.avatar}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{story.userName}</p>
            <p className="text-[10px] text-white/60">{item.timestamp}</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10 transition-colors mt-2">
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="relative w-full h-full flex items-center justify-center">
        {item.type === "image" ? (
          <img
            src={item.url}
            alt={item.caption || "Story"}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <video
            src={item.url}
            autoPlay
            muted
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* Caption */}
      {item.caption && (
        <div className="absolute bottom-16 left-0 right-0 text-center px-8 z-10">
          <p className="text-white text-sm bg-black/40 backdrop-blur-sm rounded-2xl px-4 py-2 inline-block">
            {item.caption}
          </p>
        </div>
      )}

      {/* Navigation zones */}
      <button
        onClick={goPrev}
        className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
        aria-label="Previous"
      />
      <button
        onClick={goNext}
        className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
        aria-label="Next"
      />

      {/* Nav arrows (desktop) */}
      {currentIndex > 0 && (
        <button onClick={goPrev} className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors z-20">
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
      )}
      {currentIndex < story.items.length - 1 && (
        <button onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors z-20">
          <ChevronRight className="h-5 w-5 text-white" />
        </button>
      )}
    </div>
  );
}

interface AddStoryDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (items: StoryItem[]) => void;
}

export function AddStoryDialog({ open, onClose, onAdd }: AddStoryDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; type: "image" | "video"; file: File } | null>(null);
  const [caption, setCaption] = useState("");

  if (!open) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith("video/") ? "video" as const : "image" as const;
    setPreview({ url: URL.createObjectURL(file), type, file });
    e.target.value = "";
  };

  const handlePublish = () => {
    if (!preview) return;
    const item: StoryItem = {
      id: `story-item-${Date.now()}`,
      type: preview.type,
      url: preview.url,
      caption: caption.trim() || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    onAdd([item]);
    setPreview(null);
    setCaption("");
    onClose();
  };

  const handleClose = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setCaption("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up" onClick={handleClose}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-3xl glass-strong border border-border/60 shadow-elegant p-6">
        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-serif italic gradient-text">New Story</h2>
          <button onClick={handleClose} className="rounded-lg p-1.5 hover:bg-surface-hover transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {!preview ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-4">Share a photo or video that disappears in 24h</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border/60 p-8 hover:border-primary/40 hover:bg-surface-hover transition-all"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-glow">
                <Plus className="h-8 w-8 text-primary-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Choose photo or video</p>
                <p className="text-[11px] text-muted-foreground mt-1">JPG, PNG, MP4, WebM</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview */}
            <div className="relative rounded-2xl overflow-hidden bg-black/20 flex items-center justify-center max-h-64">
              {preview.type === "image" ? (
                <img src={preview.url} alt="Preview" className="max-w-full max-h-64 object-contain rounded-2xl" />
              ) : (
                <video src={preview.url} controls className="max-w-full max-h-64 rounded-2xl" />
              )}
            </div>

            {/* Caption */}
            <input
              type="text"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full rounded-2xl glass border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:shadow-glow transition-all bg-transparent"
            />

            {/* Publish */}
            <button
              onClick={handlePublish}
              className="w-full rounded-2xl py-3 text-sm font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all"
            >
              Publish Story
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
