import { describe, expect, it } from "vitest";

import { addDays, fmtDate, startOfWeek } from "@/lib/day-of-music/data";
import { stepMonth, stepWeek } from "@/lib/day-of-music/use-board-nav";

// The app shell's week stepping before it moved here, kept as the reference.
function oldStepWeek(cur: Date, dir: -1 | 1, split: boolean): Date {
  if (!split) return addDays(cur, 7 * dir);
  const ws = startOfWeek(cur);
  const weekEnd = addDays(ws, 6);
  const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
  const first = ws < monthStart ? monthStart : ws;
  const last = weekEnd > monthEnd ? monthEnd : weekEnd;
  return dir < 0 ? addDays(first, -1) : addDays(last, 1);
}

describe("stepWeek", () => {
  it("matches the shell's old stepping for every day of 2024–2027, both modes", () => {
    for (let d = new Date(2024, 0, 1); d.getFullYear() < 2028; d = addDays(d, 1)) {
      for (const split of [false, true]) {
        for (const dir of [-1, 1] as const) {
          expect(fmtDate(stepWeek(d, dir, split))).toBe(fmtDate(oldStepWeek(d, dir, split)));
        }
      }
    }
  });

  it("walks a month-straddling week one segment at a time when split", () => {
    // Mon 2026-06-29 … Sun 2026-07-05: June has Mon–Tue, July Wed–Sun.
    const june = new Date(2026, 5, 29);
    expect(fmtDate(stepWeek(june, 1, true))).toBe("2026-07-01");
    expect(fmtDate(stepWeek(new Date(2026, 6, 1), 1, true))).toBe("2026-07-06");
    expect(fmtDate(stepWeek(new Date(2026, 6, 1), -1, true))).toBe("2026-06-30");
    expect(fmtDate(stepWeek(june, 1, false))).toBe("2026-07-06");
  });
});

describe("stepMonth", () => {
  it("lands on the 1st, rolling the year", () => {
    expect(fmtDate(stepMonth(new Date(2026, 0, 31), -1))).toBe("2025-12-01");
    expect(fmtDate(stepMonth(new Date(2026, 11, 15), 1))).toBe("2027-01-01");
    expect(fmtDate(stepMonth(new Date(2026, 0, 31), 1))).toBe("2026-02-01");
  });
});
