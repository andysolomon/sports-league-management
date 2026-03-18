import { getSeasons } from "@/lib/salesforce-api";
import { SeasonsTable } from "./seasons-table";

export default async function SeasonsPage() {
  const seasons = await getSeasons();

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Seasons</h2>
      <SeasonsTable seasons={seasons} />
    </div>
  );
}
