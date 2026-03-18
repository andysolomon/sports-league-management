import { TableSkeleton } from "@/components/skeletons/table-skeleton";

export default function PlayersLoading() {
  return (
    <div>
      <div className="mb-6 h-6 w-24 animate-pulse rounded bg-gray-200" />
      <TableSkeleton rows={8} columns={4} />
    </div>
  );
}
