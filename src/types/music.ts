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
