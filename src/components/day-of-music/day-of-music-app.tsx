// day-of-music-app.tsx — app shell for Day of Music.
// Wires theme tokens, week navigation, keyboard shortcuts, the Journal rail,
// the Day Detail modal, and the Tweaks panel. The Weekly Grid is the live screen;
// the other tabs are placeholders for now.

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";

import { addDays, fmtDate, formatDisplayDate, startOfWeek, type Album } from "@/lib/day-of-music/data";
import { applyTheme, ensureFonts } from "@/lib/day-of-music/theme";
import { useCountry } from "@/lib/day-of-music/profile";
import { useJournal, type JournalAlbum } from "@/lib/day-of-music/use-journal";
import { useActiveTheme } from "@/lib/day-of-music/themes";
import { useAuth } from "@/components/day-of-music/auth-provider";
import { AddFlow, type NewEntry } from "@/components/day-of-music/add-flow";
import { DayDetail } from "@/components/day-of-music/day-detail";
import { JournalRail } from "@/components/day-of-music/journal-rail";
import { MonthlyView } from "@/components/day-of-music/monthly-view";
import { ProfileStats } from "@/components/day-of-music/profile-stats";
import { ProfilePage } from "@/components/day-of-music/profile-page";
import { SearchView } from "@/components/day-of-music/search-view";
import { ShareCard } from "@/components/day-of-music/share-card";
import { MonthShareCard } from "@/components/day-of-music/month-share-card";
import { ThemeTabs } from "@/components/day-of-music/theme-tabs";
import { TopBar } from "@/components/day-of-music/top-bar";
import { TweaksPanel, type Tweaks } from "@/components/day-of-music/tweaks-panel";
import { WeeklyGrid } from "@/components/day-of-music/weekly-grid";

export type ScreenId = "week" | "month" | "search" | "logs" | "profile";

// Real current date. (The sample catalog covers Jan 5–18, 2026 — navigate back
// to that week to see the demo data.) Evaluated client-side per page load.
const TODAY = new Date();

// Tweaks are persisted client-side so the user's layout/theme choices survive
// reloads. Bump the version suffix if the Tweaks shape changes incompatibly.
const TWEAKS_KEY = "dom.tweaks.v1";

const DEFAULT_TWEAKS: Tweaks = {
  aesthetic: "editorial",
  typography: "editorial",
  showJournal: true,
  weekSplit: false,
};

function loadTweaks(): Tweaks {
  if (typeof window === "undefined") return DEFAULT_TWEAKS;
  try {
    const raw = window.localStorage.getItem(TWEAKS_KEY);
    if (!raw) return DEFAULT_TWEAKS;
    // Merge over defaults so older saved blobs missing newer keys still work.
    return { ...DEFAULT_TWEAKS, ...(JSON.parse(raw) as Partial<Tweaks>) };
  } catch {
    return DEFAULT_TWEAKS;
  }
}

// Tweaks live in a tiny external store so they can be read with
// useSyncExternalStore — that loads the persisted value on the client without
// a hydration mismatch (server renders defaults, client swaps in after mount)
// and avoids calling setState inside an effect.
let tweaksSnapshot: Tweaks | null = null;
const tweaksListeners = new Set<() => void>();

function getTweaksSnapshot(): Tweaks {
  if (tweaksSnapshot === null) tweaksSnapshot = loadTweaks();
  return tweaksSnapshot;
}

function getTweaksServerSnapshot(): Tweaks {
  return DEFAULT_TWEAKS;
}

function subscribeTweaks(cb: () => void): () => void {
  tweaksListeners.add(cb);
  return () => tweaksListeners.delete(cb);
}

function writeTweaks(next: Tweaks): void {
  tweaksSnapshot = next;
  try {
    window.localStorage.setItem(TWEAKS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode / quota) — ignore */
  }
  tweaksListeners.forEach((l) => l());
}

// First and last day of the anchor's Mon–Sun week that still belong to the
// anchor's month. Used by week nav in split mode to step just past the visible
// segment without materialising the whole 7-day array.
function monthSegmentBounds(anchor: Date): { first: Date; last: Date } {
  const ws = startOfWeek(anchor);
  const weekEnd = addDays(ws, 6);
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return {
    first: ws < monthStart ? monthStart : ws,
    last: weekEnd > monthEnd ? monthEnd : weekEnd,
  };
}

