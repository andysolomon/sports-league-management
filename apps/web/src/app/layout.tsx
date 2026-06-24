import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const dynamic = "force-dynamic";

// Design system type: Hanken Grotesk carries UI + prose; JetBrains Mono sets
// keys, paths, and data (numerics, IDs, ⌘K).
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500"],
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
      {/* Theme follows the OS by default (next-themes); a top-bar toggle overrides. */}
      <html
        lang="en"
        suppressHydrationWarning
        className={`${hanken.variable} ${jetbrainsMono.variable}`}
      >
        <body className="bg-background text-foreground font-sans antialiased">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </ThemeProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
