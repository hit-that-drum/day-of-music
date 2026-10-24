// use-album-enrichment.ts — Day Detail's lazy catalog lookup for an iTunes album.
// iTunes albums arrive from Search with no tracklist (Search returns album
// metadata only). The first time such an album is opened, pull its tracks +
// release date from the Lookup API — in the listener's storefront, so titles
// come back localized — and persist them onto the album. We also re-fetch when
// the stored tracklist was saved for a different store (e.g. old US-English
// tracks now viewed as KR), so the same localization the Add flow shows
// applies here too — or by an older version of the route's localization
// (TRACKLIST_VERSION): KR tracklists saved before the route recovered Korean
// titles say "KR" but hold the US store's English.

import { useEffect } from "react";

import type { Album } from "@/lib/day-of-music/data";
import { fetchAlbumDetail } from "@/lib/day-of-music/music-search";
import { TRACKLIST_VERSION } from "@/lib/day-of-music/music-types";

export function useAlbumEnrichment(
  album: Album,
  country: string,
  onEnrich: (date: string, patch: Partial<Album>) => void,
): void {
  useEffect(() => {
    if (!album.id.startsWith("itunes-")) return;
    const needsTracks = album.tracks.length === 0;
    const staleTracks =
      album.tracks.length > 0 &&
      (album.tracksCountry !== country || album.tracksVersion !== TRACKLIST_VERSION);
    const needsDate = !album.releaseDate;
    if (!needsTracks && !staleTracks && !needsDate) return;

    let cancelled = false;
    fetchAlbumDetail(album.id, { country }).then((detail) => {
      if (cancelled || !detail) return;
      const patch: Partial<Album> = {};
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
  }, [album.id, album.date, album.title, album.artist, album.tracks.length, album.tracksCountry, album.tracksVersion, album.releaseDate, country, onEnrich]);
}
