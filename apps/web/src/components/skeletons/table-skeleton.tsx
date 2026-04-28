import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-72" />
      <div className="rounded-lg border border-border">
        <div className="border-b border-border bg-card px-4 py-3">
          <div className="flex gap-8">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-24" />
            ))}
          </div>
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex gap-8 border-b border-border px-4 py-3 last:border-0"
          >
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-24" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
