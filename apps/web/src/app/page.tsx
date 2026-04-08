import { auth } from "@clerk/nextjs/server";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingHero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Features } from "@/components/marketing/features";
import { Screenshots } from "@/components/marketing/screenshots";
import { PricingSection } from "@/components/marketing/pricing-section";
import { MarketingFooter } from "@/components/marketing/footer";

export default async function HomePage() {
  const { userId } = await auth();
  const isSignedIn = userId !== null;

  return (
    <>
      <MarketingHeader isSignedIn={isSignedIn} />
      <main id="main">
        <MarketingHero isSignedIn={isSignedIn} />
        <HowItWorks />
        <Features />
        <Screenshots />
        <PricingSection />
      </main>
      <MarketingFooter isSignedIn={isSignedIn} />
    </>
  );
}
