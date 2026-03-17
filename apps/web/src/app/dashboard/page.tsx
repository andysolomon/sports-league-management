import { UserButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <main className="min-h-screen p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <UserButton />
      </header>
      <p className="text-gray-600">
        Welcome to Sports League Management. Select a section to get started.
      </p>
    </main>
  );
}
