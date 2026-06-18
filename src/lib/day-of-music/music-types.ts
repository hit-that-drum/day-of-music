// music-types.ts — shapes shared between the /api/music/album route (which
// builds them from the iTunes Lookup response) and the client helpers in
// music-search.ts (which consume the route's JSON). Kept in one place so the
// server and client can't drift.

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
