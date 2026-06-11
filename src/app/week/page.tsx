import type { Metadata } from "next";

import { DayOfMusicApp } from "@/components/day-of-music/day-of-music-app";

export const metadata: Metadata = {
  title: "Week — Day of Music",
};

export default function WeekPage() {
  return <DayOfMusicApp />;
}
