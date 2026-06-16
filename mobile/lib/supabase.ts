// Supabase client for React Native.
//
// Differences from the web client (src/lib/supabase/...):
//   - Reads from EXPO_PUBLIC_* env vars instead of NEXT_PUBLIC_*.
//   - Persists sessions in AsyncStorage instead of localStorage.
//   - URL polyfill is required because RN does not ship a full URL
//     implementation, which @supabase/supabase-js depends on.

import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy mobile/.env.example to mobile/.env and fill in your project values.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Mobile apps never have a session URL fragment to read from.
    detectSessionInUrl: false,
  },
});
