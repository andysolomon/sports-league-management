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
      <aside className="hidden w-56 border-r border-border bg-card lg:block">
        <Sidebar />
      </aside>

      {/* min-w-0 lets this flex child shrink below its content's intrinsic
          width — without it, wide tables push the page wider than the phone
          viewport and overflow-x-auto containers never engage. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header with hamburger */}
        <MobileHeader />

        {/* Desktop header */}
        <header className="hidden items-center justify-between border-b border-border px-8 py-4 lg:flex">
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <UserButton />
        </header>

        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
