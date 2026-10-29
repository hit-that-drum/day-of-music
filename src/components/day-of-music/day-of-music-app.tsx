// day-of-music-app.tsx — app shell for Day of Music.
// Wires theme tokens, week navigation, keyboard shortcuts, the Day Detail
// modal, and the Tweaks panel.

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { toast } from "sonner";

import { fmtDate, formatDisplayDate, parseDate, type Album } from "@/lib/day-of-music/data";
import { AESTHETICS, themeStyleVars } from "@/lib/day-of-music/appearance";
import { useCountry } from "@/lib/day-of-music/profile";
import { useT } from "@/lib/day-of-music/i18n";
import type { JournalAlbum } from "@/lib/day-of-music/journal";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { useActiveTheme } from "@/lib/day-of-music/themes";
import {
  isLocalStorageAvailable,
  makeSessionFlagStore,
  useStore,
} from "@/lib/day-of-music/local-store";
import { rememberTimeZone } from "@/lib/day-of-music/today";
import { useAuth } from "@/lib/day-of-music/auth-provider";
import { useBoardNav } from "@/lib/day-of-music/use-board-nav";
import { AddFlow, type NewEntry } from "@/components/day-of-music/add-flow";
import { IconButton } from "@/components/day-of-music/atoms";
import { BottomTabs } from "@/components/day-of-music/bottom-tabs";
import { DayDetail } from "@/components/day-of-music/day-detail";
import { MonthlyView } from "@/components/day-of-music/monthly-view";
import { ProfileStats } from "@/components/day-of-music/profile-stats";
import { ProfilePage } from "@/components/day-of-music/profile-page";
import { SearchView } from "@/components/day-of-music/search-view";
import { ShareCard } from "@/components/day-of-music/share-card";
import { MonthShareCard } from "@/components/day-of-music/month-share-card";
import { MoreSheet } from "@/components/day-of-music/more-sheet";
import { BestOfWeekModal } from "@/components/day-of-music/best-of-week-modal";
import { BestOfMonthModal } from "@/components/day-of-music/best-of-month-modal";
import { ThemeTabs } from "@/components/day-of-music/theme-tabs";
import { TopBar, type ScreenId } from "@/components/day-of-music/top-bar";
import { TweaksPanel } from "@/components/day-of-music/tweaks-panel";
import { setTweak, useTweaks } from "@/lib/day-of-music/tweaks";
import { WeeklyGrid } from "@/components/day-of-music/weekly-grid";

// "Today" is the listener's local calendar date, as YYYY-MM-DD. (The sample
// catalog covers Jan 5–18, 2026 — navigate back to that week to see the demo
// data.) The board can't just call new Date() while rendering: the server
// renders in its own zone (and a module-level constant here froze the date at
// module load, so a long-lived server served a stale day), while the browser
// disagreed with that HTML for part of every day — a hydration error on every
// fresh load. So the server passes the date it rendered with (`initialToday`,
// see app/week/page.tsx) and the client reads its own through this store, like
// tweaks: the server snapshot is what the HTML was built from, so hydration
// matches by construction, and the browser's date replaces it in a re-render
// right after hydration (after first paint) — a visible correction only when
// the two disagree. Cached like the old constant, so an open tab still doesn't
// roll over at midnight. A string, not a Date, so the snapshot keeps a stable
// identity across renders.
let localTodayKey: string | null = null;

function getLocalTodayKey(): string {
  if (localTodayKey === null) localTodayKey = fmtDate(new Date());
  return localTodayKey;
}

// Snapshot fns for the blocked-storage probe — module-level so their identity
// is stable across renders (useSyncExternalStore resubscribes when it changes).
// Whether storage works can't change within a page's life, so nothing to
// subscribe to; the server snapshot says "fine" to keep hydration stable.
const subscribeNever = () => () => {};
const getStorageBlocked = () => !isLocalStorageAvailable();
const getStorageBlockedServer = () => false;

// Phones show a one-line guest banner with a ✕; the dismissal lives in
// sessionStorage (per tab — guest edits already vanish on leave). Server
// snapshot is false, so SSR renders the banner and the client flips after mount.
const guestBannerDismissed = makeSessionFlagStore("dom.guestBanner.dismissed.v1");

