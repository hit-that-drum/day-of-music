import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withTimeout } from "@/lib/supabase/client";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the value and clears its timer", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000, "call")).resolves.toBe("ok");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes the original rejection through and clears its timer", async () => {
    const error = new Error("boom");
    await expect(withTimeout(Promise.reject(error), 1000, "call")).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a call that never settles at the deadline, not before", async () => {
    let message: string | undefined;
    withTimeout(new Promise<never>(() => {}), 1000, "getSession").catch((e: Error) => {
      message = e.message;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(message).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(message).toBe("getSession timed out after 1000ms (call never settled)");
  });

  it("accepts a bare thenable, like a supabase-js query builder", async () => {
    const builder: PromiseLike<number> = {
      then: (onFulfilled, onRejected) => Promise.resolve(42).then(onFulfilled, onRejected),
    };
    await expect(withTimeout(builder, 1000, "select")).resolves.toBe(42);
  });
});
