// music-types.ts — shapes shared between the /api/music routes (which build
// them from iTunes Search / Lookup responses) and the client helpers in
// music-search.ts (which consume the routes' JSON). Kept in one place so the
// server and client can't drift.

/** Version of the album route's track-title localization. Bump it when the
 *  route starts returning better-localized titles: the Day Detail stores it on
 *  each album (`tracksVersion`) — and on each single track, for its title —
 *  and re-fetches names saved by an older version once. 2 = KR titles
 *  recovered by track id (KR tracklists saved before that are in the US
 *  store's English). 3 = KR titles for albums the KR store only sells as its
 *  own edition, under other ids (JYP's catalog: "Faded Love" is "사랑이
 *  떠나려 할 때" there), and single tracks renamed too. */
export const TRACKLIST_VERSION = 3;

/** One /api/music/search result: album-level metadata, no tracklist. */
export type MusicSearchResult = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  year: number;
  releaseDate: string;
  artworkUrl: string;
  trackCount: number;
};

/** A single selectable track (for logging one track off an album). */
export type TrackItem = { trackId: number; name: string; artist: string };

/** An album's full metadata plus its tracklist. */
export type AlbumDetail = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  year: number;
  releaseDate: string;
  artworkUrl: string;
  trackCount: number;
  /** Track names in disc/track order. */
  tracks: string[];
  /** Selectable tracks (for logging a single track), disc/track order. */
  trackItems: TrackItem[];
};
