import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { MarketingHeader } from "./header";
import { MarketingFooter } from "./footer";

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export async function LegalLayout({
  title,
  lastUpdated,
  children,
}: LegalLayoutProps) {
  const { userId } = await auth();
  const isSignedIn = userId !== null;

  return (
    <>
      <MarketingHeader isSignedIn={isSignedIn} />
      <main id="main" className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          {/* Disclaimer banner */}
          <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              <strong className="font-semibold">Not legal advice.</strong>{" "}
              These terms are a starting point provided in good faith and
              should be reviewed by qualified legal counsel before public
              launch. They may be updated as the product evolves.
            </p>
          </div>

          <header className="mb-10 border-b border-zinc-200 pb-8">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-zinc-500">
              Last updated: {lastUpdated}
            </p>
          </header>

          <article className="prose prose-zinc max-w-none [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-900 [&_p]:mt-3 [&_p]:text-base [&_p]:leading-7 [&_p]:text-zinc-700 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-base [&_ul]:text-zinc-700 [&_li]:mt-1 [&_a]:text-blue-600 [&_a]:underline hover:[&_a]:text-blue-700">
            {children}
          </article>
        </div>
      </main>
      <MarketingFooter isSignedIn={isSignedIn} />
    </>
  );
}
