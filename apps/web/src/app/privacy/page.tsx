import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How sprtsmng collects, uses, and protects your data. Read before signing up.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="April 8, 2026">
      <h2>1. Introduction</h2>
      <p>
        sprtsmng is a sports team management platform for coaches and league
        administrators. This Privacy Policy describes what information we
        collect, how we use it, who we share it with, and your rights
        regarding that information. By using the Service, you agree to this
        Policy.
      </p>

      <h2>2. Information We Collect</h2>
      <h3>Account information (via Clerk)</h3>
      <p>
        When you create an account, our authentication provider Clerk
        collects your email address, display name, and (if you sign in with
        Google) your Google account ID and profile picture URL. We do not
        store passwords; Clerk manages all credential storage.
      </p>
      <h3>Billing information (via Stripe)</h3>
      <p>
        If you subscribe to a paid tier, Stripe processes your payment and
        stores the last four digits of your card, billing address, and
        Stripe customer ID. We do not see or store your full card details.
      </p>
      <h3>Content you create</h3>
      <p>
        Teams, leagues, divisions, seasons, players, schedules, and other
        information you enter is stored in our Salesforce-backed database
        and associated with your account.
      </p>
      <h3>Usage analytics (via Vercel)</h3>
      <p>
        We use Vercel Analytics and Vercel Speed Insights to measure
        anonymous, aggregated page views and Core Web Vitals. These do not
        use cookies or track individuals.
      </p>

      <h2>3. How We Use Information</h2>
      <ul>
        <li>To provide and operate the Service.</li>
        <li>
          To send transactional emails (welcome message, payment receipts,
          billing alerts).
        </li>
        <li>
          To prevent abuse, fraud, and security incidents.
        </li>
        <li>
          To improve the Service based on aggregated, anonymized usage data.
        </li>
      </ul>
      <p>
        We do not use your data for advertising, profiling, or any purpose
        unrelated to providing the Service.
      </p>

      <h2>4. Sharing & Disclosure</h2>
      <p>
        We share data only with the service providers we use to operate the
        Service:
      </p>
      <ul>
        <li>
          <strong>Clerk</strong> — authentication and identity.
        </li>
        <li>
          <strong>Stripe</strong> — payment processing.
        </li>
        <li>
          <strong>Salesforce</strong> — content storage (rosters, schedules,
          teams).
        </li>
        <li>
          <strong>Vercel</strong> — application hosting and analytics.
        </li>
        <li>
          <strong>Resend</strong> — transactional email delivery.
        </li>
      </ul>
      <p>
        We do not sell your data. We do not share it with advertisers or
        data brokers. We will only disclose information when required by
        law or to protect rights, property, or safety.
      </p>

      <h2>5. Cookies & Tracking</h2>
      <p>
        We use essential cookies for authentication (managed by Clerk).
        Vercel Analytics uses anonymous identifiers and does not set
        cookies. We do not use third-party advertising trackers.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain your account data for as long as your account is active.
        Backups are kept for up to 30 days after deletion. You can request
        deletion at any time by emailing{" "}
        <a href="mailto:privacy@sprtsmng.andrewsolomon.dev">
          privacy@sprtsmng.andrewsolomon.dev
        </a>
        .
      </p>

      <h2>7. Your Rights</h2>
      <p>
        You have the right to access, correct, and delete your personal
        information. To exercise these rights, email{" "}
        <a href="mailto:privacy@sprtsmng.andrewsolomon.dev">
          privacy@sprtsmng.andrewsolomon.dev
        </a>
        . We will respond within 30 days.
      </p>
      <p>
        If you are in the European Union, United Kingdom, or California, you
        may have additional rights under GDPR, UK GDPR, or CCPA. Contact us
        to exercise them.
      </p>

      <h2>8. Children&apos;s Privacy & COPPA</h2>
      <p>
        sprtsmng is intended for adult coaches, league administrators, and
        other adults age 16 and over. Players under 13 should not create
        accounts.
      </p>
      <p>
        Coaches may add roster information about players (including minors)
        on behalf of their teams. By adding this information, you represent
        and warrant that you have the necessary parental or guardian
        consent, and that you are recording only the minimum information
        needed for league operations (name, jersey number, position,
        status). You must not record sensitive personal information about
        minors.
      </p>
      <p>
        We do not knowingly collect personal information directly from
        children under 13. If you believe we have collected such
        information, please contact{" "}
        <a href="mailto:privacy@sprtsmng.andrewsolomon.dev">
          privacy@sprtsmng.andrewsolomon.dev
        </a>{" "}
        and we will remove it.
      </p>

      <h2>9. Security</h2>
      <p>
        We use industry-standard security practices: HTTPS for all traffic,
        encrypted credentials, signed webhook verification, and regular
        dependency updates. No system is perfectly secure; we recommend you
        use a strong unique password (or Google sign-in) and enable
        two-factor authentication where available.
      </p>

      <h2>10. International Users</h2>
      <p>
        sprtsmng is hosted in the United States by Vercel. By using the
        Service, you consent to the transfer and processing of your
        information in the United States.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material
        changes will be announced via email or in-app notification.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about this Privacy Policy? Email{" "}
        <a href="mailto:privacy@sprtsmng.andrewsolomon.dev">
          privacy@sprtsmng.andrewsolomon.dev
        </a>
        .
      </p>
    </LegalLayout>
  );
}
