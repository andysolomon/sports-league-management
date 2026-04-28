import type { Metadata } from "next";
import { Pixelify_Sans } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import "./globals.css";

export const dynamic = "force-dynamic";

// Display font for headings + 8-bit retro accents.
const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  variable: "--font-pixelify-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sprtsmng.andrewsolomon.dev"),
  title: {
    default: "sprtsmng — Manage your sports team without the spreadsheets",
    template: "%s · sprtsmng",
  },
  description:
    "The simplest way to run your youth sports team. Roster, schedule, notifications — all in one place. Free for one team, forever.",
  openGraph: {
    title: "sprtsmng — Manage your sports team without the spreadsheets",
    description:
      "Roster, schedule, notifications. Free for one team, forever.",
    url: "https://sprtsmng.andrewsolomon.dev",
    siteName: "sprtsmng",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "sprtsmng — Manage your sports team without the spreadsheets",
    description:
      "Roster, schedule, notifications. Free for one team, forever.",
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "sprtsmng",
  url: "https://sprtsmng.andrewsolomon.dev",
  logo: "https://sprtsmng.andrewsolomon.dev/icon",
  description:
    "The simplest way to run your youth sports team. Roster, schedule, notifications — all in one place.",
  sameAs: ["https://github.com/andysolomon/sports-league-management"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${GeistSans.variable} ${GeistMono.variable} ${pixelifySans.variable}`}
      >
        <body className="font-sans antialiased">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          {children}
          <Toaster position="bottom-right" richColors closeButton />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
