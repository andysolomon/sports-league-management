import { Skeleton } from "@/components/ui/8bit/skeleton";

export default function TeamsLoading() {
  return (
    <div>
      <div className="mb-6 h-6 w-24 animate-pulse rounded bg-gray-200" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-6"
          >
            <Skeleton className="h-5 w-32" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
