"use client";

import { MonitorDown } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type InstallOutcome = "accepted" | "dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: InstallOutcome;
    platform: string;
  }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const navigatorStandalone = (navigator as NavigatorWithStandalone)
      .standalone;

    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorStandalone === true
    );
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (isInstalled || !installPrompt) {
    return null;
  }

  const installApp = async () => {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }

    setInstallPrompt(null);
  };

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={installApp}
      title="Install app"
    >
      <MonitorDown className="h-4 w-4" aria-hidden="true" />
      Install
    </Button>
  );
}
