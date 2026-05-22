"use client";

import { toPng } from "html-to-image";
import { Download } from "lucide-react";
import { useState, type RefObject } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type ExportPosterButtonProps = {
  targetRef: RefObject<HTMLElement | null>;
  fileName?: string;
};

export function ExportPosterButton({
  targetRef,
  fileName = "day-of-music.png",
}: ExportPosterButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportPoster = async () => {
    const node = targetRef.current;

    if (!node) {
      toast.error("Preview is not ready.");
      return;
    }

    setIsExporting(true);
    node.dataset.exporting = "true";

    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#f6f7f8",
      });

      const link = document.createElement("a");
      link.download = fileName;
      link.href = dataUrl;
      link.click();
      toast.success("PNG exported.");
    } catch (error) {
      console.error(error);
      toast.error("Export failed. Check remote album image CORS settings.");
    } finally {
      delete node.dataset.exporting;
      setIsExporting(false);
    }
  };

  return (
    <Button type="button" onClick={exportPoster} disabled={isExporting}>
      <Download className="h-4 w-4" aria-hidden="true" />
      {isExporting ? "Exporting" : "Export PNG"}
    </Button>
  );
}
