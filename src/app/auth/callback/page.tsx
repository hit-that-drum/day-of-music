// auth/callback/page.tsx — completes the PKCE code exchange after an OAuth or
// email-confirmation redirect. The code_verifier lives in the browser that
// started the flow, so an exchange opened in a *different* browser (e.g. sign
// up on desktop, open the confirmation link on a phone) fails here. We detect
// that, tell the user their email is confirmed, and send them to /signin to log
// in again — instead of dropping them on a dead-end page.

"use client";

import { useEffect, useEffectEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useT } from "@/lib/day-of-music/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const t = useT();

  // Effect Events read the current language without making the effect below
  // depend on it: the code exchange must run exactly once (a code can't be
  // exchanged twice), so a language resolving after mount must not re-run it.
  const notifyFailed = useEffectEvent((reason: string) => {
    toast.error(t("auth.callback.failed", { reason }));
  });
  const notifyConfirmedElsewhere = useEffectEvent(() => {
    toast.success(t("auth.callback.confirmedElsewhere"));
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // No auth configured → nothing to exchange; fall back into the app.
    if (!supabase) {
      router.replace("/week");
      return;
    }

    // Read straight from the URL (not useSearchParams) so this stays a plain
    // client effect with no Suspense/prerender boundary to manage.
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const providerError = params.get("error_description") ?? params.get("error");

    // Provider-side failure — consent denied, or the account isn't on the test
    // user list while the OAuth app is still unverified.
    if (providerError) {
      // This is the mount effect of a fresh page load (the provider just
      // redirected here). Calling now would lose the toast twice over: sonner's
      // <Toaster> (a later sibling in Providers) only subscribes in its own
      // mount effect, after this one, and `t` still has the first render's
      // default language. One macrotask later both have caught up — the
      // effect event reads the language committed by then.
      setTimeout(() => notifyFailed(providerError), 0);
      router.replace("/signin");
      return;
    }
    if (!code) {
      router.replace("/signin");
      return;
    }

    let cancelled = false;
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (cancelled) return;
      if (error) {
        // The email itself is already confirmed server-side by the time we get
        // here; only the session exchange failed. The usual cause is that the
        // code_verifier isn't in *this* browser — i.e. the link was opened on a
        // different device than the one that signed up.
        notifyConfirmedElsewhere();
        router.replace("/signin");
        return;
      }
      router.replace("/week");
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="dom-stage">
      <div className="dom-root" data-grid="1" style={{ placeItems: "center" }}>
        <div className="dom-signin" style={{ textAlign: "center" }}>
          <div className="dom-signin-eyebrow">{t("auth.callback.eyebrow")}</div>
          <p className="dom-signin-sub" style={{ margin: 0 }}>
            {t("auth.callback.body")}
          </p>
        </div>
      </div>
    </div>
  );
}
