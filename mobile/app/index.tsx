import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MusicCard } from "@/components/music-card";
import { useMusicBoardStore } from "@/lib/store";

export default function HomeScreen() {
  const entries = useMusicBoardStore((state) => state.entries);
  const settings = useMusicBoardStore((state) => state.settings);
  const selectedId = useMusicBoardStore((state) => state.selectedEntryId);

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-ink">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        <View className="mb-6">
          <Text className="text-xs uppercase tracking-[6px] text-white/50">
            {settings.monthLabel} · {settings.weekLabel}
          </Text>
          <Text className="mt-1 text-4xl font-bold text-paper">
            {settings.title}
          </Text>
          <Text className="mt-2 text-sm text-white/60">
            Tap any day to edit its release.
          </Text>
        </View>

        {entries.map((entry) => (
          <MusicCard
            key={entry.id}
            entry={entry}
            selected={entry.id === selectedId}
          />
        ))}

        <Link href="/edit/new" asChild>
          <Pressable className="mt-2 items-center rounded-2xl border border-white/20 bg-white/5 px-4 py-4">
            <Text className="text-base font-medium text-paper">
              + Add a release
            </Text>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
