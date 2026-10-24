// add-flow.tsx — Add / Log Album: a 3-step modal (find → pick days → rate +
// note). Step 1 searches the music catalog through the iTunes proxy, resolves
// a pasted Apple Music album link (use-music-search.ts), or takes a manual
// entry for music that isn't on Apple Music.

"use client";

import { Fragment, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import {
  addDays,
  fmtDate,
  formatDisplayDate,
  parseDate,
  startOfWeek,
  type Album,
} from "@/lib/day-of-music/data";
import {
  albumFromManual,
  albumFromTrack,
  type AlbumDetail,
} from "@/lib/day-of-music/music-search";
import { readManualArtwork } from "@/lib/day-of-music/manual-artwork";
import { useCountry } from "@/lib/day-of-music/profile";
import { useDateNames, useT } from "@/lib/day-of-music/i18n";
import { useMusicSearch } from "@/lib/day-of-music/use-music-search";
import { Cover } from "@/components/day-of-music/cover";
import { RatingInput } from "@/components/day-of-music/rating-input";
import { Button } from "@/components/day-of-music/atoms";
import { Modal, focusUnlessPhone } from "@/components/day-of-music/modal";

export type NewEntry = {
  /** One or more days to log this album on. The same album/rating/note is
   *  written to each date (one album per day per theme). */
  dates: string[];
  rating: number;
  note: string;
  /** The picked album (a search result, pasted link, track or manual entry).
   *  Its metadata always travels with the entry — that's what lets the journal
   *  render and sync it on another device. */
  album: Album;
};

type Step = 1 | 2 | 3;

// Manual entry: music that isn't on Apple Music (e.g. found on YouTube). The
// cover is the user's own picture as a (downscaled) data URL, or null for the
// typographic tile.
type ManualFields = { title: string; artist: string; genre: string; art: string | null };
const EMPTY_MANUAL: ManualFields = { title: "", artist: "", genre: "", art: null };

type AddFlowProps = {
  onClose: () => void;
  onSave: (entry: NewEntry) => void;
  /** Seeds the initial selected day when no `defaultDate` is given. The picker
   *  then follows the selected day's week independently of this. */
  defaultWeekStart: Date;
  defaultDate?: string;
};

export function AddFlow({ onClose, onSave, defaultWeekStart, defaultDate }: AddFlowProps) {
  const t = useT();
  const names = useDateNames();
  const [step, setStep] = useState<Step>(1);
  const [picked, setPicked] = useState<Album | null>(null);
  const initialDate = defaultDate ?? fmtDate(defaultWeekStart);
  // Days to log on. Multiple days can be selected so the same album is logged
  // across several dates at once.
  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    () => new Set([initialDate]),
  );
  // The day whose week is currently shown in the picker. Independent of the
  // selection so the user can navigate weeks and pick days across them.
  const [weekAnchor, setWeekAnchor] = useState(initialDate);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");

  function toggleDate(k: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState<ManualFields>(EMPTY_MANUAL);
  // Stable id for the manual album, created once per modal open.
  const [manualId] = useState(
    () => `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  );

  // Search the user's preferred storefront first (server falls back to the
  // common stores after it).
  const country = useCountry();
  const music = useMusicSearch(country);

  // Infinite scroll: reveal more of the already-fetched batch near the bottom.
  function handleResultsScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) music.showMore();
  }

  // Show the week containing the currently-selected day, so a day picked from
  // the month view (outside the viewed week) still appears and stays selected.
  const weekStart = useMemo(() => startOfWeek(parseDate(weekAnchor)), [weekAnchor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  return (
    <Modal label={t("addflow.modalLabel")} onClose={onClose}>
      <div className="dom-addflow">
        <div className="dom-addflow-eyebrow">{t("addflow.eyebrow")}</div>
        <h1 className="dom-addflow-title">{t("addflow.step", { step })}</h1>

        <div className="dom-addflow-progress">
          <div
            className="dom-addflow-progress-fill"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {step === 1 && !manualMode && (
          <div className="dom-addflow-body">
            <label className="dom-addflow-label">{t("addflow.findLabel")}</label>
            <input
              className="dom-input"
              ref={focusUnlessPhone}
              placeholder={t("addflow.searchPlaceholder")}
              value={music.query}
              onChange={(e) => music.setQuery(e.target.value)}
            />
            <div className="dom-addflow-results" onScroll={handleResultsScroll}>
              {music.results.map((a) => {
                const expandable = a.id.startsWith("itunes-");
                return (
                  <Fragment key={a.id}>
                    <button
                      className="dom-addflow-result"
                      data-active={picked?.id === a.id ? "1" : "0"}
                      aria-pressed={picked?.id === a.id}
                      onClick={() => {
                        setPicked(a);
                        music.setExpandedId(expandable ? a.id : null);
                      }}
                    >
                      <Cover album={a} size={56} />
                      <div className="dom-addflow-result-info">
                        <div className="dom-addflow-result-title">{a.title}</div>
                        <div className="dom-addflow-result-artist">
                          {a.artist} · {a.year}
                        </div>
                      </div>
                      {picked?.id === a.id && <span className="dom-addflow-check">✓</span>}
                    </button>
                    {music.expandedId === a.id && (
                      <TrackPanel
                        detail={music.expandedDetail}
                        loading={music.expandedLoading}
                        picked={picked}
                        onPick={setPicked}
                      />
                    )}
                  </Fragment>
                );
              })}
              {music.canSeeAll && (
                <button
                  type="button"
                  className="dom-addflow-seeall"
                  onClick={music.seeAll}
                >
                  {t("addflow.seeAll")}
                </button>
              )}
              {music.loadingMore && (
                <div className="dom-addflow-empty">{t("addflow.loadingMore")}</div>
              )}
              {music.searching && !music.results.length && (
                <div className="dom-addflow-empty">
                  {music.pastedLink ? t("addflow.readingLink") : t("addflow.searching")}
                </div>
              )}
              {music.linkNotFound && (
                <div className="dom-addflow-empty">{t("addflow.linkError")}</div>
              )}
              {music.noMatches && (
                <div className="dom-addflow-empty">{t("addflow.noMatches")}</div>
              )}
              {music.searchFailed && (
                <div className="dom-addflow-empty">{t("addflow.searchUnavailable")}</div>
              )}
            </div>
            <button
              type="button"
              className="dom-addflow-manual-link"
              onClick={() => setManualMode(true)}
            >
              {t("addflow.manualLink")}
            </button>
          </div>
        )}

        {step === 1 && manualMode && (
          <ManualEntryForm value={manual} onChange={setManual} onBack={() => setManualMode(false)} />
        )}

        {step === 2 && (
          <div className="dom-addflow-body">
            <label className="dom-addflow-label">{t("addflow.pickDays")}</label>
            <div className="dom-addflow-weeknav">
              <button
                type="button"
                className="dom-addflow-weeknav-btn"
                aria-label={t("aria.prevWeek")}
                onClick={() => setWeekAnchor(fmtDate(addDays(weekStart, -7)))}
              >
                ←
              </button>
              <span className="dom-addflow-weeknav-label">
                {formatDisplayDate(weekStart, country, "short")} – {formatDisplayDate(addDays(weekStart, 6), country, "short")}
              </span>
              <button
                type="button"
                className="dom-addflow-weeknav-btn"
                aria-label={t("aria.nextWeek")}
                onClick={() => setWeekAnchor(fmtDate(addDays(weekStart, 7)))}
              >
                →
              </button>
            </div>
            <div className="dom-addflow-datestack">
              {weekDays.map((d) => {
                const k = fmtDate(d);
                return (
                  <button
                    key={k}
                    className="dom-addflow-date"
                    data-active={selectedDates.has(k) ? "1" : "0"}
                    aria-pressed={selectedDates.has(k)}
                    onClick={() => toggleDate(k)}
                  >
                    <span className="dom-addflow-date-num">{d.getDate()}</span>
                    <span className="dom-addflow-date-dow">{names.weekdayShort(d)}</span>
                  </button>
                );
              })}
            </div>
            {selectedDates.size > 0 && (
              <div className="dom-addflow-selected">
                {selectedDates.size === 1
                  ? t("addflow.daySelected", {
                      date: formatDisplayDate([...selectedDates][0], country),
                    })
                  : t("addflow.daysSelected", { count: selectedDates.size })}
              </div>
            )}
            {picked && (
              <div className="dom-addflow-preview">
                <Cover album={picked} size={88} />
                <div>
                  <div className="dom-addflow-preview-title">{picked.title}</div>
                  <div className="dom-addflow-preview-artist">{picked.artist}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="dom-addflow-body">
            <label className="dom-addflow-label">{t("addflow.yourRating")}</label>
            <RatingInput
              value={rating}
              onChange={setRating}
              label={t("addflow.yourRating")}
              size="lg"
            />
            <label className="dom-addflow-label" style={{ marginTop: 14 }}>
              {t("field.note")}
            </label>
            <textarea
              className="dom-input dom-textarea"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("addflow.notePlaceholder")}
            />
          </div>
        )}

        <div className="dom-addflow-actions">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(step === 3 ? 2 : 1)}>
              ← {t("action.back")}
            </Button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <Button
              disabled={
                (step === 1 && (manualMode ? !manual.title.trim() || !manual.genre.trim() : !picked)) ||
                (step === 2 && selectedDates.size === 0)
              }
              onClick={() => {
                // Leaving step 1 in manual mode: turn the typed fields into the
                // picked album so steps 2–3 (and Save) work unchanged.
                if (step === 1 && manualMode) {
                  setPicked(
                    albumFromManual({
                      id: manualId,
                      title: manual.title,
                      artist: manual.artist,
                      genre: manual.genre,
                      artworkUrl: manual.art ?? undefined,
                    }),
                  );
                }
                setStep(step === 1 ? 2 : 3);
              }}
            >
              {t("action.continue")} →
            </Button>
          ) : (
            <Button
              onClick={() => {
                const dates = [...selectedDates].sort();
                if (picked && dates.length) {
                  onSave({ dates, rating, note, album: picked });
                }
                onClose();
              }}
            >
              {t("addflow.saveEntry")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Step 1's manual-entry fields. Controlled: AddFlow keeps the values and turns
// them into the picked album when the user continues.
function ManualEntryForm({
  value,
  onChange,
  onBack,
}: {
  value: ManualFields;
  onChange: Dispatch<SetStateAction<ManualFields>>;
  onBack: () => void;
}) {
  const t = useT();
  const set = (patch: Partial<ManualFields>) => onChange((m) => ({ ...m, ...patch }));

  function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    void readManualArtwork(file).then((art) => set({ art }));
  }

  return (
    <div className="dom-addflow-body">
      <button type="button" className="dom-addflow-manual-back" onClick={onBack}>
        ← {t("addflow.manualBack")}
      </button>

      <label className="dom-addflow-label">{t("addflow.coverImage")}</label>
      <div className="dom-addflow-manual-cover">
        <label className="dom-addflow-imagedrop">
          {value.art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.art} alt={t("addflow.coverPreview")} />
          ) : (
            <span>＋ {t("addflow.addPicture")}</span>
          )}
          <input type="file" accept="image/*" hidden onChange={handlePickImage} />
        </label>
        {value.art && (
          <button
            type="button"
            className="dom-addflow-manual-removeimg"
            onClick={() => set({ art: null })}
          >
            {t("addflow.removePicture")}
          </button>
        )}
      </div>

      <label className="dom-addflow-label">{t("field.title")}</label>
      <input
        className="dom-input"
        ref={focusUnlessPhone}
        placeholder={t("addflow.titlePlaceholder")}
        value={value.title}
        onChange={(e) => set({ title: e.target.value })}
      />

      <label className="dom-addflow-label" style={{ marginTop: 4 }}>
        {t("field.artist")}
      </label>
      <input
        className="dom-input"
        placeholder={t("addflow.artistPlaceholder")}
        value={value.artist}
        onChange={(e) => set({ artist: e.target.value })}
      />

      <label className="dom-addflow-label" style={{ marginTop: 4 }}>
        {t("field.genre")}
      </label>
      <input
        className="dom-input"
        placeholder={t("addflow.genrePlaceholder")}
        value={value.genre}
        onChange={(e) => set({ genre: e.target.value })}
      />
    </div>
  );
}

// The expandable tracklist under a search result. Lets the user log the whole
// album or pick a single track. Rendered only while a result is expanded.
function TrackPanel({
  detail,
  loading,
  picked,
  onPick,
}: {
  detail: AlbumDetail | null;
  loading: boolean;
  picked: Album | null;
  onPick: (album: Album) => void;
}) {
  const t = useT();
  // Bail before `detail` resolves — this also narrows it for albumFromTrack
  // below, so no non-null assertion is needed.
  if (!detail) {
    return (
      <div className="dom-addflow-tracks">
        <div className="dom-addflow-tracks-label">{t("addflow.pickTrack")}</div>
        <div className="dom-addflow-empty">
          {loading ? t("addflow.loadingTracks") : t("addflow.tracksError")}
        </div>
      </div>
    );
  }

  return (
    <div className="dom-addflow-tracks">
      <div className="dom-addflow-tracks-label">{t("addflow.pickTrack")}</div>
      {detail.trackItems.length > 0 ? (
        detail.trackItems.map((track) => {
          // Build the track album once so the compared id and the picked id
          // always match — the resolved detail's collection id may differ from
          // the row's id (the route falls back to an edition with tracks).
          const trackAlbum = albumFromTrack(detail, track);
          return (
            <button
              key={track.trackId}
              className="dom-addflow-track"
              data-active={picked?.id === trackAlbum.id ? "1" : "0"}
              aria-pressed={picked?.id === trackAlbum.id}
              onClick={() => onPick(trackAlbum)}
            >
              <span className="dom-addflow-track-name">{track.name}</span>
              <span className="dom-addflow-track-artist">{track.artist}</span>
              {picked?.id === trackAlbum.id && (
                <span className="dom-addflow-check">✓</span>
              )}
            </button>
          );
        })
      ) : (
        <div className="dom-addflow-empty">{t("addflow.tracksError")}</div>
      )}
    </div>
  );
}
