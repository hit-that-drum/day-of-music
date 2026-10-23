import type { Metadata } from "next";
import { cookies } from "next/headers";

import { DayOfMusicApp } from "@/components/day-of-music/day-of-music-app";
import { TZ_COOKIE, todayInZone } from "@/lib/day-of-music/today";

// The board shows "today", so never bake a build-time date into static HTML.
// (cookies() below already makes the route dynamic; this states the intent.)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Week — Day of Music",
};

export default async function WeekPage() {
  // "Today" is the listener's calendar date, not the server's. After the first
  // visit the browser leaves its zone in a cookie (see rememberTimeZone), so
  // the HTML can mark the right day from the start; without it (first visit,
  // cookies blocked) the server's own zone is used and the client corrects the
  // day after mount. Computed per request — a long-lived server must not serve
  // the day it booted on.
  const tz = (await cookies()).get(TZ_COOKIE)?.value;
  return <DayOfMusicApp initialToday={todayInZone(tz)} />;
}
