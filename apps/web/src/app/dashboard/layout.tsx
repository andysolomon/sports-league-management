import { UserButton } from "@clerk/nextjs";
import Sidebar from "./_components/sidebar";
import MobileHeader from "./_components/mobile-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 border-r border-gray-200 bg-gray-50 lg:block">
        <Sidebar />
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Mobile header with hamburger */}
        <MobileHeader />

        {/* Desktop header */}
        <header className="hidden items-center justify-between border-b border-gray-200 px-8 py-4 lg:flex">
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <UserButton />
        </header>

        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
