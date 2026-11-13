// use-album-enrichment.ts — Day Detail's lazy catalog lookup for an iTunes album.
// iTunes albums arrive from Search with no tracklist (Search returns album
// metadata only). The first time such an album is opened, pull its tracks +
// release date from the Lookup API — in the listener's storefront, so titles
// come back localized — and persist them onto the album. We also re-fetch when
// the stored tracklist was saved for a different store (e.g. old US-English
// tracks now viewed as KR), so the same localization the Add flow shows
// applies here too — or by an older version of the route's localization
// (TRACKLIST_VERSION): KR tracklists saved before the route recovered Korean
// titles say "KR" but hold the US store's English. A single track logged off an
// album is renamed the same way: its title is that album's song as the route
// names it now.

import { useEffect } from "react";

import type { Album } from "@/lib/day-of-music/data";
import { fetchAlbumDetail } from "@/lib/day-of-music/music-search";
import { TRACKLIST_VERSION } from "@/lib/day-of-music/music-types";

// Albums already enriched on this page load, per storefront and tracklist
// version. Enriching writes the album, and the journal can hand the detail an
// unenriched copy right back (a stored copy the write didn't reach winning the
// refetch, or a failed write rolled back); answering that with another fetch +
// write looped without end. Once per album per load is enough — a reload or a
// storefront change tries again.
const enriched = new Set<string>();

/** A single track logged off an album (albumFromTrack's "itrack-<collection
 *  id>-<track id>"): the album to look up, and the track on it. */
function loggedTrack(id: string): { albumId: string; trackId: number } | null {
  const match = /^itrack-(\d+)-(\d+)$/.exec(id);
  return match ? { albumId: `itunes-${match[1]}`, trackId: Number(match[2]) } : null;
}

export function useAlbumEnrichment(
  album: Album,
  country: string,
  onEnrich: (date: string, patch: Partial<Album>) => void,
): void {
  useEffect(() => {
    const track = loggedTrack(album.id);
    if (!track && !album.id.startsWith("itunes-")) return;
    // Names already fetched for this store by this version of the route: an
    // album's tracklist, or a single track's own title.
    const named = album.tracksCountry === country && album.tracksVersion === TRACKLIST_VERSION;
    const needsTracks = !track && album.tracks.length === 0;
    const staleTracks = !track && album.tracks.length > 0 && !named;
    const staleTrackName = track !== null && !named;
    const needsDate = !album.releaseDate;
    if (!needsTracks && !staleTracks && !staleTrackName && !needsDate) return;
    const key = `${album.id}:${country}:${TRACKLIST_VERSION}`;
    if (enriched.has(key)) return;

    let cancelled = false;
    fetchAlbumDetail(track?.albumId ?? album.id, { country }).then((detail) => {
      if (cancelled || !detail) return;
      enriched.add(key);
      const patch: Partial<Album> = {};
      if (staleTrackName) {
        // Marked even when nothing changed (or the album came back without
        // this track), so it's asked once per version, not on every open.
        patch.tracksCountry = country;
        patch.tracksVersion = TRACKLIST_VERSION;
        const item = detail.trackItems.find((t) => t.trackId === track.trackId);
        const artist = item?.artist || detail.artist;
        if (item?.name && item.name !== album.title) patch.title = item.name;
        if (item && artist && artist !== album.artist) patch.artist = artist;
        if (item && detail.title && detail.title !== album.albumTitle) {
          patch.albumTitle = detail.title;
        }
      }
      if ((needsTracks || staleTracks) && detail.tracks.length) {
        patch.tracks = detail.tracks;
        patch.tracksCountry = country;
        patch.tracksVersion = TRACKLIST_VERSION;
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
  }, [album.id, album.date, album.title, album.artist, album.albumTitle, album.tracks.length, album.tracksCountry, album.tracksVersion, album.releaseDate, country, onEnrich]);
}
