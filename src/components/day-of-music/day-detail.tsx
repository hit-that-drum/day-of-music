// day-detail.tsx — Day Detail modal: deep-dive into one day's album.
// Tabs: Tracklist · Journal · Info. Rating updates instantly; note commits on blur.

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  fmtDate,
  formatDisplayDate,
  normalizeGenre,
  parseDate,
  type Album,
} from "@/lib/day-of-music/data";
import { isManualAlbum, readManualArtwork } from "@/lib/day-of-music/manual-artwork";
import { useAlbumEnrichment } from "@/lib/day-of-music/use-album-enrichment";
import { useCountry } from "@/lib/day-of-music/profile";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { useDateNames, useT } from "@/lib/day-of-music/i18n";
import { Cover } from "@/components/day-of-music/cover";
import { RatingInput } from "@/components/day-of-music/rating-input";
import { Button } from "@/components/day-of-music/atoms";
import { Modal } from "@/components/day-of-music/modal";
import { DayPicker, SwapConfirm } from "@/components/day-of-music/day-picker";

type Tab = "tracklist" | "journal" | "info";

type DayDetailProps = {
  album: Album;
  onClose: () => void;
  /** Update the slot at this date — rating / note / info. Moves go through onMove. */
  onUpdate: (date: string, patch: Omit<Partial<Album>, "date">) => void;
  /** Reschedule: move this entry to `toDate` (swap when that day is logged). The app closes the modal. */
  onMove: (fromDate: string, toDate: string) => void;
  today: Date;
  /** Persist lazily-fetched catalog metadata (tracklist, release date). */
  onEnrich: (date: string, patch: Partial<Album>) => void;
  /** Delete the slot on this date. */
  onRemove: (date: string) => void;
  /** Swap which album is logged on this day (reopens search, keeps the date). */
  onReplace: (album: Album) => void;
};

