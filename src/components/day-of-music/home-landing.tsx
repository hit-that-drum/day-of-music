// home-landing.tsx — public landing page at "/".
// Everyone (guest or signed-in) can see this and jump into the Week board.

"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import type { Album } from "@/lib/day-of-music/data";
import { applyTheme, ensureFonts } from "@/lib/day-of-music/theme";
import { useAuth } from "@/components/day-of-music/auth-provider";
import { BrandMark } from "@/components/day-of-music/atoms";
import { Button, buttonClass } from "@/components/day-of-music/atoms";
import { Cover } from "@/components/day-of-music/cover";

// Self-contained decorative covers for the hero — purely typographic tiles,
// not real albums. (The seed catalog is intentionally empty; albums now come
// only from iTunes search.)
const HERO_COVERS: Album[] = (
  [
    { style: "stack", bg: "#b9a3d9", fg: "#1a1430", accent: "#f6e6ff", title: "side a" },
    { style: "ring", bg: "#10243a", fg: "#dce9f5", accent: "#5fa8d3", title: "nocturne" },
    { style: "split", bg: "#1d1a18", fg: "#f4d35e", accent: "#c75146", title: "reprise" },
    { style: "block", bg: "#222a22", fg: "#d9e8d4", accent: "#8aa86e", title: "encore" },
  ] as const
).map((t, i) => ({
  id: `hero-${i}`,
  date: "",
  title: t.title,
  titleKo: "",
  artist: "Day of Music",
  genre: "",
  year: 0,
  format: "",
  cover: { style: t.style, bg: t.bg, fg: t.fg, accent: t.accent },
  note: "",
  rating: 0,
  tracks: [],
}));

export function HomeLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { configured, user, signOut } = useAuth();

  useEffect(() => {
    ensureFonts();
    applyTheme(rootRef.current, "editorial", "editorial");
  }, []);

  return (
    <div className="dom-stage" ref={rootRef}>
      <div className="dom-root" data-grid="1">
        <header className="dom-topbar">
          <div className="dom-brand">
            <BrandMark />
            <span className="dom-brand-name">Day of Music</span>
            <span className="dom-brand-ko">하루의 음악</span>
          </div>
          <div className="dom-topbar-actions">
            {configured && user ? (
              <span className="dom-account">
                <span className="dom-account-email" title={user.email ?? ""}>
                  {user.email}
                </span>
                <Button variant="ghost" onClick={signOut}>
                  Sign out
                </Button>
              </span>
            ) : (
              <>
                <Link href="/signin" className={buttonClass("ghost")}>
                  Sign in
                </Link>
                <Link href="/signup" className={buttonClass()}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        </header>

        <main className="dom-main" style={{ display: "grid", placeItems: "center" }}>
          <div className="dom-home-hero">
            <div className="dom-signin-eyebrow">하루의 음악 · one album a day</div>
            <h1 className="dom-home-title">
              Your week,
              <br />
              set to music.
            </h1>
            <p className="dom-home-sub">
              Log one album a day, rate it, write a line you&apos;ll want to remember —
              then share your week as a single image. Search the whole catalog, or
              just browse what you&apos;ve logged.
            </p>

            <div className="dom-home-covers">
              {HERO_COVERS.map((a) => (
                <Cover key={a.id} album={a} size={120} />
              ))}
            </div>

            <div className="dom-home-actions">
              <Link href="/week" className={buttonClass("solid", "lg")}>
                Open the week board →
              </Link>
              {!user && (
                <Link href="/signup" className={buttonClass("ghost")}>
                  Create an account
                </Link>
              )}
            </div>
            {!user && (
              <p className="dom-home-note">
                No account needed to try it — but guest edits vanish when you leave.
                Sign up to keep your journal.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
