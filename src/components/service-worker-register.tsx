"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      // A worker registered by a production build once run on this origin
      // (e.g. the prod Docker image on :3000) outlives it and keeps serving
      // cache-first assets to the dev server, whose chunk URLs are NOT
      // content-hashed — pinning stale CSS/JS forever. Tear it down.
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())));
      if ("caches" in window) {
        void caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((key) => key.startsWith("day-of-music-"))
                .map((key) => caches.delete(key)),
            ),
          );
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  }, []);

  return null;
}
