import { ImportForm } from "./_components/import-form";
import { NflSyncCard } from "./_components/nfl-sync-card";

export default function ImportPage() {
  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">
        Import Data
      </h2>
      <div className="space-y-8">
        <NflSyncCard />
        <ImportForm />
      </div>
    </div>
  );
}
