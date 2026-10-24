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
import { toast } from "sonner";

import { parseDate } from "@/lib/day-of-music/data";
import { findTheme, formatThemeLabel, useActiveTheme, useThemes } from "@/lib/day-of-music/themes";
import { displayHandle, useProfile } from "@/lib/day-of-music/profile";
import { useDateNames, useT } from "@/lib/day-of-music/i18n";
import { useBestOf } from "@/lib/day-of-music/best-of";
import {
  advance,
  createTourney,
  findSavedChampion,
  roundStage,
  shuffle,
  type BestOfMethod,
  type Contender,
  type Tourney,
} from "@/lib/day-of-music/best-of-bracket";
import { saveCardAsImage } from "@/lib/day-of-music/save-card";
import { Button, Stars } from "@/components/day-of-music/atoms";
import { Cover } from "@/components/day-of-music/cover";
import { Modal } from "@/components/day-of-music/modal";

type State =
  | { phase: "empty" }
  | { phase: "options" }
  | { phase: "play"; method: BestOfMethod; tour: Tourney<Contender> }
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

  const themeLabel = formatThemeLabel(findTheme(themes, activeTheme));
  const handle = displayHandle(username);

  // Snapshot the starting phase at mount (the modal only mounts when opened):
  // a saved result → show it; 0 contenders → empty; 1 → auto-champion; else pick.
  const [state, setState] = useState<State>(() => {
    const saved = bestOf.get(storeKey);
    const savedWinner = findSavedChampion(saved, contenders);
    if (saved && savedWinner) {
      return { phase: "champion", champion: savedWinner, method: saved.method, saved: true };
    }
    if (contenders.length === 0) return { phase: "empty" };
    if (contenders.length === 1) {
      return { phase: "champion", champion: contenders[0], method: null, saved: false };
    }
    return { phase: "options" };
  });

  // Persist the N=1 auto-champion decided at mount (a bracket's champion is
  // saved where it's picked). The ref keeps it to one write — StrictMode's
  // second run included — until a redo starts a new tournament.
  const persistedRef = useRef(false);
  useEffect(() => {
    if (state.phase !== "champion" || state.saved || persistedRef.current) return;
    persistedRef.current = true;
    bestOf.set(storeKey, {
      winnerDate: state.champion.date,
      method: state.method ?? "sequential",
      decidedAt: new Date().toISOString(),
    });
  }, [state, storeKey, bestOf]);

  function start(method: BestOfMethod) {
    const seeded = method === "random" ? shuffle(contenders) : contenders;
    setState({ phase: "play", method, tour: createTourney(seeded) });
  }

  function pick(winner: Contender) {
    if (state.phase !== "play") return;
    const next = advance(state.tour, winner);
    if (next.kind === "next") {
      setState({ ...state, tour: next.tour });
      return;
    }
    persistedRef.current = true;
    bestOf.set(storeKey, {
      winnerDate: next.champion.date,
      method: state.method,
      decidedAt: new Date().toISOString(),
    });
    setState({ phase: "champion", champion: next.champion, method: state.method, saved: true });
  }

  function redo() {
    if (contenders.length <= 1) return;
    persistedRef.current = false;
    setState({ phase: "options" });
  }

  async function handleSaveImage() {
    if (!posterRef.current) return;
    if (await saveCardAsImage(posterRef.current, fileName)) toast.success(t("share.imageSaved"));
    else toast.error(t("share.imageFailed"));
  }

  // Labelled by its true stage (see roundStage): a round with a bye isn't
  // named by its match count.
  const roundName = (tour: Tourney<Contender>): string => {
    const stage = roundStage(tour);
    if (stage === "final") return t("bow.final");
    if (stage === "semifinal") return t("bow.semifinal");
    return t("bow.round", { n: tour.round });
  };

  return (
    <Modal label={title} onClose={onClose} width={760}>
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
              <Button onClick={handleSaveImage}>{t("share.saveImage")}</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// A single day in a matchup. `onPick` present → it's a clickable choice.
function ContenderCard({ c, onPick }: { c: Contender; onPick?: (c: Contender) => void }) {
  const names = useDateNames();
  const d = parseDate(c.date);
  const inner = (
    <>
      <div className="dom-bow-card-cover">
        <Cover album={c.album} size="100%" />
      </div>
      <div className="dom-bow-card-meta">
        <div className="dom-bow-card-day">
          {names.weekdayShort(d)} · {d.getMonth() + 1}/{d.getDate()}
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
  const names = useDateNames();
  const d = parseDate(c.date);
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
          {names.weekdayShort(d)} · {d.getFullYear()}.{String(d.getMonth() + 1).padStart(2, "0")}.
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
