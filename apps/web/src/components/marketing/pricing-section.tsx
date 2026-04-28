import { PricingTableMarketing } from "./pricing-table-marketing";

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="border-t border-border bg-card/50 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Pricing
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple pricing. No surprises.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free. Upgrade if and when you need more.
          </p>
        </div>

        <div className="mt-16">
          <PricingTableMarketing />
        </div>
      </div>
    </section>
  );
}
