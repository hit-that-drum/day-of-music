// atoms.tsx — small shared presentational atoms for Day of Music.

import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { normalizeGenre, type Album } from "@/lib/day-of-music/data";

export type ButtonVariant = "solid" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "md" | "sm" | "lg";

// Single source of truth for button classes. `danger-ghost` needs both
// dom-btn-ghost (transparent fill + border) and dom-btn-danger-ghost (red text),
// since the latter only recolors. Exposed as a helper so <Link>s that must look
// like buttons (they can't be <button>) share the exact same styling.
export function buttonClass(
  variant: ButtonVariant = "solid",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return [
    "dom-btn",
    variant === "ghost" && "dom-btn-ghost",
    variant === "danger" && "dom-btn-danger",
    variant === "danger-ghost" && "dom-btn-ghost dom-btn-danger-ghost",
    size === "sm" && "dom-btn-sm",
    size === "lg" && "dom-btn-lg",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

// The app's standard button. Defaults to type="button" so it never acts as an
// accidental form-submit; pass type="submit" explicitly where needed.
export function Button({
  variant = "solid",
  size = "md",
  type = "button",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function IconButton({
  icon: Icon,
  iconSize = 18,
  type = "button",
  className,
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  icon: LucideIcon;
  iconSize?: number;
}) {
  return (
    <button
      type={type}
      className={["dom-iconbtn", className].filter(Boolean).join(" ")}
      {...props}
    >
      <Icon size={iconSize} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

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
  const genre = normalizeGenre(album.genre);

  return (
    <div className="dom-meta" style={{ fontSize: size }}>
      {genre ? (
        <>
          {genre} <span className="dom-dot">·</span>{" "}
        </>
      ) : null}
      {album.year}
      {showFormat ? (
        <>
          {" "}
          <span className="dom-dot">·</span> {album.format}
        </>
      ) : null}
    </div>
  );
}
