import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { MusicEntry } from "@/lib/store";

type Props = {
  entry: MusicEntry;
  selected?: boolean;
};

/**
 * Single day card on the weekly board. Tapping it opens the entry editor.
 *
 * Styling uses NativeWind so the class strings look like the web app's
 * Tailwind, but `accent` / `background` come from the entry data and have to
 * be applied via inline style — those colors are user-defined hex codes and
 * can't be expressed as static Tailwind classes.
 */
export function MusicCard({ entry, selected }: Props) {
  return (
    <Link href={`/edit/${entry.id}`} asChild>
      <Pressable
        className={
          "mb-3 overflow-hidden rounded-2xl border " +
          (selected ? "border-white/80" : "border-white/10")
        }
        style={{ backgroundColor: entry.background }}
      >
        <View className="px-4 py-5">
          <View className="flex-row items-baseline justify-between">
            <Text
              className="text-2xl font-bold tracking-widest"
              style={{ color: entry.accent }}
            >
              {entry.weekday}
            </Text>
            <Text
              className="text-sm opacity-80"
              style={{ color: entry.accent }}
            >
              {entry.releaseType} · {entry.releaseDate}
            </Text>
          </View>

          <Text
            className="mt-3 text-xl font-semibold text-white"
            numberOfLines={2}
          >
            {entry.title}
          </Text>
          <Text className="mt-1 text-base text-white/80">{entry.artist}</Text>

          <View className="mt-4 flex-row items-center gap-x-3">
            <Text className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/90">
              {entry.genre}
            </Text>
            <Text className="text-xs text-white/60">{entry.label}</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
