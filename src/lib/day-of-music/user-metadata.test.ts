import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { readUserMetadata } from "@/lib/day-of-music/user-metadata";

const userWith = (meta: unknown) => ({ id: "user-1", user_metadata: meta }) as unknown as User;

describe("readUserMetadata", () => {
  it("reads the synced preferences", () => {
    const themes = [{ id: "daily", name: "Daily", emoji: "🎧" }];
    expect(
      readUserMetadata(userWith({ username: "kim", country: "KR", language: "ko", themes })),
    ).toEqual({ username: "kim", country: "KR", language: "ko", themes });
  });

  it("leaves out fields of the wrong shape instead of trusting them", () => {
    expect(
      readUserMetadata(userWith({ username: 3, language: "fr", themes: "daily", bestOf: null })),
    ).toEqual({});
  });

  it("accepts the auto language and an account with no metadata", () => {
    expect(readUserMetadata(userWith({ language: "auto" })).language).toBe("auto");
    expect(readUserMetadata(userWith(undefined))).toEqual({});
  });
});
