import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from "react";

type PaletteInfo = {
  id: string;
  name: string;
  description: string;
  swatch: string[];
};

type ThemeContextType = {
  palette: string;
  mode: "dark" | "light";
  setPalette: (id: string) => void;
  toggleMode: () => void;
  palettes: PaletteInfo[];
};

const defaultPalettes: PaletteInfo[] = [
  { id: "violet", name: "Violet Mesh", description: "Default purple-pink gradient theme", swatch: ["#a855f7", "#ec4899", "#06b6d4"] },
  { id: "emerald", name: "Emerald Node", description: "Green-teal nature inspired", swatch: ["#10b981", "#14b8a6", "#06b6d4"] },
  { id: "amber", name: "Amber Signal", description: "Warm amber-orange tones", swatch: ["#f59e0b", "#ef4444", "#f97316"] },
  { id: "blue", name: "Blue Circuit", description: "Cool blue-indigo palette", swatch: ["#3b82f6", "#6366f1", "#8b5cf6"] },
];

const ThemeContext = createContext<ThemeContextType>({
  palette: "violet",
  mode: "dark",
  setPalette: () => {},
  toggleMode: () => {},
  palettes: defaultPalettes,
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getInitialMode(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("meshlink-mode");
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("meshlink-palette") || "violet" : "violet"
  );
  const [mode, setMode] = useState<"dark" | "light">(getInitialMode);

  const setPalette = (id: string) => {
    setPaletteState(id);
    localStorage.setItem("meshlink-palette", id);
  };

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("meshlink-mode", next);
      return next;
    });
  };

  // Apply dark class immediately to prevent flash
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ palette, mode, setPalette, toggleMode, palettes: defaultPalettes }}>
      {children}
    </ThemeContext.Provider>
  );
}
