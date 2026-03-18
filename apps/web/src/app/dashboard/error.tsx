"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
      <AlertTriangle className="mb-3 h-10 w-10 text-yellow-500" />
      <h2 className="text-lg font-semibold text-gray-900">
        Something went wrong
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
