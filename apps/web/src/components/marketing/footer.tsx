import Link from "next/link";
import { Monogram } from "./monogram";

const productLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#how-it-works", label: "How it works" },
];

const legalLinks = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

interface FooterProps {
  isSignedIn: boolean;
}

export function MarketingFooter({ isSignedIn }: FooterProps) {
  const accountLinks = isSignedIn
    ? [{ href: "/dashboard", label: "Dashboard" }]
    : [
        { href: "/sign-in", label: "Sign in" },
        { href: "/sign-up", label: "Sign up" },
      ];

  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 text-zinc-900"
              aria-label="sprtsmng home"
            >
              <Monogram size={28} />
              <span className="text-base font-bold tracking-tight">sprtsmng</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-zinc-600">
              The simplest way to run your youth sports team.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Product</h3>
            <ul className="mt-3 space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-600 hover:text-zinc-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Legal</h3>
            <ul className="mt-3 space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-600 hover:text-zinc-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Account</h3>
            <ul className="mt-3 space-y-2">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-600 hover:text-zinc-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-zinc-200 pt-8">
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} Arcnology · Built with Next.js, Clerk,
            Stripe, and Salesforce
          </p>
        </div>
      </div>
    </footer>
  );
}
