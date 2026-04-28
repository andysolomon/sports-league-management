"use client";

import { Button } from "@/components/ui/8bit/button";
import { AlertTriangle } from "lucide-react";

export default function TeamsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
      <AlertTriangle className="mb-3 h-10 w-10 text-yellow-500" />
      <h2 className="text-lg font-semibold text-foreground">
        Failed to load teams
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
