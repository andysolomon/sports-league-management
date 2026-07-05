import Link from "next/link";
import { Monogram } from "@/components/marketing/monogram";

/**
 * Shared shell for Clerk sign-in / sign-up routes. Branding + themed background
 * so the page doesn't read as an empty void while Clerk hydrates (WSM-000168).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex justify-center px-4 pt-8 pb-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground"
          aria-label="sprtsmng home"
        >
          <Monogram size={32} />
          <span className="text-lg font-bold tracking-tight">sprtsmng</span>
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        {children}
      </div>
    </div>
  );
}
