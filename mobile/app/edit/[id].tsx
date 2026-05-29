import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { type MusicEntry, useMusicBoardStore } from "@/lib/store";

const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

type Draft = Pick<
  MusicEntry,
  "title" | "artist" | "genre" | "label" | "releaseType" | "releaseDate"
>;

/**
 * Modal screen for editing a single day's release. Reads the entry by id from
 * the shared Zustand store (same store the web editor uses). Saves write back
 * through `updateEntry`.
 */
export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const entries = useMusicBoardStore((state) => state.entries);
  const entry = useMusicBoardStore((state) =>
    state.entries.find((item) => item.id === id),
  );
  const addEntry = useMusicBoardStore((state) => state.addEntry);
  const updateEntry = useMusicBoardStore((state) => state.updateEntry);
  const [newEntryId] = useState(() => `custom-${Date.now()}`);

  const nextDay = useMemo(
    () => Math.max(0, ...entries.map((item) => item.day)) + 1,
    [entries],
  );

  const editableEntry = useMemo<MusicEntry | undefined>(() => {
    if (!isNew) {
      return entry;
    }

    return {
      id: newEntryId,
      day: nextDay,
      weekday: weekdays[(nextDay - 1) % weekdays.length],
      title: "",
      artist: "",
      releaseType: "Single",
      releaseDate: String(new Date().getFullYear()),
      genre: "K-Pop",
      label: "Stereo",
      accent: "#14b8a6",
      background: "#172554",
    };
  }, [entry, isNew, newEntryId, nextDay]);

  // Local form state seeded from the store so typing feels instant. We commit
  // on Save instead of on every keystroke to avoid re-rendering the home list.
  const initial = useMemo<Draft>(
    () => ({
      title: editableEntry?.title ?? "",
      artist: editableEntry?.artist ?? "",
      genre: editableEntry?.genre ?? "",
      label: editableEntry?.label ?? "",
      releaseType: editableEntry?.releaseType ?? "Single",
      releaseDate:
        editableEntry?.releaseDate ?? String(new Date().getFullYear()),
    }),
    [editableEntry],
  );
  const [draft, setDraft] = useState(initial);

  if (!editableEntry) {
    return (
      <View className="flex-1 items-center justify-center bg-ink p-6">
        <Text className="text-paper">No entry found for {id}.</Text>
        <Pressable
          className="mt-4 rounded-full bg-white/10 px-4 py-2"
          onPress={() => router.back()}
        >
          <Text className="text-paper">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const handleSave = () => {
    if (isNew) {
      addEntry({
        ...editableEntry,
        ...draft,
        title: draft.title.trim() || "Untitled release",
        artist: draft.artist.trim() || "Unknown artist",
      });
    } else {
      updateEntry(editableEntry.id, draft);
    }

    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-ink"
    >
      <Stack.Screen
        options={{ title: isNew ? "Add release" : editableEntry.weekday }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Field
          label="Title"
          value={draft.title}
          onChange={(value) => setDraft((d) => ({ ...d, title: value }))}
        />
        <Field
          label="Artist"
          value={draft.artist}
          onChange={(value) => setDraft((d) => ({ ...d, artist: value }))}
        />
        <Field
          label="Release type"
          value={draft.releaseType}
          onChange={(value) => setDraft((d) => ({ ...d, releaseType: value }))}
        />
        <Field
          label="Release year"
          value={draft.releaseDate}
          keyboardType="number-pad"
          onChange={(value) => setDraft((d) => ({ ...d, releaseDate: value }))}
        />
        <Field
          label="Genre"
          value={draft.genre}
          onChange={(value) => setDraft((d) => ({ ...d, genre: value }))}
        />
        <Field
          label="Label / tag"
          value={draft.label}
          onChange={(value) => setDraft((d) => ({ ...d, label: value }))}
        />

        <Pressable
          onPress={handleSave}
          className="mt-2 items-center rounded-2xl bg-accent px-4 py-4"
        >
          <Text className="text-base font-semibold text-white">Save</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  keyboardType?: "default" | "number-pad";
  onChange: (value: string) => void;
};

function Field({
  label,
  value,
  keyboardType = "default",
  onChange,
}: FieldProps) {
  return (
    <View>
      <Text className="mb-2 text-xs uppercase tracking-widest text-white/60">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholderTextColor="#ffffff55"
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-paper"
      />
    </View>
  );
}
