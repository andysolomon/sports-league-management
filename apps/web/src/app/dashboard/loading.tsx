import { CardSkeleton } from "@/components/skeletons/card-skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-6 h-6 w-24 animate-pulse rounded bg-gray-200" />
      <CardSkeleton count={4} />
    </div>
  );
}
