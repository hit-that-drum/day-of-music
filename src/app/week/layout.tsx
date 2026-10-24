import type { ReactNode } from "react";

import { JournalProvider } from "@/lib/day-of-music/use-journal";

// The journal is provided here rather than at the root: /week is the only
// route that reads it, and a signed-in visitor of a share link, the landing
// page or the sign-in form shouldn't load their whole journal (with its
// backfill and recovery passes) for nothing.
export default function WeekLayout({ children }: { children: ReactNode }) {
  return <JournalProvider>{children}</JournalProvider>;
}
