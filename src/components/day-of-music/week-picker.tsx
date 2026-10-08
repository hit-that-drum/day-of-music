// week-picker.tsx — mini month calendar popover for jumping to a week.
// Opened from the weekly-view title. Selection is week-based: hovering a row
// highlights the whole Mon–Sun week, and clicking any day jumps to that week.
// Also exports DayPicker (the same calendar in day-selection mode, rendered
// inline under Day Detail's "Logged on" field on phones) and SwapConfirm.

"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { ArrowLeft, ArrowRight } from "lucide-react";

import {
  DOW_KO,
  MONTHS_LONG,
  addDays,
  fmtDate,
  formatDisplayDate,
  parseDate,
  startOfWeek,
} from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { useCountry } from "@/lib/day-of-music/profile";
import { useDateNames, useT } from "@/lib/day-of-music/i18n";
import { isPhoneViewport } from "@/lib/day-of-music/phone";
import { Button, IconButton } from "@/components/day-of-music/atoms";

const DOW_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

// Esc closes only the innermost picker: capture phase + stopPropagation so the
// Modal's bubble-phase listener (modal.tsx) and DayOfMusicApp's closeAll never
// see the event while a picker is open.
function useCapturedEscape(onEscape: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscape();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onEscape]);
}

// Mon-first week rows covering the cursor's month (moved verbatim out of WeekPicker).
function useMonthWeeks(cursor: dayjs.Dayjs) {
  return useMemo(() => {
    const monthIndex = cursor.month();
    const calStart = startOfWeek(cursor.startOf("month").toDate());
    const lastOfMonth = cursor.endOf("month");
    // +1: diff is exclusive of the end day, so add it back to count the last day.
    const numWeeks = Math.ceil((lastOfMonth.diff(dayjs(calStart), "day") + 1) / 7);
    const weeks: Date[][] = Array.from({ length: numWeeks }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(calStart, w * 7 + d)),
    );
    return { weeks, monthIndex };
  }, [cursor]);
}

