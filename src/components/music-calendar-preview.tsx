import { cn } from "@/lib/utils";
import type { MusicBoardSettings, MusicEntry } from "@/types/music";

type MusicCalendarPreviewProps = {
  entries: MusicEntry[];
  selectedEntryId: string;
  settings: MusicBoardSettings;
  onSelectEntry: (entryId: string) => void;
};

export function MusicCalendarPreview({
  entries,
  selectedEntryId,
  settings,
  onSelectEntry,
}: MusicCalendarPreviewProps) {
  return (
    <section
      aria-label="Music calendar preview"
      className="w-full min-w-[780px] overflow-hidden rounded-md border border-zinc-300 bg-[#f2eee6] p-5 shadow-sm"
    >
      <div className="grid grid-cols-4 overflow-hidden rounded-sm border-l border-t border-zinc-300 bg-white">
        <div className="min-h-80 border-b border-r border-zinc-300 bg-[#ebe2d3]">
          <div className="flex h-12 items-center justify-center border-b border-zinc-300 px-3 text-center text-base font-semibold text-zinc-600">
            {settings.monthLabel} | {settings.weekLabel}
          </div>
          <div className="flex h-[calc(100%-3rem)] items-end justify-start p-6">
            <div>
              <p className="text-xs font-semibold uppercase text-teal-700">
                {settings.title}
              </p>
              <p className="mt-2 max-w-40 text-2xl font-semibold leading-8 text-zinc-900">
                Weekly music board
              </p>
            </div>
          </div>
        </div>

        {entries.map((entry) => (
          <MusicEntryCell
            key={entry.id}
            entry={entry}
            isSelected={entry.id === selectedEntryId}
            onSelect={() => onSelectEntry(entry.id)}
          />
        ))}
      </div>
    </section>
  );
}

type MusicEntryCellProps = {
  entry: MusicEntry;
  isSelected: boolean;
  onSelect: () => void;
};

function MusicEntryCell({ entry, isSelected, onSelect }: MusicEntryCellProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-selection-ring={isSelected ? "true" : undefined}
      className={cn(
        "group min-h-80 border-b border-r border-zinc-300 bg-white text-left transition hover:bg-zinc-50",
        isSelected && "shadow-[inset_0_0_0_2px_#0f766e]",
      )}
      aria-pressed={isSelected}
    >
      <div className="flex h-12 items-center justify-center border-b border-zinc-300 bg-[#ebe2d3] px-3 text-center text-base font-semibold text-zinc-600">
        {entry.day} | {entry.weekday}
      </div>
      <div className="flex min-h-68 flex-col items-center justify-center px-7 py-5 text-center">
        <AlbumArtwork entry={entry} />
        <div className="mt-5 w-full">
          <h2 className="truncate text-base font-bold text-zinc-950">
            {entry.title}
          </h2>
          <p className="mt-1 truncate text-sm font-semibold text-rose-500">
            {entry.artist}
          </p>
          <p className="mt-2 truncate text-[11px] font-medium text-zinc-400">
            {entry.genre} - {entry.releaseDate} - {entry.releaseType} -{" "}
            {entry.label}
          </p>
        </div>
      </div>
    </button>
  );
}

function AlbumArtwork({ entry }: { entry: MusicEntry }) {
  if (entry.coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Raw img keeps crossOrigin available for DOM PNG export.
      <img
        src={entry.coverUrl}
        alt={`${entry.title} cover`}
        crossOrigin="anonymous"
        className="aspect-square w-full max-w-44 rounded-md object-cover shadow-[0_16px_32px_rgba(15,23,42,0.18)]"
      />
    );
  }

  return (
    <div
      className="relative aspect-square w-full max-w-44 overflow-hidden rounded-md shadow-[0_16px_32px_rgba(15,23,42,0.18)]"
      style={{
        background: `linear-gradient(135deg, ${entry.background}, ${entry.accent})`,
      }}
      aria-label={`${entry.title} cover placeholder`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(255,255,255,0.42),transparent_28%),radial-gradient(circle_at_75%_80%,rgba(255,255,255,0.24),transparent_30%)]" />
      <div className="absolute left-4 right-4 top-4 h-px bg-white/50" />
      <div className="absolute bottom-4 left-4 right-4">
        <p className="truncate text-left text-xs font-semibold uppercase text-white/80">
          {entry.artist}
        </p>
        <p className="mt-1 line-clamp-2 text-left text-xl font-black leading-6 text-white">
          {entry.title}
        </p>
      </div>
    </div>
  );
}