export function DayOfMusicApp() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { logAlbum, updateSlot, moveSlot, removeSlot, enrichSlot } = useJournal();
  const { setActiveTheme } = useActiveTheme();
  const { configured, loading: authLoading, user, signOut } = useAuth();
  // Storefront country drives date formatting so every displayed date matches
  // the listener's locale (see formatDisplayDate).
  const country = useCountry();

  // Persisted across reloads via localStorage (see the store helpers above).
  const tweaks = useSyncExternalStore(
    subscribeTweaks,
    getTweaksSnapshot,
    getTweaksServerSnapshot,
  );
  const [screen, setScreen] = useState<ScreenId>("week");
  // `anchor` is any day inside the currently-viewed page. The Monday-based
  // `weekStart` and the visible `days` are derived from it (see below).
  const [anchor, setAnchor] = useState<Date>(() => TODAY);
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  // When set, the add-flow opens with this date preselected (empty-day click).
  const [addDate, setAddDate] = useState<string | null>(null);
  // When set, saving the add-flow replaces (removes) this album's entry.
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showMonthShare, setShowMonthShare] = useState(false);
  const [showTweaks, setShowTweaks] = useState(false);

  // Single place that dismisses every overlay + resets the transient add/replace
  // state. Centralised so new overlays only have to be added here (and so the
  // Esc handler can't drift out of sync with the individual onClose handlers).
  const closeAll = useCallback(() => {
    setOpenAlbum(null);
    setShowAdd(false);
    setShowShare(false);
    setShowMonthShare(false);
    setShowTweaks(false);
    setReplaceTarget(null);
  }, []);

  const setTweak = useCallback(
    <K extends keyof Tweaks>(key: K, value: Tweaks[K]) =>
      writeTweaks({ ...getTweaksSnapshot(), [key]: value }),
    [],
  );

  useEffect(() => {
    ensureFonts();
  }, []);

  useEffect(() => {
    applyTheme(rootRef.current, tweaks.aesthetic, tweaks.typography);
  }, [tweaks.aesthetic, tweaks.typography]);

  // Monday of the anchor's ISO week, and the full Mon–Sun strip.
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const fullWeek = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // The grid always shows the whole Mon–Sun week (7 cells). In split mode the
  // cells belonging to the *other* month are blanked out by WeeklyGrid rather
  // than removed, so the 7-column layout stays intact.
  const days = fullWeek;

  // Days that belong to the page's month. In split mode that's the subset
  // matching the anchor's month; otherwise the whole week. Used for the label
  // and the share card so they reflect only the labelled month.
  const monthDays = useMemo(() => {
    if (!tweaks.weekSplit) return fullWeek;
    const m = anchor.getMonth();
    const y = anchor.getFullYear();
    return fullWeek.filter((d) => d.getMonth() === m && d.getFullYear() === y);
  }, [fullWeek, anchor, tweaks.weekSplit]);

  // The day whose month/week-number label the header shows: the first in-month
  // day in split mode, otherwise the week's Monday.
  const labelDate = monthDays[0] ?? weekStart;

  const prevWeek = useCallback(() => {
    setAnchor((a) =>
      // Step to the day before the current segment's first visible day.
      tweaks.weekSplit ? addDays(monthSegmentBounds(a).first, -1) : addDays(a, -7),
    );
  }, [tweaks.weekSplit]);

  const nextWeek = useCallback(() => {
    setAnchor((a) =>
      // Step to the day after the current segment's last visible day.
      tweaks.weekSplit ? addDays(monthSegmentBounds(a).last, 1) : addDays(a, 7),
    );
  }, [tweaks.weekSplit]);

  // Month nav (Monthly view). Anchor on the 1st of the target month; native
  // Date handles year rollover (month -1 / +12).
  const prevMonth = useCallback(() => {
    setAnchor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1));
  }, []);

  const nextMonth = useCallback(() => {
    setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1));
  }, []);

  // Keyboard nav: Esc closes modal; ←/→ change week when nothing is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (openAlbum || showAdd || showShare || showMonthShare || showTweaks) {
        if (e.key === "Escape") closeAll();
        return;
      }
      // ←/→ step the week on the Week board and the month on the Month view.
      if (screen === "week") {
        if (e.key === "ArrowLeft") prevWeek();
        if (e.key === "ArrowRight") nextWeek();
      } else if (screen === "month") {
        if (e.key === "ArrowLeft") prevMonth();
        if (e.key === "ArrowRight") nextMonth();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAlbum, showAdd, showShare, showMonthShare, showTweaks, screen, prevWeek, nextWeek, prevMonth, nextMonth, closeAll]);

  const handleOpen = useCallback(
    (album: Album | JournalAlbum) => {
      if ("theme" in album) setActiveTheme(album.theme);
      setOpenAlbum(album);
    },
    [setActiveTheme],
  );

  // Drag-and-drop reschedule (onMove={moveSlot}): dropping onto an empty day
  // moves the album there; dropping onto a filled day swaps the two days.
  // moveSlot is a stable ref, so it's passed straight through.

  // `date` identifies the slot. A patch carrying `date` is a reschedule (move);
  // otherwise it's a rating/note edit on the same slot.
  const handleUpdate = useCallback(
    (date: string, patch: Partial<Album>) => {
      if (patch.date && patch.date !== date) {
        moveSlot(date, patch.date);
      } else {
        updateSlot(date, patch);
      }
      setOpenAlbum((prev) => (prev && prev.date === date ? { ...prev, ...patch } : prev));
    },
    [moveSlot, updateSlot],
  );

  // Lazily-fetched album metadata (tracklist, release date) from iTunes Lookup.
  const handleEnrich = useCallback(
    (date: string, patch: Partial<Album>) => {
      enrichSlot(date, patch);
      setOpenAlbum((prev) => (prev && prev.date === date ? { ...prev, ...patch } : prev));
    },
    [enrichSlot],
  );

  const handleRemove = useCallback(
    (date: string) => {
      removeSlot(date);
      setOpenAlbum(null);
      toast.success("Removed from your journal");
    },
    [removeSlot],
  );

  // Replace: reopen the add-flow on the same day. Logging the new album at that
  // date overwrites the slot, so no separate removal is needed.
  const handleReplace = useCallback((album: Album) => {
    setOpenAlbum(null);
    setAddDate(album.date);
    setReplaceTarget(album.date);
    setShowAdd(true);
  }, []);

  const handleSave = useCallback(
    (entry: NewEntry) => {
      // Log the same album to every selected day (one album per day per theme).
      for (const date of entry.dates) {
        logAlbum(entry.album, {
          date,
          rating: entry.rating,
          note: entry.note,
        });
      }
      // If replacing and the original day wasn't among the chosen ones, clear it.
      if (replaceTarget && !entry.dates.includes(replaceTarget)) removeSlot(replaceTarget);
      setReplaceTarget(null);

      const count = entry.dates.length;
      toast.success(`Logged ${entry.album.title}`, {
        description:
          count > 1
            ? `${count} days · ${entry.rating || "—"}★`
            : `${formatDisplayDate(entry.dates[0], country)} · ${entry.rating || "—"}★`,
      });
    },
    [logAlbum, replaceTarget, removeSlot, country],
  );

  // Everyone can use the board. Guests (configured auth, no session) work
  // in-memory only: their edits vanish when they leave the page.
  const isGuest = configured && !authLoading && !user;

  return (
    // Theme vars are applied to the stage so the modals (scrim/add-flow/share),
    // which render outside .dom-root, inherit them too.
    <div className="dom-stage" ref={rootRef}>
      <div
        className="dom-root"
        data-grid={tweaks.aesthetic === "editorial" || tweaks.aesthetic === "dark" ? "1" : "0"}
        data-rail={screen === "week" && tweaks.showJournal ? "1" : "0"}
      >
        <TopBar
          screen={screen}
          onScreen={setScreen}
          onTweaks={() => setShowTweaks((v) => !v)}
          account={configured && user ? { email: user.email ?? "", onSignOut: signOut } : null}
          showAuthLinks={isGuest}
        />

        {isGuest && (
          <div className="dom-guest-banner" role="status">
            Guest mode — your edits live only in this tab and reset when you leave.{" "}
            <a href="/signup">Sign up to keep your journal</a>.
          </div>
        )}

        <main className="dom-main">
          {(screen === "week" || screen === "month") && <ThemeTabs />}
          {screen === "week" && (
            <WeeklyGrid
              days={days}
              labelDate={labelDate}
              splitByMonth={tweaks.weekSplit}
              today={TODAY}
              onOpen={handleOpen}
              onAdd={(date) => {
                setAddDate(date);
                setShowAdd(true);
              }}
              onPrev={prevWeek}
              onNext={nextWeek}
              // Jump the week view to whatever date the user picks in the mini calendar.
              onJump={setAnchor}
              onShare={() => setShowShare(true)}
              onMove={moveSlot}
            />
          )}
          {screen === "month" && (
            <MonthlyView
              anchor={anchor}
              today={TODAY}
              onOpen={handleOpen}
              onAdd={(date) => {
                setAddDate(date);
                setShowAdd(true);
              }}
              onPrev={prevMonth}
              onNext={nextMonth}
              onJump={setAnchor}
              onShare={() => setShowMonthShare(true)}
              onMove={moveSlot}
            />
          )}
          {screen === "search" && <SearchView onOpen={handleOpen} />}
          {screen === "logs" && <ProfileStats onOpen={handleOpen} />}
          {screen === "profile" && <ProfilePage />}
        </main>

        {screen === "week" && tweaks.showJournal && (
          <JournalRail today={TODAY} onOpen={handleOpen} />
        )}
      </div>

      {openAlbum && (
        <DayDetail
          album={openAlbum}
          onClose={() => setOpenAlbum(null)}
          onUpdate={handleUpdate}
          onEnrich={handleEnrich}
          onRemove={handleRemove}
          onReplace={handleReplace}
        />
      )}
      {showAdd && (
        <AddFlow
          onClose={() => {
            setShowAdd(false);
            setReplaceTarget(null);
          }}
          onSave={handleSave}
          defaultWeekStart={weekStart}
          // Clicked day wins; otherwise preselect today when it's in view.
          defaultDate={
            addDate ??
            (days.some((d) => fmtDate(d) === fmtDate(TODAY)) ? fmtDate(TODAY) : undefined)
          }
        />
      )}
      {showShare && (
        <ShareCard
          weekStart={labelDate}
          days={days}
          splitByMonth={tweaks.weekSplit}
          today={TODAY}
          onClose={() => setShowShare(false)}
        />
      )}
      {showMonthShare && (
        <MonthShareCard
          anchor={anchor}
          today={TODAY}
          onClose={() => setShowMonthShare(false)}
        />
      )}

      <TweaksPanel
        open={showTweaks}
        onClose={() => setShowTweaks(false)}
        tweaks={tweaks}
        onChange={setTweak}
      />
    </div>
  );
}
