// auth/callback/page.tsx — completes the PKCE code exchange after an OAuth or
// email-confirmation redirect. The code_verifier lives in the browser that
// started the flow, so an exchange opened in a *different* browser (e.g. sign
// up on desktop, open the confirmation link on a phone) fails here. We detect
// that, tell the user their email is confirmed, and send them to /signin to log
// in again — instead of dropping them on a dead-end page.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

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
      toast.error(`로그인이 완료되지 않았어요: ${providerError}`);
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
        toast.success("이메일 확인이 완료되었어요. 이 기기에서 다시 로그인해 주세요.");
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
          <div className="dom-signin-eyebrow">로그인 · signing in</div>
          <p className="dom-signin-sub" style={{ margin: 0 }}>
            로그인 처리 중이에요… 잠시만 기다려 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