export function WeekPicker({
  initialMonth,
  selectedWeekStart,
  today,
  onPick,
  onClose,
}: {
  /** Month shown when the picker first opens. */
  initialMonth: Date;
  /** Monday of the week currently in view — highlighted as active. */
  selectedWeekStart: Date;
  today: Date;
  onPick: (date: Date) => void;
  onClose: () => void;
}) {
  const { albumsByDate } = useJournal();
  const t = useT();
  const names = useDateNames();
  // Localized weekday row for the phone sheet; desktop keeps the legacy EN/KO
  // labels (both are rendered, CSS shows one per breakpoint).
  const dowLoc = names.weekdayRowMonFirst();
  const wpRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(() => dayjs(initialMonth).startOf("month"));

  // Phone sheet: focus the dialog on open (its outline is suppressed in the
  // ≤760 block). Desktop keeps main's behaviour — focus stays on the title ▾,
  // so the popover never carries the UA :focus-visible ring. Both widths
  // return focus to the opener on close. Refs and matchMedia are read inside
  // the effect only (react-hooks/refs; no window read during render).
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    if (isPhoneViewport()) wpRef.current?.focus();
    return () => prev?.focus();
  }, []);

  // Close on Escape (capture + stopPropagation — see useCapturedEscape).
  useCapturedEscape(onClose);

  const { weeks, monthIndex } = useMonthWeeks(cursor);

  const selectedKey = fmtDate(startOfWeek(selectedWeekStart));
  const todayKey = fmtDate(today);

  return (
    <>
      {/* Click-away backdrop. */}
      <div className="dom-wp-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="dom-wp"
        data-mode="week"
        role="dialog"
        aria-label={t("week.jumpTitle")}
        ref={wpRef}
        tabIndex={-1}
      >
        <div className="dom-wp-hd">
          <IconButton
            icon={ArrowLeft}
            iconSize={14}
            className="dom-wp-nav"
            onClick={() => setCursor((c) => c.subtract(1, "month"))}
            aria-label={t("aria.prevMonth")}
          />
          <span className="dom-wp-title">
            <span className="dom-wp-legacy">
              {MONTHS_LONG[monthIndex]} {cursor.year()}
            </span>
            <span className="dom-wp-loc">
              {names.monthLong(monthIndex)} {cursor.year()}
            </span>
          </span>
          <IconButton
            icon={ArrowRight}
            iconSize={14}
            className="dom-wp-nav"
            onClick={() => setCursor((c) => c.add(1, "month"))}
            aria-label={t("aria.nextMonth")}
          />
        </div>

        <div className="dom-wp-dow">
          {DOW_LABELS.map((d, i) => (
            <span key={d} className="dom-wp-dow-cell">
              <span className="dom-wp-legacy">
                {d}
                <i className="dom-wp-dow-ko">{DOW_KO[(i + 1) % 7]}</i>
              </span>
              <span className="dom-wp-loc">{dowLoc[i]}</span>
            </span>
          ))}
        </div>

        <div className="dom-wp-grid">
          {weeks.map((week) => {
            const isActiveWeek = fmtDate(week[0]) === selectedKey;
            return (
              <div
                key={fmtDate(week[0])}
                className="dom-wp-row"
                data-active={isActiveWeek ? "1" : "0"}
              >
                {week.map((d) => {
                  const key = fmtDate(d);
                  return (
                    <button
                      key={key}
                      className="dom-wp-day"
                      data-inmonth={d.getMonth() === monthIndex ? "1" : "0"}
                      data-today={key === todayKey ? "1" : "0"}
                      data-logged={albumsByDate[key] ? "1" : "0"}
                      onClick={() => {
                        onPick(d);
                        onClose();
                      }}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <button
          className="dom-wp-today-btn"
          onClick={() => {
            onPick(today);
            onClose();
          }}
        >
          <span className="dom-wp-legacy">Today · 오늘</span>
          <span className="dom-wp-loc">{t("common.today")}</span>
        </button>
      </div>
    </>
  );
}

// SwapConfirm — "that day already has 〈X〉; swap?" row. Used in DayPicker's
// footer (phones) and under Day Detail's native date input (desktop) so both
// paths ask the same question. `date` arrives pre-formatted (storefront).
export function SwapConfirm({
  id,
  title,
  date,
  onSwap,
  onCancel,
}: {
  id: string;
  title: string;
  date: string;
  onSwap: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <span className="dom-confirm dom-swap-confirm">
      <span id={id} className="dom-confirm-q" role="status">
        {t("daydetail.swapConfirm", { title, date })}
      </span>
      <Button size="sm" aria-describedby={id} onClick={onSwap}>
        {t("action.swap")}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        {t("action.cancel")}
      </Button>
    </span>
  );
}

// DayPicker — the same mini calendar in day-selection mode, rendered INLINE
// (no backdrop, static position) under Day Detail's "Logged on" field on
// phones. Picks one target date for a move; a logged target asks before
// swapping. Future days are blocked (matches the Add flow); the entry's own
// day is always enabled so it stays focusable.
//
// Accepted edge: if the viewport is resized across 760px while this picker is
// open, the now-hidden picker keeps its Esc capture until it is closed.
export function DayPicker({
  id,
  selectedDate,
  today,
  focusOnOpen = false,
  onPick,
  onClose,
}: {
  id?: string;
  /** YYYY-MM-DD of the entry being moved — the grid opens on its month. */
  selectedDate: string;
  today: Date;
  /** Move focus onto the entry's own day on mount (keyboard-activated trigger). */
  focusOnOpen?: boolean;
  /** Called once the move is settled by the user (empty day: at once; logged day: after Swap). */
  onPick: (date: string) => void;
  /** Cancel / Esc / tapping the entry's own date. The caller returns focus to its trigger. */
  onClose: () => void;
}) {
  const { albumsByDate } = useJournal();
  const t = useT();
  const names = useDateNames();
  const country = useCountry();
  const confirmId = useId();
  const [cursor, setCursor] = useState(() => dayjs(parseDate(selectedDate)).startOf("month"));
  const [pendingSwap, setPendingSwap] = useState<{ date: string; title: string } | null>(null);
  // Roving-tabindex target; kept in sync with real focus via onFocus below.
  const [focusKey, setFocusKey] = useState(selectedDate);
  const gridRef = useRef<HTMLDivElement>(null);
  // Programmatic focus happens only on explicit intent (keyboard moves, Today,
  // cancel-swap, keyboard-opened picker) — never on a month-arrow click.
  const wantFocus = useRef(focusOnOpen);

  const todayKey = fmtDate(today);
  const isBlocked = (key: string) => key > todayKey && key !== selectedDate; // YYYY-MM-DD sorts lexically

  const focusDay = useCallback((key: string) => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${key}"]`)?.focus();
  }, []);

  const onEscape = useCallback(() => {
    if (pendingSwap) {
      setPendingSwap(null);
      focusDay(pendingSwap.date);
    } else {
      onClose();
    }
  }, [pendingSwap, onClose, focusDay]);
  useCapturedEscape(onEscape);

  const { weeks, monthIndex } = useMonthWeeks(cursor);
  const visibleKeys = useMemo(() => weeks.flat().map(fmtDate), [weeks]);
  // Exactly one day is tabbable: the focused day if visible and enabled, else
  // the entry's own day, else the first enabled visible day.
  const tabKey =
    visibleKeys.includes(focusKey) && !isBlocked(focusKey)
      ? focusKey
      : visibleKeys.includes(selectedDate)
        ? selectedDate
        : (visibleKeys.find((k) => !isBlocked(k)) ?? "");
  const nextMonthBlocked = cursor.add(1, "month").startOf("month").isAfter(dayjs(today), "day");

  // Apply pending focus intent after the target button exists (cursor is a dep
  // because PageUp/PageDown and Today can change the month and the key together).
  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusKey}"]`)?.focus();
  }, [focusKey, cursor]);

  function pick(key: string) {
    if (key === selectedDate) return onClose();
    const other = albumsByDate[key];
    if (other) setPendingSwap({ date: key, title: other.title });
    else onPick(key);
  }

  function onGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const cur = parseDate(focusKey);
    let next: Date;
    switch (e.key) {
      case "ArrowLeft":
        next = addDays(cur, -1);
        break;
      case "ArrowRight":
        next = addDays(cur, 1);
        break;
      case "ArrowUp":
        next = addDays(cur, -7);
        break;
      case "ArrowDown":
        next = addDays(cur, 7);
        break;
      case "Home":
        next = startOfWeek(cur);
        break;
      case "End":
        next = addDays(startOfWeek(cur), 6);
        break;
      case "PageUp":
        next = dayjs(cur).subtract(1, "month").toDate();
        break;
      case "PageDown":
        next = dayjs(cur).add(1, "month").toDate();
        break;
      default:
        return;
    }
    e.preventDefault();
    const key = fmtDate(next);
    if (isBlocked(key)) return; // never land on a disabled day
    wantFocus.current = true;
    setFocusKey(key);
    if (!visibleKeys.includes(key)) setCursor(dayjs(next).startOf("month"));
  }

  return (
    <div className="dom-wp" data-mode="day" id={id} role="group" aria-label={t("aria.pickDate")}>
      <div className="dom-wp-hd">
        <IconButton
          icon={ArrowLeft}
          iconSize={14}
          className="dom-wp-nav"
          onClick={() => setCursor((c) => c.subtract(1, "month"))}
          aria-label={t("aria.prevMonth")}
        />
        <span className="dom-wp-title" aria-live="polite">
          {cursor.year()} · {names.monthLong(monthIndex)}
        </span>
        <IconButton
          icon={ArrowRight}
          iconSize={14}
          className="dom-wp-nav"
          disabled={nextMonthBlocked}
          onClick={() => setCursor((c) => c.add(1, "month"))}
          aria-label={t("aria.nextMonth")}
        />
      </div>

      {/* Decorative: every day button carries its own date in aria-label. */}
      <div className="dom-wp-dow" aria-hidden="true">
        {names.weekdayRowMonFirst().map((d) => (
          <span key={d} className="dom-wp-dow-cell">
            {d}
          </span>
        ))}
      </div>

      <div className="dom-wp-grid" ref={gridRef} onKeyDown={onGridKeyDown}>
        {weeks.map((week) => (
          <div key={fmtDate(week[0])} className="dom-wp-row">
            {week.map((d) => {
              const key = fmtDate(d);
              const logged = albumsByDate[key];
              const blocked = isBlocked(key);
              // UI-locale date so AT hears what the header shows ("10월 5일, 일").
              const label = `${names.monthDayShort(d)}, ${names.weekdayShort(d)}`;
              return (
                <button
                  key={key}
                  type="button"
                  className="dom-wp-day"
                  data-date={key}
                  data-inmonth={d.getMonth() === monthIndex ? "1" : "0"}
                  data-today={key === todayKey ? "1" : "0"}
                  data-logged={logged ? "1" : "0"}
                  aria-pressed={key === selectedDate}
                  aria-current={key === todayKey ? "date" : undefined}
                  aria-label={logged ? t("aria.dayLogged", { date: label, title: logged.title }) : label}
                  disabled={blocked}
                  tabIndex={key === tabKey ? 0 : -1}
                  onFocus={() => setFocusKey(key)}
                  onClick={() => pick(key)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="dom-wp-foot">
        {pendingSwap ? (
          <SwapConfirm
            id={confirmId}
            title={pendingSwap.title}
            date={formatDisplayDate(pendingSwap.date, country)}
            onSwap={() => onPick(pendingSwap.date)}
            onCancel={() => {
              const back = pendingSwap.date;
              setPendingSwap(null);
              focusDay(back);
            }}
          />
        ) : (
          <>
            <button
              type="button"
              className="dom-wp-jump-today"
              onClick={() => {
                wantFocus.current = true;
                setCursor(dayjs(today).startOf("month"));
                setFocusKey(todayKey);
              }}
            >
              {t("common.today")}
            </button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t("action.cancel")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
