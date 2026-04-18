import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import RegisterPage from "./pages/Register.tsx";
import NotFound from "./pages/NotFound.tsx";
import { ThemeProvider } from "./theme/ThemeProvider";
import { UserProfile, defaultProfile } from "@/data/mockData";
import { PlatformId } from "@/data/languages";

const queryClient = new QueryClient();

const REGISTERED_KEY = "meshlink-registered";
const PROFILE_KEY = "meshlink-profile";

function loadRegistered(): boolean {
  return localStorage.getItem(REGISTERED_KEY) === "true";
}

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return defaultProfile;
}

const App = () => {
  const [registered, setRegistered] = useState(loadRegistered);
  const [profile, setProfile] = useState<UserProfile>(loadProfile);

  const handleRegisterComplete = (newProfile: UserProfile, _lang: string, _platform: PlatformId | null) => {
    setProfile(newProfile);
    setRegistered(true);
    localStorage.setItem(REGISTERED_KEY, "true");
    localStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
  };

  // Persist profile changes from settings
  useEffect(() => {
    if (registered) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    }
  }, [profile, registered]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {registered ? (
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index initialProfile={profile} onProfileChange={setProfile} />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          ) : (
            <RegisterPage onComplete={handleRegisterComplete} />
          )}
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
