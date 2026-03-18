import { TableSkeleton } from "@/components/skeletons/table-skeleton";

export default function SeasonsLoading() {
  return (
    <div>
      <div className="mb-6 h-6 w-24 animate-pulse rounded bg-gray-200" />
      <TableSkeleton rows={5} columns={4} />
    </div>
  );
}
