// best-of-modal.tsx — the tournament UI shared by every "Best of …" period.
// Given a field of contending days it runs a single-elimination bracket (two
// seedings: sequential day order, or random), persists the champion under the
// caller's period key (latest wins), and offers it as a saveable poster.
//
// Only the field, the labels and the storage key differ between periods, so
// Best of Week (the days of one week) and Best of Month (that month's weekly
// champions) are both thin wrappers around this. The dom-bow-* class names are
// the tournament's, not the week's.

"use client";

import { useEffect, useRef, useState } from "react";

import { DOW, DOW_KO, parseDate } from "@/lib/day-of-music/data";
import { useThemes, useActiveTheme } from "@/lib/day-of-music/themes";
import { DEFAULT_USERNAME, useProfile } from "@/lib/day-of-music/profile";
import { useT } from "@/lib/day-of-music/i18n";
import {
  firstRound,
  pairWinners,
  shuffle,
  useBestOf,
  type BestOfMethod,
  type Contender,
  type Match,
} from "@/lib/day-of-music/best-of";
import { saveCardAsImage } from "@/lib/day-of-music/save-card";
import { Button, Stars } from "@/components/day-of-music/atoms";
import { Cover } from "@/components/day-of-music/cover";
import { Modal } from "@/components/day-of-music/modal";

type Tourney = {
  round: number;
  matches: Match<Contender>[];
  /** Byes to append after this round's winners (round 1 only). */
  byes: Contender[];
  mi: number; // current match index within `matches`
  winners: Contender[]; // winners chosen so far this round
};

type State =
  | { phase: "empty" }
  | { phase: "options" }
  | { phase: "play"; method: BestOfMethod; tour: Tourney }
  | { phase: "champion"; champion: Contender; method: BestOfMethod | null; saved: boolean };