// Deterministic track time from index so renders are stable (no hydration drift).
function trackTime(i: number, seed: number): string {
  const base = ((i * 37 + seed * 13) % 200) + 120; // 2:00–5:20-ish, seconds
  const m = Math.floor(base / 60);
  const s = base % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Release date in the listener's country notation (KR → "2024년 10월 14일",
// US → "October 14, 2024"). Falls back to the year when no full date is known.
// The Info tab's editable fields, held as the strings its inputs show.
type InfoDraft = {
  title: string;
  artist: string;
  genre: string;
  year: string;
  /** Draft cover for manual entries: a data URL to keep, or null for the
   *  typographic tile. Only committed by Save, so Cancel leaves the cover alone. */
  art: string | null;
};

function draftFromAlbum(album: Album): InfoDraft {
  return {
    title: album.title,
    artist: album.artist,
    genre: normalizeGenre(album.genre),
    year: String(album.year),
    art: album.artworkUrl ?? null,
  };
}

function formatReleased(album: Album, country: string): string {
  if (!album.releaseDate) return String(album.year);
  return formatDisplayDate(album.releaseDate, country);
}

export function DayDetail({ album, today, onClose, onUpdate, onMove, onEnrich, onRemove, onReplace }: DayDetailProps) {
  const [tab, setTab] = useState<Tab>("tracklist");
  const [note, setNote] = useState(album.note);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [info, setInfo] = useState<InfoDraft>(() => draftFromAlbum(album));
  const editInfo = (patch: Partial<InfoDraft>) => setInfo((d) => ({ ...d, ...patch }));
  // Holds the "Saved ✓" auto-clear timer so we can cancel it on unmount and
  // before re-arming — otherwise setNoteSaved could fire after unmount.
  const noteSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "Logged on" = reschedule. Phones: a trigger that expands an inline
  // DayPicker (`focusGrid` = the trigger was activated by keyboard, so focus
  // should follow into the grid). Desktop: the native date input, whose pick
  // of a logged day parks here until confirmed. CSS decides which one shows.
  const [pickerOpen, setPickerOpen] = useState<{ focusGrid: boolean } | null>(null);
  const [nativeSwap, setNativeSwap] = useState<{ date: string; title: string } | null>(null);
  const moveTriggerRef = useRef<HTMLButtonElement>(null);
  const nativeDateRef = useRef<HTMLInputElement>(null);
  const pickerId = useId();
  const tabsId = useId();
  // On whichever panel is showing — the tabs swap the panel out rather than
  // hiding the other two, so one id serves all three.
  const panelProps = {
    role: "tabpanel",
    id: `${tabsId}-panel`,
    "aria-labelledby": `${tabsId}-${tab}`,
  };
  const nativeDateId = useId();
  const nativeConfirmId = useId();
  const { albumsByDate } = useJournal();

  const country = useCountry();
  const t = useT();
  const names = useDateNames();
  const date = parseDate(album.date);
  const seed = album.tracks.length;
  const noteDirty = note !== album.note;
  const todayKey = fmtDate(today);

  const closePicker = useCallback(() => {
    setPickerOpen(null);
    moveTriggerRef.current?.focus();
  }, []);

  // Desktop path (native date input). Same rules as the DayPicker: own date and
  // future dates are no-ops, a logged day asks first, an empty day moves now.
  function requestMove(to: string) {
    if (to === album.date) return;
    if (to > todayKey) return;
    const other = albumsByDate[to];
    if (other) setNativeSwap({ date: to, title: other.title });
    else onMove(album.date, to);
  }
  const isManual = isManualAlbum(album);
  // One id for the hidden file input so both the preview tile and the "Change
  // picture" caption can open the picker.
  const artInputId = useId();
  const savedInfo = draftFromAlbum(album);
  const infoDirty = (Object.keys(info) as (keyof InfoDraft)[]).some((k) => info[k] !== savedInfo[k]);
  const infoValid = Boolean(info.title.trim() && info.genre.trim());

  // Fill in an iTunes album's tracklist / release date on first open.
  useAlbumEnrichment(album, country, onEnrich);

  // Rating commits immediately, so render straight from the album prop (single
  // source of truth) rather than mirroring it in local state that could drift.
  function commitRating(v: number) {
    onUpdate(album.date, { rating: v });
  }

  function saveNote() {
    onUpdate(album.date, { note });
    setNoteSaved(true);
    if (noteSavedTimer.current) clearTimeout(noteSavedTimer.current);
    noteSavedTimer.current = setTimeout(() => setNoteSaved(false), 1600);
  }

  function saveInfo() {
    const parsedYear = Number.parseInt(info.year, 10);
    const next = {
      title: info.title.trim(),
      artist: info.artist.trim() || "Unknown artist",
      genre: info.genre.trim(),
      year: Number.isFinite(parsedYear) ? parsedYear : album.year,
      // undefined drops the cover back to the typographic tile.
      artworkUrl: info.art ?? undefined,
    };
    onUpdate(album.date, next);
    editInfo({ title: next.title, artist: next.artist, genre: next.genre, year: String(next.year) });
    setEditingInfo(false);
  }

  function resetInfoDraft() {
    setInfo(draftFromAlbum(album));
    setEditingInfo(false);
  }

  // Manual entries only: swap the cover picture for one from the device.
  function handlePickArt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    void readManualArtwork(file).then((art) => editInfo({ art }));
  }

  useEffect(
    () => () => {
      if (noteSavedTimer.current) clearTimeout(noteSavedTimer.current);
    },
    [],
  );

  return (
    <Modal label={t("daydetail.modalLabel", { title: album.title })} onClose={onClose}>
      <div className="dom-modal-panel dom-detail">
        <div className="dom-detail-left">
          <div className="dom-detail-cover">
            <Cover album={album} size="100%" />
          </div>
          <div className="dom-detail-datewrap">
            <div>
              <div className="dom-detail-date">{String(date.getDate()).padStart(2, "0")}</div>
              <div className="dom-detail-format">{album.format}</div>
            </div>
            <div className="dom-detail-dow">{names.weekdayShort(date)}</div>
          </div>
        </div>

        <div className="dom-detail-right">
          <span className="dom-eyebrow">
            {album.kind === "track" ? t("daydetail.eyebrowTrack") : t("daydetail.eyebrowAlbum")}
          </span>
          <h2 className="dom-detail-title">{album.title}</h2>
          <div className="dom-detail-artist">
            {album.artist} <span className="dom-detail-artist-ko">{album.titleKo}</span>
          </div>
          {album.kind === "track" && album.albumTitle && (
            <div className="dom-detail-from">{t("common.fromAlbum", { title: album.albumTitle })}</div>
          )}

          <div className="dom-tabs" role="tablist" aria-label={t("daydetail.tabsAria")}>
            {(["tracklist", "journal", "info"] as Tab[]).map((tabId) => (
              <button
                key={tabId}
                type="button"
                role="tab"
                id={`${tabsId}-${tabId}`}
                aria-selected={tab === tabId}
                aria-controls={`${tabsId}-panel`}
                className="dom-tab"
                data-active={tab === tabId ? "1" : "0"}
                onClick={() => {
                  setTab(tabId);
                  setPickerOpen(null);
                  setNativeSwap(null);
                }}
              >
                {tabId === "tracklist"
                  ? t("daydetail.tabTracklist")
                  : tabId === "journal"
                    ? t("daydetail.tabJournal")
                    : t("daydetail.tabInfo")}
              </button>
            ))}
          </div>

          {tab === "tracklist" && (
            album.tracks.length > 0 ? (
              <ol className="dom-tracklist" {...panelProps}>
                {/* Tracklist order is fixed for a given album, so the index is a stable key. */}
                {album.tracks.map((name, i) => (
                  <li key={i}>
                    <span className="dom-track-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="dom-track-name">{name}</span>
                    <span className="dom-track-time">{trackTime(i, seed)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="dom-addflow-empty" {...panelProps}>
                {album.kind === "track"
                  ? album.albumTitle
                    ? t("daydetail.singleTrackFrom", { title: album.albumTitle })
                    : t("daydetail.singleTrack")
                  : album.id.startsWith("itunes-")
                    ? t("daydetail.loadingTracklist")
                    : t("daydetail.noTracklist")}
              </div>
            )
          )}

          {tab === "journal" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }} {...panelProps}>
              <RatingInput
                value={album.rating}
                onChange={commitRating}
                label={t("field.rating")}
              />
              {/* Desktop rendering — the native field, unchanged visually; hidden ≤760. */}
              <div className="dom-edit-field dom-move-native">
                <label className="dom-edit-label" htmlFor={nativeDateId}>{t("daydetail.loggedOn")}</label>
                <input
                  ref={nativeDateRef}
                  id={nativeDateId}
                  type="date"
                  className="dom-input"
                  value={album.date}
                  max={todayKey}
                  disabled={noteDirty}
                  onChange={(e) => e.target.value && requestMove(e.target.value)}
                />
                {noteDirty && <span className="dom-edit-hint">{t("daydetail.saveNoteFirst")}</span>}
                {nativeSwap && (
                  <SwapConfirm
                    id={nativeConfirmId}
                    title={nativeSwap.title}
                    date={formatDisplayDate(nativeSwap.date, country)}
                    onSwap={() => onMove(album.date, nativeSwap.date)}
                    onCancel={() => {
                      setNativeSwap(null);
                      nativeDateRef.current?.focus();
                    }}
                  />
                )}
              </div>
              {/* Phone rendering — trigger + inline picker; display:none above 760. */}
              <div className="dom-edit-field dom-move-touch">
                <span className="dom-edit-label">{t("daydetail.loggedOn")}</span>
                <button
                  ref={moveTriggerRef}
                  type="button"
                  className="dom-input dom-move-trigger"
                  aria-label={`${t("daydetail.loggedOn")}: ${formatDisplayDate(album.date, country)} — ${t("action.move")}`}
                  aria-expanded={Boolean(pickerOpen)}
                  aria-controls={pickerOpen ? pickerId : undefined}
                  disabled={noteDirty}
                  onClick={(e) => {
                    const focusGrid = e.currentTarget.matches(":focus-visible");
                    setPickerOpen((o) => (o ? null : { focusGrid }));
                  }}
                >
                  <span>{formatDisplayDate(album.date, country)}</span>
                  <span className="dom-move-trigger-act" aria-hidden="true">
                    {t("action.move")} ▾
                  </span>
                </button>
                {noteDirty && <span className="dom-edit-hint">{t("daydetail.saveNoteFirst")}</span>}
                {pickerOpen && (
                  <DayPicker
                    id={pickerId}
                    selectedDate={album.date}
                    today={today}
                    focusOnOpen={pickerOpen.focusGrid}
                    onPick={(to) => onMove(album.date, to)}
                    onClose={closePicker}
                  />
                )}
              </div>
              <div className="dom-edit-field">
                <span className="dom-edit-label">{t("field.note")}</span>
                <textarea
                  className="dom-input dom-textarea"
                  value={note}
                  // Handler, not effect: the dirty note disables both move
                  // controls, and the picker must not remount when Save clears it.
                  onChange={(e) => {
                    setNote(e.target.value);
                    setPickerOpen(null);
                    setNativeSwap(null);
                  }}
                  placeholder={t("daydetail.notePlaceholder")}
                />
                <div className="dom-note-actions">
                  {noteSaved && <span className="dom-note-saved">{t("daydetail.saved")}</span>}
                  <Button size="sm" onClick={saveNote} disabled={!noteDirty}>
                    {t("daydetail.saveNote")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab === "info" && (
            <div className="dom-info-pane" {...panelProps}>
              {editingInfo ? (
                <div className="dom-info-edit">
                  {/* Only hand-typed entries own their cover picture — catalog
                      albums keep the artwork that came with them. */}
                  {isManual && (
                    <div className="dom-edit-field">
                      <span className="dom-edit-label">{t("field.cover")}</span>
                      <div className="dom-cover-edit">
                        <input
                          id={artInputId}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={handlePickArt}
                        />
                        <label htmlFor={artInputId} className="dom-addflow-imagedrop">
                          {info.art ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={info.art} alt={t("addflow.coverPreview")} />
                          ) : (
                            <span>＋ {t("addflow.addPicture")}</span>
                          )}
                        </label>
                        {info.art && (
                          <div className="dom-cover-edit-actions">
                            <label
                              htmlFor={artInputId}
                              className="dom-addflow-manual-removeimg"
                            >
                              {t("addflow.changePicture")}
                            </label>
                            <button
                              type="button"
                              className="dom-addflow-manual-removeimg"
                              onClick={() => editInfo({ art: null })}
                            >
                              {t("addflow.removePicture")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <label className="dom-edit-field">
                    <span className="dom-edit-label">{t("field.title")}</span>
                    <input
                      className="dom-input"
                      value={info.title}
                      onChange={(e) => editInfo({ title: e.target.value })}
                    />
                  </label>
                  <label className="dom-edit-field">
                    <span className="dom-edit-label">{t("field.artist")}</span>
                    <input
                      className="dom-input"
                      value={info.artist}
                      onChange={(e) => editInfo({ artist: e.target.value })}
                    />
                  </label>
                  <label className="dom-edit-field">
                    <span className="dom-edit-label">{t("field.genre")}</span>
                    <input
                      className="dom-input"
                      value={info.genre}
                      onChange={(e) => editInfo({ genre: e.target.value })}
                    />
                  </label>
                  <label className="dom-edit-field">
                    <span className="dom-edit-label">{t("field.year")}</span>
                    <input
                      className="dom-input"
                      inputMode="numeric"
                      value={info.year}
                      onChange={(e) => editInfo({ year: e.target.value })}
                    />
                  </label>
                  <div className="dom-info-edit-actions">
                    <Button variant="ghost" size="sm" onClick={resetInfoDraft}>
                      {t("action.cancel")}
                    </Button>
                    <Button size="sm" onClick={saveInfo} disabled={!infoDirty || !infoValid}>
                      {t("daydetail.saveInfo")}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <InfoRow label={t("daydetail.released")} value={formatReleased(album, country)} />
                  <InfoRow label={t("field.genre")} value={normalizeGenre(album.genre) || "—"} />
                  <InfoRow label={t("daydetail.format")} value={album.format} />
                  {album.kind === "track" ? (
                    <>
                      <InfoRow label={t("daydetail.type")} value={t("daydetail.trackValue")} />
                      {album.albumTitle && <InfoRow label={t("daydetail.fromAlbumLabel")} value={album.albumTitle} />}
                    </>
                  ) : (
                    <InfoRow label={t("daydetail.tracks")} value={String(album.tracks.length)} />
                  )}
                  <InfoRow label={t("daydetail.loggedOn")} value={formatDisplayDate(album.date, country)} />
                  {isManual && (
                    <div className="dom-info-edit-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          resetInfoDraft();
                          setEditingInfo(true);
                        }}
                      >
                        {t("daydetail.reviseInfo")}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="dom-detail-actions">
            <Button variant="ghost" onClick={() => onReplace(album)}>
              {t("daydetail.replaceAlbum")}
            </Button>
            {confirmRemove ? (
              <span className="dom-confirm">
                <span className="dom-confirm-q">{t("daydetail.removeConfirm")}</span>
                <Button
                  variant="danger"
                  // onRemove already closes the modal (handleRemove resets openAlbum).
                  onClick={() => onRemove(album.date)}
                >
                  {t("action.remove")}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
                  {t("action.cancel")}
                </Button>
              </span>
            ) : (
              <Button variant="danger-ghost" onClick={() => setConfirmRemove(true)}>
                {t("action.remove")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="dom-info-row">
      <span className="dom-info-label">{label}</span>
      <span className="dom-info-value">{value}</span>
    </div>
  );
}
