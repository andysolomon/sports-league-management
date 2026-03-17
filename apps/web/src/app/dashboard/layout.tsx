import { UserButton } from "@clerk/nextjs";
import NavLink from "./_components/nav-link";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/teams", label: "Teams" },
  { href: "/dashboard/players", label: "Players" },
  { href: "/dashboard/seasons", label: "Seasons" },
  { href: "/dashboard/divisions", label: "Divisions" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Sports League
        </h2>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <UserButton />
        </header>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