export function BestOfModal({
  contenders,
  storeKey,
  title,
  periodLabel,
  championKicker,
  emptyText,
  emptyHint,
  fileName,
  onClose,
}: {
  /** The field, in seeding order. */
  contenders: Contender[];
  /** Where the champion is persisted — see bestOfKey. */
  storeKey: string;
  /** Modal label + kicker, e.g. "Best of Week". */
  title: string;
  /** The period being judged, e.g. "August · Week 2" or "August 2026". */
  periodLabel: string;
  /** Kicker on the champion poster. */
  championKicker: string;
  /** Shown when there is nothing to judge. */
  emptyText: string;
  emptyHint: string;
  /** Download name for the champion poster. */
  fileName: string;
  onClose: () => void;
}) {
  const t = useT();
  const { themes } = useThemes();
  const { activeTheme } = useActiveTheme();
  const { username } = useProfile();
  const bestOf = useBestOf();
  const posterRef = useRef<HTMLDivElement>(null);

  const activeThemeObj = themes.find((x) => x.id === activeTheme) ?? themes[0];
  const themeLabel = `${activeThemeObj?.emoji ?? "🎧"} ${activeThemeObj?.name ?? "Daily"}`;
  const handle = username.trim() || DEFAULT_USERNAME;

  // Snapshot the starting phase at mount (the modal only mounts when opened):
  // a saved result → show it; 0 contenders → empty; 1 → auto-champion; else pick.
  const [state, setState] = useState<State>(() => {
    const saved = bestOf.get(storeKey);
    const savedWinner = saved && contenders.find((c) => c.date === saved.winnerDate);
    if (saved && savedWinner) {
      return { phase: "champion", champion: savedWinner, method: saved.method, saved: true };
    }
    if (contenders.length === 0) return { phase: "empty" };
    if (contenders.length === 1) {
      return { phase: "champion", champion: contenders[0], method: null, saved: false };
    }
    return { phase: "options" };
  });

  // Persist a freshly-decided champion (skips the already-saved case). Covers
  // the N=1 auto-champion (mount) and, via `state`, guards against re-writes.
  const persistedRef = useRef(false);
  useEffect(() => {
    if (state.phase !== "champion" || state.saved || persistedRef.current) return;
    persistedRef.current = true;
    bestOf.set(storeKey, {
      winnerDate: state.champion.date,
      method: state.method ?? "sequential",
      decidedAt: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  function start(method: BestOfMethod) {
    const seeded = method === "random" ? shuffle(contenders) : contenders;
    const { matches, byes } = firstRound(seeded);
    setState({ phase: "play", method, tour: { round: 1, matches, byes, mi: 0, winners: [] } });
  }

  function pick(winner: Contender) {
    if (state.phase !== "play") return;
    const { round, matches, byes, mi, winners } = state.tour;
    const nextWinners = [...winners, winner];

    // More matches left in this round → advance to the next match.
    if (mi + 1 < matches.length) {
      setState({ ...state, tour: { ...state.tour, mi: mi + 1, winners: nextWinners } });
      return;
    }

    // Round complete: winners then byes advance (byes trail, so the last seed
    // meets the last winner).
    const advancing = [...nextWinners, ...byes];
    if (advancing.length === 1) {
      const champ = advancing[0];
      persistedRef.current = true;
      bestOf.set(storeKey, {
        winnerDate: champ.date,
        method: state.method,
        decidedAt: new Date().toISOString(),
      });
      setState({ phase: "champion", champion: champ, method: state.method, saved: true });
      return;
    }
    setState({
      phase: "play",
      method: state.method,
      tour: { round: round + 1, matches: pairWinners(advancing), byes: [], mi: 0, winners: [] },
    });
  }

  function redo() {
    if (contenders.length <= 1) return;
    persistedRef.current = false;
    setState({ phase: "options" });
  }

  function handleSaveImage() {
    if (!posterRef.current) return;
    void saveCardAsImage(posterRef.current, fileName);
  }

  // Name the round by how many contenders enter it (byes included), so a round
  // with a bye is labelled by its true stage — e.g. 1 match + 1 bye = 3 entrants
  // is a semifinal, not a "final".
  const roundName = (tour: Tourney): string => {
    const entrants = tour.matches.length * 2 + tour.byes.length;
    if (entrants <= 2) return t("bow.final");
    if (entrants <= 4) return t("bow.semifinal");
    return t("bow.round", { n: tour.round });
  };

  return (
    <Modal label={title} onClose={onClose} className="dom-bow">
      <div className="dom-bow-inner">
        <div className="dom-bow-hd">
          <span className="dom-bow-kicker">{title}</span>
          <h2 className="dom-bow-week">
            {themeLabel} · {periodLabel}
          </h2>
        </div>

        {state.phase === "empty" && (
          <div className="dom-bow-empty">
            <p>{emptyText}</p>
            <p className="dom-bow-empty-hint">{emptyHint}</p>
          </div>
        )}

        {state.phase === "options" && (
          <div className="dom-bow-options">
            <p className="dom-bow-choose">{t("bow.choose")}</p>
            <div className="dom-bow-option-grid">
              <button className="dom-bow-option" onClick={() => start("sequential")}>
                <span className="dom-bow-option-name">{t("bow.sequential")}</span>
                <span className="dom-bow-option-desc">{t("bow.sequentialDesc")}</span>
              </button>
              <button className="dom-bow-option" onClick={() => start("random")}>
                <span className="dom-bow-option-name">{t("bow.random")}</span>
                <span className="dom-bow-option-desc">{t("bow.randomDesc")}</span>
              </button>
            </div>
          </div>
        )}

        {state.phase === "play" && (
          <div className="dom-bow-play">
            <div className="dom-bow-roundbar">
              <span className="dom-bow-round">{roundName(state.tour)}</span>
              <span className="dom-bow-progress">
                {t("bow.progress", { cur: state.tour.mi + 1, total: state.tour.matches.length })}
              </span>
            </div>
            <p className="dom-bow-pick">{t("bow.pick")}</p>
            <div className="dom-bow-match">
              <ContenderCard c={state.tour.matches[state.tour.mi].a} onPick={pick} />
              <span className="dom-bow-vs">{t("bow.vs")}</span>
              <ContenderCard c={state.tour.matches[state.tour.mi].b} onPick={pick} />
            </div>
          </div>
        )}

        {state.phase === "champion" && (
          <div className="dom-bow-result">
            <ChampionPoster
              ref={posterRef}
              c={state.champion}
              themeLabel={themeLabel}
              periodLabel={periodLabel}
              handle={handle}
              kicker={championKicker}
            />
            <div className="dom-bow-actions">
              {contenders.length > 1 && (
                <Button variant="ghost" onClick={redo}>
                  {t("bow.redo")}
                </Button>
              )}
              <Button onClick={handleSaveImage}>{t("bow.saveImage")}</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// A single day in a matchup. `onPick` present → it's a clickable choice.
function ContenderCard({ c, onPick }: { c: Contender; onPick?: (c: Contender) => void }) {
  const d = parseDate(c.date);
  const dow = DOW[d.getDay()];
  const dowKo = DOW_KO[d.getDay()];
  const inner = (
    <>
      <div className="dom-bow-card-cover">
        <Cover album={c.album} size="100%" />
      </div>
      <div className="dom-bow-card-meta">
        <div className="dom-bow-card-day">
          {dow} <span className="dom-bow-card-dow-ko">{dowKo}</span> · {d.getMonth() + 1}/{d.getDate()}
        </div>
        <div className="dom-title">{c.album.title}</div>
        <div className="dom-artist">{c.album.artist}</div>
        <Stars value={c.album.rating} size={13} />
      </div>
    </>
  );
  if (onPick) {
    return (
      <button className="dom-bow-card dom-bow-card-pick" type="button" onClick={() => onPick(c)}>
        {inner}
      </button>
    );
  }
  return <div className="dom-bow-card">{inner}</div>;
}

// The champion poster — the node handed to saveCardAsImage.
function ChampionPoster({
  ref,
  c,
  themeLabel,
  periodLabel,
  handle,
  kicker,
}: {
  ref: React.Ref<HTMLDivElement>;
  c: Contender;
  themeLabel: string;
  periodLabel: string;
  handle: string;
  kicker: string;
}) {
  const d = parseDate(c.date);
  const dow = DOW[d.getDay()];
  return (
    <div className="dom-bow-champion" ref={ref}>
      <div className="dom-bow-champ-hd">
        <span className="dom-bow-champ-theme">{themeLabel}</span>
        <span className="dom-bow-champ-kicker">🏆 {kicker}</span>
        <span className="dom-bow-champ-week">{periodLabel}</span>
      </div>
      <div className="dom-bow-champ-cover">
        <Cover album={c.album} size="100%" />
      </div>
      <div className="dom-bow-champ-meta">
        <div className="dom-bow-champ-day">
          {dow} · {d.getFullYear()}.{String(d.getMonth() + 1).padStart(2, "0")}.
          {String(d.getDate()).padStart(2, "0")}
        </div>
        <div className="dom-bow-champ-title">{c.album.title}</div>
        <div className="dom-bow-champ-artist">{c.album.artist}</div>
        <Stars value={c.album.rating} size={18} />
        <div className="dom-bow-champ-user">@{handle}</div>
      </div>
    </div>
  );
}
