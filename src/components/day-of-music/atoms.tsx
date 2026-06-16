// atoms.tsx — small shared presentational atoms for Day of Music.

import type { ReactNode } from "react";

import type { Album } from "@/lib/day-of-music/data";

export function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className="dom-chip" data-active={active ? "1" : "0"} onClick={onClick}>
      {children}
    </button>
  );
}

export function Stars({
  value = 0,
  size = 12,
  color,
}: {
  value?: number;
  size?: number;
  color?: string;
}) {
  return (
    <span style={{ display: "inline-flex", gap: size * 0.1 }}>
      {Array.from({ length: 5 }, (_, i) => {
        const on = i + 1 <= value;
        return (
          <span
            key={i}
            style={{
              color: on ? color || "var(--ink)" : "var(--lineSoft)",
              fontSize: size,
              lineHeight: 1,
            }}
          >
            ★
          </span>
        );
      })}
    </span>
  );
}

export function MetaLine({
  album,
  size = 9,
  showFormat = false,
}: {
  album: Album;
  size?: number;
  showFormat?: boolean;
}) {
  return (
    <div className="dom-meta" style={{ fontSize: size }}>
      {album.genre} <span className="dom-dot">·</span> {album.year}
      {showFormat ? (
        <>
          {" "}
          <span className="dom-dot">·</span> {album.format}
        </>
      ) : null}
    </div>
  );
}
