// search-view.tsx — Journal: filter the full logged journal by query + genre.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { formatDisplayDate, type Album } from "@/lib/day-of-music/data";
import { useCountry } from "@/lib/day-of-music/profile";
import { useT } from "@/lib/day-of-music/i18n";
import { useThemes } from "@/lib/day-of-music/themes";
import { useJournal } from "@/lib/day-of-music/use-journal";
import { Cover } from "@/components/day-of-music/cover";
import { MetaLine, Stars } from "@/components/day-of-music/atoms";

const RESULT_PAGE_SIZE = 10;

export function SearchView({ onOpen }: { onOpen: (album: Album) => void }) {
  const { allAlbums } = useJournal();
  const { themes } = useThemes();
  const country = useCountry();
  const t = useT();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const resultKey = `${query}:${country}:${allAlbums.length}`;
  const [page, setPage] = useState({ count: RESULT_PAGE_SIZE, key: resultKey });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const themeLabels = useMemo(
    () =>
      new Map(
        themes.map((t) => [t.id, t.emoji ? `${t.emoji} ${t.name}` : t.name]),
      ),
    [themes],
  );

  const results = useMemo(() => {
    const matches = query
      ? allAlbums.filter((a) =>
          [
            a.title,
            a.artist,
            a.titleKo,
            a.albumTitle,
            a.genre,
            a.note,
            a.date,
            formatDisplayDate(a.date, country, "short"),
            String(a.year),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : allAlbums;
    return [...matches].sort((a, b) => b.date.localeCompare(a.date));
  }, [allAlbums, query, country]);
  const visibleCount = page.key === resultKey ? page.count : RESULT_PAGE_SIZE;
  const visibleResults = useMemo(
    () => results.slice(0, visibleCount),
    [results, visibleCount],
  );
  const hasMore = visibleCount < results.length;

  useEffect(() => {
    if (!hasMore) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setPage((current) => {
          const count =
            current.key === resultKey ? current.count : RESULT_PAGE_SIZE;
          return {
            count: Math.min(count + RESULT_PAGE_SIZE, results.length),
            key: resultKey,
          };
        });
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, resultKey, results.length]);

  return (
    <div className="dom-search">
      <div className="dom-week-hd">
        <div className="dom-week-title">
          <span className="dom-eyebrow">{t("journal.eyebrow")}</span>
          <h1>{t("journal.title")}</h1>
        </div>
      </div>

      <div className="dom-search-box">
        <input
          className="dom-input dom-input-lg"
          placeholder={t("journal.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="dom-search-results">
        {visibleResults.map((a) => {
          const themeLabel = themeLabels.get(a.theme) ?? a.theme;
          return (
            <button
              key={`${a.theme}:${a.date}:${a.id}`}
              className="dom-search-result"
              onClick={() => onOpen(a)}
            >
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
                <div className="dom-search-result-dow">{themeLabel}</div>
                <div className="dom-search-result-full-date">
                  {formatDisplayDate(a.date, country, "short")}
                </div>
              </div>
            </button>
          );
        })}
        {hasMore && (
          <div
            ref={loadMoreRef}
            className="dom-search-sentinel"
            aria-hidden="true"
          />
        )}
        {!results.length && (
          <div className="dom-empty">{t("journal.noMatches")}</div>
        )}
      </div>
    </div>
  );
}
