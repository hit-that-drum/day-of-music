// day-of-music-app.tsx — app shell for Day of Music.
// Wires theme tokens, week navigation, keyboard shortcuts, the Journal rail,
// the Day Detail modal, and the Tweaks panel. The Weekly Grid is the live screen;
// the other tabs are placeholders for now.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { addDays, startOfWeek, type Album } from "@/lib/day-of-music/data";
import { applyTheme, ensureFonts } from "@/lib/day-of-music/theme";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { useAuth } from "@/components/day-of-music/auth-provider";
import { SignIn } from "@/components/day-of-music/sign-in";
import { AddFlow, type NewEntry } from "@/components/day-of-music/add-flow";
import { DayDetail } from "@/components/day-of-music/day-detail";
import { JournalRail } from "@/components/day-of-music/journal-rail";
import { MonthlyView } from "@/components/day-of-music/monthly-view";
import { ProfileStats } from "@/components/day-of-music/profile-stats";
import { SearchView } from "@/components/day-of-music/search-view";
import { ShareCard } from "@/components/day-of-music/share-card";
import { TopBar } from "@/components/day-of-music/top-bar";
import { TweaksPanel, type Tweaks } from "@/components/day-of-music/tweaks-panel";
import { WeeklyGrid } from "@/components/day-of-music/weekly-grid";

export type ScreenId = "week" | "month" | "search" | "profile";

// The sample dataset covers Jan 5–18, 2026, so — like the reference prototype —
// "today" is pinned to Jan 8, 2026 and the view opens on that week. Swap these for
// `new Date()` / `startOfWeek(new Date())` once real journal data is wired up.
const TODAY = new Date(2026, 0, 8);

export function DayOfMusicApp() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { logEntry, addAlbum, updateEntry, getAlbum } = useJournal();
  const { configured, loading: authLoading, user, signOut } = useAuth();

  const [tweaks, setTweaks] = useState<Tweaks>({
    aesthetic: "editorial",
    typography: "editorial",
    showJournal: true,
  });
  const [screen, setScreen] = useState<ScreenId>("week");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(2026, 0, 5)));
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const setTweak = useCallback(
    <K extends keyof Tweaks>(key: K, value: Tweaks[K]) =>
      setTweaks((prev) => ({ ...prev, [key]: value })),
    [],
  );

  useEffect(() => {
    ensureFonts();
  }, []);

  useEffect(() => {
    applyTheme(rootRef.current, tweaks.aesthetic, tweaks.typography);
  }, [tweaks.aesthetic, tweaks.typography]);

  const prevWeek = useCallback(() => setWeekStart((w) => addDays(w, -7)), []);
  const nextWeek = useCallback(() => setWeekStart((w) => addDays(w, 7)), []);

  // Keyboard nav: Esc closes modal; ←/→ change week when nothing is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (openAlbum || showAdd || showShare) {
        if (e.key === "Escape") {
          setOpenAlbum(null);
          setShowAdd(false);
          setShowShare(false);
        }
        return;
      }
      if (screen !== "week") return;
      if (e.key === "ArrowLeft") prevWeek();
      if (e.key === "ArrowRight") nextWeek();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAlbum, showAdd, showShare, screen, prevWeek, nextWeek]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const handleOpen = useCallback((album: Album) => setOpenAlbum(album), []);

  const handleUpdate = useCallback(
    (id: string, patch: Partial<Album>) => {
      updateEntry(id, patch);
      setOpenAlbum((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    },
    [updateEntry],
  );

  const handleSave = useCallback(
    (entry: NewEntry) => {
      if (entry.album) {
        // Album came from music search — add it to the journal's catalog.
        addAlbum(entry.album, {
          date: entry.date,
          rating: entry.rating,
          note: entry.note,
        });
      } else {
        logEntry({
          albumId: entry.id,
          date: entry.date,
          rating: entry.rating,
          note: entry.note,
        });
      }
      const title = entry.album?.title ?? getAlbum(entry.id)?.title;
      toast.success(`Logged ${title ?? "album"}`, {
        description: `${entry.date} · ${entry.rating || "—"}★`,
      });
    },
    [logEntry, addAlbum, getAlbum],
  );

  // Auth gate: when Supabase is configured, require a session. (When it isn't,
  // the app runs as a single shared journal.)
  if (configured && !authLoading && !user) {
    return <SignIn />;
  }

  return (
    <div className="dom-stage">
      <div
        className="dom-root"
        ref={rootRef}
        data-grid={tweaks.aesthetic === "editorial" || tweaks.aesthetic === "dark" ? "1" : "0"}
        data-rail={screen === "week" && tweaks.showJournal ? "1" : "0"}
      >
        <TopBar
          screen={screen}
          onScreen={setScreen}
          onAdd={() => setShowAdd(true)}
          account={configured && user ? { email: user.email ?? "", onSignOut: signOut } : null}
        />

        <main className="dom-main">
          {screen === "week" && (
            <WeeklyGrid
              days={days}
              weekStart={weekStart}
              today={TODAY}
              onOpen={handleOpen}
              onPrev={prevWeek}
              onNext={nextWeek}
              onShare={() => setShowShare(true)}
            />
          )}
          {screen === "month" && <MonthlyView today={TODAY} onOpen={handleOpen} />}
          {screen === "search" && <SearchView onOpen={handleOpen} />}
          {screen === "profile" && <ProfileStats onOpen={handleOpen} />}
        </main>

        {screen === "week" && tweaks.showJournal && (
          <JournalRail today={TODAY} onOpen={handleOpen} />
        )}
      </div>

      {openAlbum && (
        <DayDetail album={openAlbum} onClose={() => setOpenAlbum(null)} onUpdate={handleUpdate} />
      )}
      {showAdd && <AddFlow onClose={() => setShowAdd(false)} onSave={handleSave} />}
      {showShare && (
        <ShareCard weekStart={weekStart} days={days} onClose={() => setShowShare(false)} />
      )}

      <TweaksPanel tweaks={tweaks} onChange={setTweak} />
    </div>
  );
}