// The overlay open over the board — one at a time: opening one replaces the
// other. Day Detail holds its slot and the album it opened on (not a copy):
// the album is read from the journal on every render, and a different album
// later logged on that date won't reopen it. The Add flow always opens on a
// day — an empty cell's, or the replaced entry's.
type Overlay =
  | { kind: "detail"; date: string; albumId: string }
  | { kind: "add"; date: string; /** Saving replaces this day's entry. */ replaceTarget?: string }
  | { kind: "share" | "monthShare" | "bestOf" | "bestOfMonth" | "more" };

export function DayOfMusicApp({
  initialToday,
}: {
  /** YYYY-MM-DD the server rendered the board for — the listener's zone when
   *  the tz cookie was present, otherwise the server's (see app/week/page.tsx). */
  initialToday: string;
}) {
  const { logAlbum, updateSlot, moveSlot, removeSlot, enrichSlot, albumsByDate } = useJournal();
  const { setActiveTheme } = useActiveTheme();
  const { configured, loading: authLoading, user, signOut } = useAuth();
  // Storefront country drives date formatting so every displayed date matches
  // the listener's locale (see formatDisplayDate).
  const country = useCountry();
  const t = useT();

  // Persisted across reloads via localStorage (see lib/day-of-music/tweaks.ts).
  const tweaks = useTweaks();
  // Server value during SSR + hydration, the browser's own date after mount
  // (see the store above). The server snapshot closes over the prop; only the
  // `subscribe` identity matters for resubscribing, so an inline arrow is fine.
  const todayKey = useSyncExternalStore(subscribeNever, getLocalTodayKey, () => initialToday);
  // As a Date — local midnight, like every day cell — for the cells' "is this
  // day in the future" comparison and the nav helpers. Memoised on the key so
  // everything derived from it keeps a stable identity.
  const today = useMemo(() => parseDate(todayKey), [todayKey]);
  const [screen, setScreen] = useState<ScreenId>("week");
  // The page on screen and ←/→ (see use-board-nav.ts).
  const { anchor, setAnchor, days, labelDate, prevWeek, nextWeek, prevMonth, nextMonth } =
    useBoardNav(today, tweaks.weekSplit);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  // Stable, for the modals' onClose (Modal re-registers its Esc listener on change).
  const closeOverlay = useCallback(() => setOverlay(null), []);
  // The Tweaks popover isn't a modal overlay: it sits beside the board.
  const [showTweaks, setShowTweaks] = useState(false);

  // Day Detail's album, read live from the journal: an edit, an enrichment or
  // a rolled-back write shows at once, and a slot emptied under it (another
  // device, a refetch) closes it rather than showing a stale copy.
  const slotAlbum = overlay?.kind === "detail" ? albumsByDate[overlay.date] : undefined;
  const openAlbum =
    overlay?.kind === "detail" && slotAlbum?.id === overlay.albumId ? slotAlbum : undefined;

  // Leave the browser's zone in a cookie so the next server render can start
  // from the listener's date instead of its own (no post-hydration correction).
  useEffect(() => {
    rememberTimeZone();
  }, []);

  // The chosen look, as the frame's inline CSS variables (see .dom-stage).
  const themeVars = useMemo(
    () => themeStyleVars(tweaks.aesthetic, tweaks.typography) as CSSProperties,
    [tweaks.aesthetic, tweaks.typography],
  );

  // Keyboard: ←/→ step the board when nothing is open over it. (Escape is each
  // overlay's own — see escape-layers.ts.)
  const overlayOpen = overlay !== null || showTweaks;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (overlayOpen) return;
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
  }, [overlayOpen, screen, prevWeek, nextWeek, prevMonth, nextMonth]);

  const handleOpen = useCallback(
    (album: Album | JournalAlbum) => {
      if ("theme" in album) setActiveTheme(album.theme);
      setOverlay({ kind: "detail", date: album.date, albumId: album.id });
    },
    [setActiveTheme],
  );

  // Drag-and-drop reschedule (onMove={moveSlot}): dropping onto an empty day
  // moves the album there; dropping onto a filled day swaps the two days.
  // moveSlot is a stable ref, so it's passed straight through (its Promise
  // result is ignored there). Day Detail's reschedule arrives via handleMove;
  // its edits and lazy enrichment go straight to updateSlot / enrichSlot, and
  // the open detail follows the journal (see openAlbum).

  const handleRemove = useCallback(
    (date: string) => {
      removeSlot(date);
      setOverlay(null);
      toast.success(t("toast.removed"));
    },
    [removeSlot, t],
  );

  // Reschedule from Day Detail. Same write path as drag-and-drop (moveSlot),
  // with feedback: the modal closes, the board follows the entry when a board
  // is showing, and the toast names where it went (a swap names the album that
  // took its place). moveSlot stages the cache synchronously (only its writes
  // queue behind earlier moves' writes) and resolves false only after a
  // rejected write restored the two slots.
  const handleMove = useCallback(
    (from: string, to: string) => {
      if (from === to) return;
      // The slot can vanish under an open modal (removed on another device, or
      // a refetch dropped it). Nothing to stage → report it, don't celebrate.
      if (!albumsByDate[from]) {
        setOverlay(null);
        toast.error(t("toast.moveFailed"));
        return;
      }
      const displaced = albumsByDate[to];
      const settled = moveSlot(from, to);
      // Closed, not left open on `from`: a swap puts another album there.
      setOverlay(null);
      if (screen === "week" || screen === "month") setAnchor(parseDate(to));
      const date = formatDisplayDate(to, country);
      toast.success(
        displaced
          ? t("toast.swapped", { title: displaced.title, date })
          : t("toast.moved", { date }),
      );
      void settled.then((ok) => {
        if (!ok) toast.error(t("toast.moveFailed"));
      });
    },
    [albumsByDate, moveSlot, screen, setAnchor, country, t],
  );

  // Day Detail's ← / →: show the entry logged on `date` instead. The board
  // under the modal follows (as after a move), so closing it lands on that
  // day's week or month.
  const handleNavigate = useCallback(
    (date: string) => {
      const album = albumsByDate[date];
      if (!album) return;
      setOverlay({ kind: "detail", date, albumId: album.id });
      if (screen === "week" || screen === "month") setAnchor(parseDate(date));
    },
    [albumsByDate, screen, setAnchor],
  );

  // Replace: reopen the add-flow on the same day. Logging the new album at that
  // date overwrites the slot, so no separate removal is needed.
  const handleReplace = useCallback((album: Album) => {
    setOverlay({ kind: "add", date: album.date, replaceTarget: album.date });
  }, []);

  // Open the Add flow on a day (an empty board cell). Not memoized: none of
  // the boards it's passed to is a memo component.
  const openAddFor = (date: string) => setOverlay({ kind: "add", date });

  // Set while the Add flow is replacing an entry (opened from Day Detail).
  const replaceTarget = overlay?.kind === "add" ? overlay.replaceTarget : undefined;

  const handleSave = useCallback(
    (entry: NewEntry) => {
      // Log the same album to every selected day (one album per day per theme)
      // in a single write.
      logAlbum(entry.album, { dates: entry.dates, rating: entry.rating, note: entry.note });
      // If replacing and the original day wasn't among the chosen ones, clear it.
      if (replaceTarget && !entry.dates.includes(replaceTarget)) removeSlot(replaceTarget);

      const count = entry.dates.length;
      const rating = entry.rating || "—";
      toast.success(t("toast.logged", { title: entry.album.title }), {
        description:
          count > 1
            ? t("toast.loggedDaysDesc", { count, rating })
            : t("toast.loggedDateDesc", {
                date: formatDisplayDate(entry.dates[0], country),
                rating,
              }),
      });
    },
    [logAlbum, replaceTarget, removeSlot, country, t],
  );

  // Everyone can use the board. Guests (configured auth, no session) work
  // in-memory only: their edits vanish when they leave the page.
  const isGuest = configured && !authLoading && !user;

  // Read the same way the stores themselves are read: the server snapshot says
  // "fine" so SSR matches, and the client re-renders to the probed answer after
  // mount. Whether storage works never changes within a page's life, so the
  // subscription is a no-op.
  const storageBlocked = useSyncExternalStore(
    subscribeNever,
    getStorageBlocked,
    getStorageBlockedServer,
  );

  // The signed-in account, for the top bar and the More sheet.
  const account = configured && user ? { email: user.email ?? "", onSignOut: signOut } : null;
  const guestDismissed = useStore(guestBannerDismissed);
  const showGuestBanner = isGuest && !guestDismissed;

  return (
    // Theme vars are applied to the stage so the modals (scrim/add-flow/share),
    // which render outside .dom-root, inherit them too.
    <div className="dom-stage" style={themeVars}>
      <div
        className="dom-root"
        data-grid={AESTHETICS[tweaks.aesthetic].tokens.gridShow ? "1" : "0"}
        // Number of in-flow banners above <main>, so the grid rows match.
        data-banners={String((showGuestBanner ? 1 : 0) + (storageBlocked ? 1 : 0))}
      >
        <TopBar
          screen={screen}
          onScreen={setScreen}
          onTweaks={() => setShowTweaks((v) => !v)}
          tweaksOpen={showTweaks}
          onMore={() => setOverlay({ kind: "more" })}
          moreOpen={overlay?.kind === "more"}
          account={account}
          showAuthLinks={isGuest}
        />

        {showGuestBanner && (
          <div className="dom-guest-banner" data-kind="guest" role="status">
            {/* Long copy on desktop, one-line short copy + ✕ on phones (CSS). */}
            <span className="dom-guest-banner-long">{t("guest.banner")}</span>
            <span className="dom-guest-banner-short">{t("guest.bannerShort")}</span>
            <Link href="/signup" className="dom-guest-banner-cta-long">
              {t("guest.signup")}
            </Link>
            <Link href="/signup" className="dom-guest-banner-cta-short">
              {t("actions.signUp")}
            </Link>
            <IconButton
              icon={X}
              iconSize={16}
              className="dom-guest-dismiss"
              onClick={() => guestBannerDismissed.set(true)}
              aria-label={t("modal.close")}
            />
          </div>
        )}

        {/* Blocked storage breaks the app in ways that look like unrelated bugs
            — signed out on every reload, and the board reset to the default
            lane so an existing journal reads as empty. Name the cause. */}
        {storageBlocked && (
          <div className="dom-guest-banner" data-kind="storage" role="alert">
            {t("storage.blocked")}
          </div>
        )}

        <main className="dom-main">
          {(screen === "week" || screen === "month") && <ThemeTabs />}
          {screen === "week" && (
            <WeeklyGrid
              days={days}
              labelDate={labelDate}
              splitByMonth={tweaks.weekSplit}
              today={today}
              onOpen={handleOpen}
              onAdd={openAddFor}
              onPrev={prevWeek}
              onNext={nextWeek}
              // Jump the week view to whatever date the user picks in the mini calendar.
              onJump={setAnchor}
              onShare={() => setOverlay({ kind: "share" })}
              onBestOf={() => setOverlay({ kind: "bestOf" })}
              onMove={moveSlot}
            />
          )}
          {screen === "month" && (
            <MonthlyView
              anchor={anchor}
              today={today}
              splitByMonth={tweaks.weekSplit}
              onOpen={handleOpen}
              onAdd={openAddFor}
              onPrev={prevMonth}
              onNext={nextMonth}
              onJump={setAnchor}
              onShare={() => setOverlay({ kind: "monthShare" })}
              onBestOf={() => setOverlay({ kind: "bestOfMonth" })}
              onMove={moveSlot}
            />
          )}
          {screen === "search" && <SearchView onOpen={handleOpen} />}
          {screen === "logs" && <ProfileStats />}
          {screen === "profile" && <ProfilePage />}
        </main>

        {/* Phone-only fixed tab bar (display:none on desktop). Inside .dom-root
            so the dom-reset layer reaches its buttons; position:fixed keeps it
            out of the grid flow. */}
        <BottomTabs screen={screen} onScreen={setScreen} />
      </div>

      {/* No key: stepping to another day's entry keeps the modal mounted —
          DayDetail keys its per-entry panel itself. */}
      {openAlbum && (
        <DayDetail
          album={openAlbum}
          today={today}
          onClose={closeOverlay}
          onUpdate={updateSlot}
          onMove={handleMove}
          onEnrich={enrichSlot}
          onRemove={handleRemove}
          onReplace={handleReplace}
          onNavigate={handleNavigate}
        />
      )}
      {overlay?.kind === "add" && (
        <AddFlow onClose={closeOverlay} onSave={handleSave} initialDate={overlay.date} />
      )}
      {overlay?.kind === "share" && (
        <ShareCard
          weekStart={labelDate}
          days={days}
          splitByMonth={tweaks.weekSplit}
          onClose={closeOverlay}
        />
      )}
      {overlay?.kind === "monthShare" && <MonthShareCard anchor={anchor} onClose={closeOverlay} />}
      {overlay?.kind === "bestOf" && (
        <BestOfWeekModal
          days={days}
          labelDate={labelDate}
          splitByMonth={tweaks.weekSplit}
          onClose={closeOverlay}
        />
      )}
      {overlay?.kind === "bestOfMonth" && (
        <BestOfMonthModal
          anchor={anchor}
          splitByMonth={tweaks.weekSplit}
          today={today}
          onClose={closeOverlay}
        />
      )}
      {overlay?.kind === "more" && (
        <MoreSheet
          onClose={closeOverlay}
          account={account}
          showAuthLinks={isGuest}
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
