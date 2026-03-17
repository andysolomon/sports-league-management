import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="mb-8 text-4xl font-bold">Sports League Management</h1>
      <SignedIn>
        <Link
          href="/dashboard"
          className="rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:opacity-90"
        >
          Go to Dashboard
        </Link>
      </SignedIn>
      <SignedOut>
        <Link
          href="/sign-in"
          className="rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:opacity-90"
        >
          Sign In
        </Link>
      </SignedOut>
    </main>
  );
}
