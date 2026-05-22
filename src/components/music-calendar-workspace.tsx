"use client";

import { Music2, RefreshCcw } from "lucide-react";
import { useMemo, useRef } from "react";

import { ExportPosterButton } from "@/components/export-poster-button";
import { InstallAppButton } from "@/components/install-app-button";
import { MusicCalendarPreview } from "@/components/music-calendar-preview";
import { Button } from "@/components/ui/button";
import { useMusicBoardStore } from "@/store/use-music-board-store";
import type { MusicEntry } from "@/types/music";

const inputClassName =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

const labelClassName = "text-xs font-semibold uppercase text-zinc-500";

type EditableMusicEntryField = keyof Pick<
  MusicEntry,
  | "title"
  | "artist"
  | "releaseType"
  | "releaseDate"
  | "genre"
  | "label"
  | "coverUrl"
>;

export function MusicCalendarWorkspace() {
  const posterRef = useRef<HTMLDivElement>(null);
  const {
    entries,
    selectedEntryId,
    settings,
    selectEntry,
    updateEntry,
    updateSettings,
    resetDemo,
  } = useMusicBoardStore();

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? entries[0],
    [entries, selectedEntryId],
  );

  const updateSelectedEntry = (
    field: EditableMusicEntryField,
    value: string,
  ) => {
    if (!selectedEntry) {
      return;
    }

    updateEntry(selectedEntry.id, {
      [field]: field === "coverUrl" && value.trim() === "" ? undefined : value,
    });
  };

  return (
    <main className="min-h-screen bg-[#f6f7f8] text-zinc-950">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-950 text-white">
              <Music2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-7">Day of Music</h1>
              <p className="text-sm text-zinc-500">
                Music calendar image maker
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={resetDemo}
              title="Reset demo board"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Reset
            </Button>
            <InstallAppButton />
            <ExportPosterButton targetRef={posterRef} />
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="space-y-5">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900">Board</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className={labelClassName}>Month</span>
                    <input
                      className={inputClassName}
                      value={settings.monthLabel}
                      onChange={(event) =>
                        updateSettings({ monthLabel: event.target.value })
                      }
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className={labelClassName}>Week</span>
                    <input
                      className={inputClassName}
                      value={settings.weekLabel}
                      onChange={(event) =>
                        updateSettings({ weekLabel: event.target.value })
                      }
                    />
                  </label>
                </div>
                <label className="block space-y-1.5">
                  <span className={labelClassName}>Title</span>
                  <input
                    className={inputClassName}
                    value={settings.title}
                    onChange={(event) =>
                      updateSettings({ title: event.target.value })
                    }
                  />
                </label>
              </section>

              {selectedEntry ? (
                <section className="space-y-3 border-t border-zinc-200 pt-5">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      {selectedEntry.day} | {selectedEntry.weekday}
                    </h2>
                    <p className="text-xs text-zinc-500">
                      {selectedEntry.artist}
                    </p>
                  </div>

                  <label className="block space-y-1.5">
                    <span className={labelClassName}>Album</span>
                    <input
                      className={inputClassName}
                      value={selectedEntry.title}
                      onChange={(event) =>
                        updateSelectedEntry("title", event.target.value)
                      }
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={labelClassName}>Artist</span>
                    <input
                      className={inputClassName}
                      value={selectedEntry.artist}
                      onChange={(event) =>
                        updateSelectedEntry("artist", event.target.value)
                      }
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={labelClassName}>Cover URL</span>
                    <input
                      className={inputClassName}
                      value={selectedEntry.coverUrl ?? ""}
                      onChange={(event) =>
                        updateSelectedEntry("coverUrl", event.target.value)
                      }
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1.5">
                      <span className={labelClassName}>Year</span>
                      <input
                        className={inputClassName}
                        value={selectedEntry.releaseDate}
                        onChange={(event) =>
                          updateSelectedEntry("releaseDate", event.target.value)
                        }
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className={labelClassName}>Type</span>
                      <input
                        className={inputClassName}
                        value={selectedEntry.releaseType}
                        onChange={(event) =>
                          updateSelectedEntry("releaseType", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1.5">
                      <span className={labelClassName}>Genre</span>
                      <input
                        className={inputClassName}
                        value={selectedEntry.genre}
                        onChange={(event) =>
                          updateSelectedEntry("genre", event.target.value)
                        }
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className={labelClassName}>Label</span>
                      <input
                        className={inputClassName}
                        value={selectedEntry.label}
                        onChange={(event) =>
                          updateSelectedEntry("label", event.target.value)
                        }
                      />
                    </label>
                  </div>
                </section>
              ) : null}
            </div>
          </aside>

          <section className="min-w-0 rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="overflow-x-auto pb-2">
              <div ref={posterRef} className="inline-block min-w-full">
                <MusicCalendarPreview
                  entries={entries}
                  selectedEntryId={selectedEntryId}
                  settings={settings}
                  onSelectEntry={selectEntry}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
