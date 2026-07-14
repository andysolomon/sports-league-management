import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function TeamsLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="space-y-0 border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </Card>
    </div>
  );
}
