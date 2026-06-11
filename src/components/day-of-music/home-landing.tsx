// home-landing.tsx — public landing page at "/".
// Everyone (guest or signed-in) can see this and jump into the Week board.

"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { ALBUMS } from "@/lib/day-of-music/data";
import { applyTheme, ensureFonts } from "@/lib/day-of-music/theme";
import { useAuth } from "@/components/day-of-music/auth-provider";
import { Cover } from "@/components/day-of-music/cover";

const SAMPLE_ALBUMS = ALBUMS.slice(0, 4);

export function HomeLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { configured, user, signOut } = useAuth();

  useEffect(() => {
    ensureFonts();
    applyTheme(rootRef.current, "editorial", "editorial");
  }, []);

  return (
    <div className="dom-stage">
      <div className="dom-root" ref={rootRef} data-grid="1" data-rail="0">
        <header className="dom-topbar">
          <div className="dom-brand">
            <span className="dom-brand-mark">●</span>
            <span className="dom-brand-name">Day of Music</span>
            <span className="dom-brand-ko">하루의 음악</span>
          </div>
          <div className="dom-topbar-actions">
            {configured && user ? (
              <span className="dom-account">
                <span className="dom-account-email" title={user.email ?? ""}>
                  {user.email}
                </span>
                <button className="dom-btn dom-btn-ghost" onClick={signOut}>
                  Sign out
                </button>
              </span>
            ) : (
              <>
                <Link href="/signin" className="dom-btn dom-btn-ghost">
                  Sign in
                </Link>
                <Link href="/signup" className="dom-btn">
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
              {SAMPLE_ALBUMS.map((a) => (
                <Cover key={a.id} album={a} size={120} />
              ))}
            </div>

            <div className="dom-home-actions">
              <Link href="/week" className="dom-btn dom-btn-lg">
                Open the week board →
              </Link>
              {!user && (
                <Link href="/signup" className="dom-btn dom-btn-ghost">
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
