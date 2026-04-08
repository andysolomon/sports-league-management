import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import "./globals.css";

export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body className="font-sans antialiased">
          {children}
          <Toaster position="bottom-right" richColors closeButton />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
