import "../global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  // Create the QueryClient inside state so it survives Fast Refresh without
  // resetting the cache on every render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // RN apps come back to foreground often; let TanStack manage staleness.
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#0b1020" },
              headerTintColor: "#f7f6f1",
              contentStyle: { backgroundColor: "#0b1020" },
            }}
          >
            <Stack.Screen name="index" options={{ title: "Day of Music" }} />
            <Stack.Screen
              name="edit/[id]"
              options={{ title: "Edit entry", presentation: "modal" }}
            />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
