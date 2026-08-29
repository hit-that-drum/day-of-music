// day-detail.tsx — Day Detail modal: deep-dive into one day's album.
// Tabs: Tracklist · Journal · Info. Rating updates instantly; note commits on blur.

"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  formatDisplayDate,
  normalizeGenre,
  parseDate,
  type Album,
} from "@/lib/day-of-music/data";
import { isManualAlbum, readManualArtwork } from "@/lib/day-of-music/manual-artwork";
import { fetchAlbumDetail } from "@/lib/day-of-music/music-search";
import { useCountry } from "@/lib/day-of-music/profile";
import { useDateNames, useT } from "@/lib/day-of-music/i18n";
import { Cover } from "@/components/day-of-music/cover";
import { Button } from "@/components/day-of-music/atoms";
import { Modal } from "@/components/day-of-music/modal";

type Tab = "tracklist" | "journal" | "info";

type DayDetailProps = {
  album: Album;
  onClose: () => void;
  /** Update the slot at this date — rating/note, or a `date` patch to move it. */
  onUpdate: (date: string, patch: Partial<Album>) => void;
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
function formatReleased(album: Album, country: string): string {
  if (!album.releaseDate) return String(album.year);
  return formatDisplayDate(album.releaseDate, country);
}

export function DayDetail({ album, onClose, onUpdate, onEnrich, onRemove, onReplace }: DayDetailProps) {
  const [tab, setTab] = useState<Tab>("tracklist");
  const [note, setNote] = useState(album.note);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoTitle, setInfoTitle] = useState(album.title);
  const [infoArtist, setInfoArtist] = useState(album.artist);
  const [infoGenre, setInfoGenre] = useState(normalizeGenre(album.genre));
  const [infoYear, setInfoYear] = useState(String(album.year));
  // Draft cover for manual entries: a data URL to keep, or null for the
  // typographic tile. Only committed by Save, so Cancel leaves the cover alone.
  const [infoArt, setInfoArt] = useState<string | null>(album.artworkUrl ?? null);
  // Holds the "Saved ✓" auto-clear timer so we can cancel it on unmount and
  // before re-arming — otherwise setNoteSaved could fire after unmount.
  const noteSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const country = useCountry();
  const t = useT();
  const names = useDateNames();
  const date = parseDate(album.date);
  const seed = album.tracks.length;
  const noteDirty = note !== album.note;
  const isManual = isManualAlbum(album);
  // One id for the hidden file input so both the preview tile and the "Change
  // picture" caption can open the picker.
  const artInputId = useId();
  const infoDirty =
    infoTitle !== album.title ||
    infoArtist !== album.artist ||
    infoGenre !== normalizeGenre(album.genre) ||
    infoYear !== String(album.year) ||
    infoArt !== (album.artworkUrl ?? null);
  const infoValid = Boolean(infoTitle.trim() && infoGenre.trim());

  // iTunes albums arrive from Search with no tracklist (Search returns album
  // metadata only). The first time such an album is opened, pull its tracks +
  // release date from the Lookup API — in the listener's storefront, so titles
  // come back localized — and persist them onto the album. We also re-fetch when
  // the stored tracklist was saved for a different store (e.g. old US-English
  // tracks now viewed as KR), so the same localization the Add flow shows
  // applies here too.
  useEffect(() => {
    if (!album.id.startsWith("itunes-")) return;
    const needsTracks = album.tracks.length === 0;
    const staleTracks = album.tracks.length > 0 && album.tracksCountry !== country;
    const needsDate = !album.releaseDate;
    if (!needsTracks && !staleTracks && !needsDate) return;

    let cancelled = false;
    fetchAlbumDetail(album.id, { country }).then((detail) => {
      if (cancelled || !detail) return;
      const patch: Partial<Album> = {};
      if ((needsTracks || staleTracks) && detail.tracks.length) {
        patch.tracks = detail.tracks;
        patch.tracksCountry = country;
        // Localize the album title/artist to the listener's store as well —
        // Korean when the catalog has it (the lookup sometimes romanizes the
        // title), otherwise the original. Only adopt non-empty, changed values.
        if (detail.title && detail.title !== album.title) patch.title = detail.title;
        if (detail.artist && detail.artist !== album.artist) patch.artist = detail.artist;
      }
      if (needsDate && detail.releaseDate) patch.releaseDate = detail.releaseDate;
      if (Object.keys(patch).length) onEnrich(album.date, patch);
    });
    return () => {
      cancelled = true;
    };
  }, [album.id, album.date, album.title, album.artist, album.tracks.length, album.tracksCountry, album.releaseDate, country, onEnrich]);

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
    const parsedYear = Number.parseInt(infoYear, 10);
    const next = {
      title: infoTitle.trim(),
      artist: infoArtist.trim() || "Unknown artist",
      genre: infoGenre.trim(),
      year: Number.isFinite(parsedYear) ? parsedYear : album.year,
      // undefined drops the cover back to the typographic tile.
      artworkUrl: infoArt ?? undefined,
    };
    onUpdate(album.date, next);
    setInfoTitle(next.title);
    setInfoArtist(next.artist);
    setInfoGenre(next.genre);
    setInfoYear(String(next.year));
    setEditingInfo(false);
  }

  function resetInfoDraft() {
    setInfoTitle(album.title);
    setInfoArtist(album.artist);
    setInfoGenre(normalizeGenre(album.genre));
    setInfoYear(String(album.year));
    setInfoArt(album.artworkUrl ?? null);
    setEditingInfo(false);
  }

  // Manual entries only: swap the cover picture for one from the device.
  function handlePickArt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    void readManualArtwork(file).then(setInfoArt);
  }

  useEffect(
    () => () => {
      if (noteSavedTimer.current) clearTimeout(noteSavedTimer.current);
    },
    [],
  );

  return (
    <Modal label={t("daydetail.modalLabel", { title: album.title })} onClose={onClose}>
      <div className="dom-detail">
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

          <div className="dom-tabs">
            {(["tracklist", "journal", "info"] as Tab[]).map((tabId) => (
              <button
                key={tabId}
                className="dom-tab"
                data-active={tab === tabId ? "1" : "0"}
                onClick={() => setTab(tabId)}
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
              <ol className="dom-tracklist">
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
              <div className="dom-addflow-empty">
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
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="dom-rate-row">
                {/* Fixed 5-star row — index is a stable key. */}
                {Array.from({ length: 5 }, (_, i) => (
                  <button
                    key={i}
                    className="dom-star"
                    data-on={i + 1 <= album.rating ? "1" : "0"}
                    onClick={() => commitRating(i + 1)}
                    aria-label={t("aria.rateStars", { n: i + 1 })}
                  >
                    ★
                  </button>
                ))}
              </div>
              <label className="dom-edit-field">
                <span className="dom-edit-label">{t("daydetail.loggedOn")}</span>
                <input
                  type="date"
                  className="dom-input"
                  value={album.date}
                  onChange={(e) => e.target.value && onUpdate(album.date, { date: e.target.value })}
                />
              </label>
              <div className="dom-edit-field">
                <span className="dom-edit-label">{t("field.note")}</span>
                <textarea
                  className="dom-input dom-textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
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
            <div className="dom-info-pane">
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
                          {infoArt ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={infoArt} alt={t("addflow.coverPreview")} />
                          ) : (
                            <span>＋ {t("addflow.addPicture")}</span>
                          )}
                        </label>
                        {infoArt && (
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
                              onClick={() => setInfoArt(null)}
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
                      value={infoTitle}
                      onChange={(e) => setInfoTitle(e.target.value)}
                    />
                  </label>
                  <label className="dom-edit-field">
                    <span className="dom-edit-label">{t("field.artist")}</span>
                    <input
                      className="dom-input"
                      value={infoArtist}
                      onChange={(e) => setInfoArtist(e.target.value)}
                    />
                  </label>
                  <label className="dom-edit-field">
                    <span className="dom-edit-label">{t("field.genre")}</span>
                    <input
                      className="dom-input"
                      value={infoGenre}
                      onChange={(e) => setInfoGenre(e.target.value)}
                    />
                  </label>
                  <label className="dom-edit-field">
                    <span className="dom-edit-label">{t("field.year")}</span>
                    <input
                      className="dom-input"
                      inputMode="numeric"
                      value={infoYear}
                      onChange={(e) => setInfoYear(e.target.value)}
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
