// search-view.tsx — Search / Discover: filter the journal by query + genre.

"use client";

import { useMemo, useState } from "react";

import { DOW, parseDate, type Album } from "@/lib/day-of-music/data";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { Cover } from "@/components/day-of-music/cover";
import { Chip, MetaLine, Stars } from "@/components/day-of-music/atoms";

export function SearchView({ onOpen }: { onOpen: (album: Album) => void }) {
  const { albums } = useJournal();
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("All");

  const genres = useMemo(() => Array.from(new Set(albums.map((a) => a.genre))), [albums]);

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return albums.filter((a) => {
      if (genre !== "All" && a.genre !== genre) return false;
      if (!query) return true;
      return `${a.title} ${a.artist}`.toLowerCase().includes(query);
    });
  }, [albums, q, genre]);

  return (
    <div className="dom-search">
      <div className="dom-week-hd">
        <div className="dom-week-title">
          <span className="dom-eyebrow">발견 · discover</span>
          <h1>Search the journal</h1>
        </div>
      </div>

      <div className="dom-search-box">
        <input
          className="dom-input dom-input-lg"
          placeholder="Search albums, artists…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="dom-search-filters">
        <Chip active={genre === "All"} onClick={() => setGenre("All")}>
          All
        </Chip>
        {genres.map((g) => (
          <Chip key={g} active={genre === g} onClick={() => setGenre(g)}>
            {g}
          </Chip>
        ))}
      </div>

      <div className="dom-search-results">
        {filtered.map((a) => {
          const d = parseDate(a.date);
          return (
            <button key={a.id} className="dom-search-result" onClick={() => onOpen(a)}>
              <div>
                <Cover album={a} size="100%" />
              </div>
              <div className="dom-search-result-info">
                <div className="dom-search-result-title">{a.title}</div>
                <div className="dom-search-result-artist">
                  {a.artist}
                  {a.titleKo && <span> · {a.titleKo}</span>}
                </div>
                <MetaLine album={a} size={10} />
                <div style={{ marginTop: 6 }}>
                  <Stars value={a.rating} size={11} />
                </div>
              </div>
              <div className="dom-search-result-date">
                <div className="dom-search-result-day">
                  {String(d.getDate()).padStart(2, "0")}
                </div>
                <div className="dom-search-result-dow">{DOW[d.getDay()]}</div>
              </div>
            </button>
          );
        })}
        {!filtered.length && <div className="dom-empty">No matches. Try clearing filters.</div>}
      </div>
    </div>
  );
}
