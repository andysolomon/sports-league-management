import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout } from "@/components/marketing/legal-layout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms and conditions governing your use of sprtsmng. Read before signing up.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="April 8, 2026">
      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using sprtsmng (&quot;the Service&quot;), you agree to
        be bound by these Terms of Service. If you do not agree, do not use
        the Service.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        sprtsmng is a sports team management platform for coaches and league
        administrators. The Service helps you manage rosters, schedules,
        teams, leagues, and related data. The Service is currently in beta
        and provided free for one team, with paid tiers available for
        additional features.
      </p>

      <h2>3. User Responsibilities</h2>
      <p>By using the Service, you agree to:</p>
      <ul>
        <li>Provide accurate, current, and complete information.</li>
        <li>
          Maintain the security of your authentication credentials. You are
          responsible for all activity under your account.
        </li>
        <li>
          Use the Service only for lawful purposes consistent with these
          Terms.
        </li>
        <li>
          Not misuse, abuse, or attempt to disrupt the Service or its
          underlying infrastructure.
        </li>
      </ul>

      <h2>4. Account & Authentication</h2>
      <p>
        Authentication is provided by Clerk, a third-party identity provider.
        You may sign in with Google or other supported methods. By creating
        an account, you agree to Clerk&apos;s terms of service and privacy
        policy in addition to these Terms.
      </p>

      <h2>5. Free and Paid Tiers</h2>
      <p>
        sprtsmng offers a free tier (one team, unlimited players) and paid
        tiers (Plus, Club, League) with additional features. Current pricing
        is displayed on{" "}
        <Link href="/#pricing">the pricing section of our home page</Link>{" "}
        and may change with notice. Payments are processed by Stripe; by
        subscribing, you agree to Stripe&apos;s terms.
      </p>
      <p>
        Subscriptions renew automatically until cancelled. You may cancel
        from your billing dashboard at any time. Cancellation takes effect at
        the end of the current billing period; we do not provide refunds for
        partial periods.
      </p>

      <h2>6. Player Data & Roster Information</h2>
      <p>
        You may add player information (names, jersey numbers, positions,
        statuses) to teams you manage. You represent and warrant that you
        have the authority and any necessary consents (including parental
        consent for any data about minors) to record this information in the
        Service. See our <a href="/privacy">Privacy Policy</a> for details on
        how we handle player data.
      </p>

      <h2>7. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service to harass, abuse, or harm any person.</li>
        <li>
          Upload illegal, defamatory, infringing, or harmful content.
        </li>
        <li>
          Attempt to scrape, reverse-engineer, or otherwise extract the
          Service&apos;s code or data beyond what is exposed by normal use.
        </li>
        <li>
          Use the Service to compete with sprtsmng or to build a competing
          product.
        </li>
        <li>
          Interfere with the security or integrity of the Service or its
          users&apos; data.
        </li>
      </ul>

      <h2>8. Intellectual Property</h2>
      <p>
        sprtsmng owns the platform, including all code, designs, branding,
        and documentation. You retain ownership of the content you enter
        (team names, rosters, schedules, etc.). By using the Service, you
        grant us a limited license to store, process, and display your
        content as necessary to provide the Service.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may stop using the Service at any time by cancelling your
        subscription and deleting your account. We may suspend or terminate
        your access if you violate these Terms. Upon termination, you may
        request a copy of your data within 30 days by emailing{" "}
        <a href="mailto:legal@sprtsmng.andrewsolomon.dev">
          legal@sprtsmng.andrewsolomon.dev
        </a>
        .
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The Service is provided <strong>&quot;AS IS&quot;</strong> and{" "}
        <strong>&quot;AS AVAILABLE&quot;</strong> without warranty of any
        kind, express or implied. We do not warrant that the Service will be
        uninterrupted, error-free, or secure. The Service is currently in
        beta; expect bugs and downtime.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, sprtsmng and its operators
        are not liable for any indirect, incidental, special, consequential,
        or punitive damages arising from your use of the Service. Our total
        liability for any claim arising from these Terms or the Service is
        limited to the amount you paid to sprtsmng in the twelve months
        preceding the claim, or one hundred US dollars, whichever is greater.
      </p>

      <h2>12. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, USA,
        without regard to its conflict-of-law principles. Any dispute will be
        resolved in the state or federal courts located in Delaware.
      </p>

      <h2>13. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        announced via email or in-app notification. Your continued use of the
        Service after a change constitutes acceptance of the new Terms.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href="mailto:legal@sprtsmng.andrewsolomon.dev">
          legal@sprtsmng.andrewsolomon.dev
        </a>
        .
      </p>
    </LegalLayout>
  );
}
