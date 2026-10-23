// itunes-lookup.ts — iTunes Lookup helpers shared by the /api/music routes
// (album detail + search). Server-side only: plain fetches, no React.
//
// Why look things up by id: some storefronts — notably KR — answer an album
// lookup with the album but none of its songs, and the KR search index comes
// back empty for every query (observed Oct 2026; it used to carry the songs).
// So the routes end up with albums and tracklists from a fallback store
// (usually US), named in that store's language: "Highway", "JAMONG SALGU CLUB",
// "HANRORO". Looked up BY ID in the listener's store, the same items come back
// localized: song rows carry the Korean title ("하이웨이") and the album's
// Korean name ("자몽살구클럽" — the album row itself may stay romanized), album
// rows carry the Korean artist ("한로로"). Catalog ids are the same in every
// store, so ids from the fallback store resolve here; an item the store doesn't
// carry is simply missing from the result.

/** The fields of an iTunes Lookup row these helpers read. */
type LookupRow = {
  wrapperType?: string;
  collectionId?: number;
  trackId?: number;
  collectionName?: string;
  artistName?: string;
};

/** Look `ids` up in `store` — albums and songs may be mixed — with optional
 *  extra query params (entity=song&limit=1 → one song per album). One request
 *  per 150 ids (a lookup takes at least 200; this keeps the URL under ~2,000
 *  chars), so only a long list needs a second call; a failed batch just adds no
 *  rows. No lang override → names come back in the store's own language. */
export async function lookupByIds<T = LookupRow>(
  store: string,
  ids: number[],
  params: Record<string, string> = {},
): Promise<T[]> {
  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += 150) batches.push(ids.slice(i, i + 150));
  const rows = await Promise.all(
    batches.map(async (batch) => {
      const lookupUrl = new URL("https://itunes.apple.com/lookup");
      lookupUrl.searchParams.set("id", batch.join(","));
      lookupUrl.searchParams.set("country", store);
      for (const [key, value] of Object.entries(params))
        lookupUrl.searchParams.set(key, value);
      try {
        // Cache identical lookups for an hour (iTunes rate limit is ~20/min).
        const resp = await fetch(lookupUrl, { next: { revalidate: 3600 } });
        if (!resp.ok) return [];
        return (JSON.parse(await resp.text()).results ?? []) as T[];
      } catch {
        return [];
      }
    }),
  );
  return rows.flat();
}

/** Re-localize album search results that came from a fallback store
 *  (`fromStore`) into the listener's store (`toStore`): the album title from
 *  that store's song rows, the artist from its album rows. Two requests — one
 *  song id per album from the store that has the songs, then the albums plus
 *  those songs in the listener's store. A result the listener's store doesn't
 *  carry keeps its fallback names; order and every other field are untouched. */
export async function localizeAlbumsInto<
  R extends { id: string; title: string; artist: string },
>(results: R[], fromStore: string, toStore: string): Promise<R[]> {
  const albumIdOf = (r: R) => Number(r.id.replace(/^itunes-/, ""));
  const albumIds = results
    .map(albumIdOf)
    .filter((id) => Number.isInteger(id) && id > 0);
  if (fromStore === toStore || albumIds.length === 0) return results;

  const songIds = (
    await lookupByIds(fromStore, albumIds, { entity: "song", limit: "1" })
  )
    .filter((x) => x.wrapperType === "track" && x.trackId != null)
    .map((x) => x.trackId as number);

  const titleByAlbum = new Map<number, string>();
  const artistByAlbum = new Map<number, string>();
  for (const x of await lookupByIds(toStore, [...albumIds, ...songIds])) {
    if (x.collectionId == null) continue;
    if (x.wrapperType === "collection" && x.artistName) {
      artistByAlbum.set(x.collectionId, x.artistName);
    } else if (x.wrapperType === "track" && x.collectionName) {
      titleByAlbum.set(x.collectionId, x.collectionName);
    }
  }

  return results.map((r) => {
    const title = titleByAlbum.get(albumIdOf(r));
    const artist = artistByAlbum.get(albumIdOf(r));
    return title || artist
      ? { ...r, title: title ?? r.title, artist: artist ?? r.artist }
      : r;
  });
}
