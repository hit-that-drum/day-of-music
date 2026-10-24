import { describe, expect, it } from "vitest";

import type { Album } from "@/lib/day-of-music/data";
import {
  advance,
  createTourney,
  findSavedChampion,
  firstRound,
  monthWeekSegments,
  nextPow2,
  roundStage,
  segmentDays,
  weekContenders,
  type Contender,
  type Tourney,
} from "@/lib/day-of-music/best-of-bracket";

// Play a bracket to the end, the earlier seed (`a`) winning every match.
function playOut<T>(seeded: T[]): { champion: T; stages: string[] } {
  let tour: Tourney<T> = createTourney(seeded);
  const stages = [roundStage(tour)];
  for (;;) {
    const next = advance(tour, tour.matches[tour.mi].a);
    if (next.kind === "champion") return { champion: next.champion, stages };
    if (next.tour.round !== tour.round) stages.push(roundStage(next.tour));
    tour = next.tour;
  }
}

describe("firstRound", () => {
  it("pairs the leading seeds and gives the trailing ones byes", () => {
    expect(nextPow2(7)).toBe(8);
    expect(firstRound(["월", "화", "수", "목", "금", "토", "일"])).toEqual({
      matches: [
        { a: "월", b: "화" },
        { a: "수", b: "목" },
        { a: "금", b: "토" },
      ],
      byes: ["일"],
    });
    expect(firstRound(["a", "b", "c"])).toEqual({ matches: [{ a: "a", b: "b" }], byes: ["c"] });
  });
});

describe("advance", () => {
  it("plays a week of seven down to one champion, byes joining round two", () => {
    const { champion, stages } = playOut(["월", "화", "수", "목", "금", "토", "일"]);
    expect(champion).toBe("월");
    // 3 matches + 1 bye (7 entrants) → 4 → 2.
    expect(stages).toEqual(["round", "semifinal", "final"]);
  });

  it("names a round of one match and one bye a semifinal", () => {
    const { stages } = playOut(["a", "b", "c"]);
    expect(stages).toEqual(["semifinal", "final"]);
  });

  it("moves to the next match within a round before closing it", () => {
    const tour = createTourney(["a", "b", "c", "d"]);
    const next = advance(tour, "b");
    expect(next).toEqual({ kind: "next", tour: { ...tour, mi: 1, winners: ["b"] } });
  });
});

describe("the contender field", () => {
  const album = (id: string) => ({ id }) as Album;
  // Mon 2026-06-29 … Sun 2026-07-05: a week that straddles June and July.
  const days = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 29 + i));
  const albumsByDate = { "2026-06-30": album("tue"), "2026-07-02": album("thu") };

  it("keeps only the label month's days when split by month", () => {
    expect(segmentDays(days, new Date(2026, 6, 1), true)).toHaveLength(5);
    expect(segmentDays(days, new Date(2026, 5, 29), false)).toHaveLength(7);
    expect(weekContenders(days, albumsByDate, new Date(2026, 6, 1), true).map((c) => c.date)).toEqual([
      "2026-07-02",
    ]);
  });

  it("keys each month segment by its label day", () => {
    expect(monthWeekSegments(new Date(2026, 6, 15), true)[0].key).toBe("2026-07-01");
    expect(monthWeekSegments(new Date(2026, 6, 15), false)[0].key).toBe("2026-06-29");
  });

  it("counts a stored champion only while its day is still in the field", () => {
    const field: Contender[] = [{ date: "2026-07-02", album: album("thu") }];
    const saved = { winnerDate: "2026-07-02", method: "sequential" as const, decidedAt: "" };
    expect(findSavedChampion(saved, field)?.album.id).toBe("thu");
    expect(findSavedChampion({ ...saved, winnerDate: "2026-07-03" }, field)).toBeUndefined();
    expect(findSavedChampion(undefined, field)).toBeUndefined();
  });
});
