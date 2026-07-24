// week-picker.tsx — mini month calendar popover for jumping to a week.
// Opened from the weekly-view title. Selection is week-based: hovering a row
// highlights the whole Mon–Sun week, and clicking any day jumps to that week.

"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { ArrowLeft, ArrowRight } from "lucide-react";

import {
  DOW_KO,
  MONTHS_LONG,
  addDays,
  fmtDate,
  startOfWeek,
} from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { IconButton } from "@/components/day-of-music/atoms";

const DOW_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

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
  const [cursor, setCursor] = useState(() => dayjs(initialMonth).startOf("month"));

  // Close on Escape. Registered on the capture phase and stops propagation so
  // it closes only the picker — DayOfMusicApp's closeAll never fires while open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const { weeks, monthIndex } = useMemo(() => {
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

  const selectedKey = fmtDate(startOfWeek(selectedWeekStart));
  const todayKey = fmtDate(today);

  return (
    <>
      {/* Click-away backdrop. */}
      <div className="dom-wp-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="dom-wp" role="dialog" aria-label="Jump to a week">
        <div className="dom-wp-hd">
          <IconButton
            icon={ArrowLeft}
            iconSize={14}
            className="dom-wp-nav"
            onClick={() => setCursor((c) => c.subtract(1, "month"))}
            aria-label="Previous month"
          />
          <span className="dom-wp-title">
            {MONTHS_LONG[monthIndex]} {cursor.year()}
          </span>
          <IconButton
            icon={ArrowRight}
            iconSize={14}
            className="dom-wp-nav"
            onClick={() => setCursor((c) => c.add(1, "month"))}
            aria-label="Next month"
          />
        </div>

        <div className="dom-wp-dow">
          {DOW_LABELS.map((d, i) => (
            <span key={d} className="dom-wp-dow-cell">
              {d}
              <i className="dom-wp-dow-ko">{DOW_KO[(i + 1) % 7]}</i>
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
          Today · 오늘
        </button>
      </div>
    </>
  );
}
