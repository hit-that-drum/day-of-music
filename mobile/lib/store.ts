import { create } from "zustand";

export type MusicEntry = {
  id: string;
  day: number;
  weekday: string;
  title: string;
  artist: string;
  releaseType: string;
  releaseDate: string;
  genre: string;
  label: string;
  coverUrl?: string;
  accent: string;
  background: string;
};

export type MusicBoardSettings = {
  monthLabel: string;
  weekLabel: string;
  title: string;
};

const demoEntries: MusicEntry[] = [
  {
    id: "mon",
    day: 2,
    weekday: "MON",
    title: "Growing Paint pt.1 : FREE",
    artist: "Aive",
    releaseType: "EP",
    releaseDate: "2026",
    genre: "K-Pop",
    label: "Dolby Atmos",
    accent: "#ef5d75",
    background: "#84cc16",
  },
  {
    id: "tue",
    day: 3,
    weekday: "TUE",
    title: "Mozart: Requiem",
    artist: "Wiener Philharmoniker",
    releaseType: "Album",
    releaseDate: "1987",
    genre: "Classical",
    label: "Remaster",
    accent: "#2563eb",
    background: "#111827",
  },
  {
    id: "wed",
    day: 4,
    weekday: "WED",
    title: "REVIVE+",
    artist: "Aive",
    releaseType: "Single",
    releaseDate: "2026",
    genre: "K-Pop",
    label: "Dolby Atmos",
    accent: "#38bdf8",
    background: "#172554",
  },
  {
    id: "thu",
    day: 5,
    weekday: "THU",
    title: "Archive. 1",
    artist: "Woodz",
    releaseType: "Mini Album",
    releaseDate: "2026",
    genre: "K-Pop",
    label: "Stereo",
    accent: "#ef4444",
    background: "#e5e7eb",
  },
  {
    id: "fri",
    day: 6,
    weekday: "FRI",
    title: "Phantom",
    artist: "WayV",
    releaseType: "Mini Album",
    releaseDate: "2022",
    genre: "Mandopop",
    label: "Explicit",
    accent: "#b91c1c",
    background: "#450a0a",
  },
  {
    id: "sat",
    day: 7,
    weekday: "SAT",
    title: "Seed",
    artist: "Porno Graffitti",
    releaseType: "EP",
    releaseDate: "2026",
    genre: "J-Pop",
    label: "Dolby Atmos",
    accent: "#22c55e",
    background: "#3b0764",
  },
  {
    id: "sun",
    day: 8,
    weekday: "SUN",
    title: "DEADLINE",
    artist: "BLACKPINK",
    releaseType: "EP",
    releaseDate: "2025",
    genre: "K-Pop",
    label: "Dolby Atmos",
    accent: "#f472b6",
    background: "#020617",
  },
];

const demoSettings: MusicBoardSettings = {
  monthLabel: "MARCH",
  weekLabel: "WEEK 2",
  title: "Day of Music",
};

type MusicBoardStore = {
  entries: MusicEntry[];
  selectedEntryId: string;
  settings: MusicBoardSettings;
  addEntry: (entry: MusicEntry) => void;
  selectEntry: (entryId: string) => void;
  updateEntry: (entryId: string, entry: Partial<MusicEntry>) => void;
  updateSettings: (settings: Partial<MusicBoardSettings>) => void;
  resetDemo: () => void;
};

export const useMusicBoardStore = create<MusicBoardStore>((set) => ({
  entries: demoEntries,
  selectedEntryId: demoEntries[0].id,
  settings: demoSettings,
  addEntry: (entry) =>
    set((state) => ({
      entries: [...state.entries, entry],
      selectedEntryId: entry.id,
    })),
  selectEntry: (entryId) => set({ selectedEntryId: entryId }),
  updateEntry: (entryId, entry) =>
    set((state) => ({
      entries: state.entries.map((item) =>
        item.id === entryId ? { ...item, ...entry } : item,
      ),
    })),
  updateSettings: (settings) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ...settings,
      },
    })),
  resetDemo: () =>
    set({
      entries: demoEntries,
      selectedEntryId: demoEntries[0].id,
      settings: demoSettings,
    }),
}));
