"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { AuthProvider } from "@/lib/day-of-music/auth-provider";
import { useLanguage } from "@/lib/day-of-music/i18n";
import { PHONE_QUERY } from "@/lib/day-of-music/phone";

type ProvidersProps = {
  children: ReactNode;
};

// Toasts sit at the bottom on a desktop, but on a phone that's exactly where a
// modal's action row lives — a "기록됨" toast landed right on top of the
// add-flow's 계속 / 기록 저장 buttons. Top-center is out of the way there (and
// is where phones put system banners anyway).

function useToastPosition(): "bottom-center" | "top-center" {
  // Server + first paint assume desktop; the effect corrects it before any
  // toast can be fired.
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile ? "top-center" : "bottom-center";
}

// <html lang> follows the UI language on every page, not just the board. The
// layout renders lang="en" (the DEFAULT_LOCALE server snapshot); this corrects
// it once the client resolves the stored preference. Inside AuthProvider: the
// language preference syncs with the account.
function HtmlLangSync() {
  const { locale } = useLanguage();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}

export function Providers({ children }: ProvidersProps) {
  const toastPosition = useToastPosition();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 60_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ServiceWorkerRegister />
      <AuthProvider>
        <HtmlLangSync />
        {children}
      </AuthProvider>
      <Toaster position={toastPosition} richColors closeButton />
    </QueryClientProvider>
  );
}
