"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import { ServiceWorkerRegister } from "@/components/service-worker-register";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
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
      {children}
      <Toaster position="bottom-center" richColors closeButton />
    </QueryClientProvider>
  );
}
