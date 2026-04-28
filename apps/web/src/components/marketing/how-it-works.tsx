import { UserPlus, Users, Calendar } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Sign up free",
    description:
      "Google sign-in, no credit card. Takes 30 seconds.",
  },
  {
    number: "02",
    icon: Users,
    title: "Add your team",
    description:
      "Team name, colors, players. Import a roster CSV or add players one at a time.",
  },
  {
    number: "03",
    icon: Calendar,
    title: "Run the season",
    description:
      "Share the schedule, update from anywhere, get back to coaching.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-t border-border bg-white py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From signup to first practice in 5 minutes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No setup calls. No onboarding fees. Just start managing your team.
          </p>
        </div>

        <ol className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <li key={step.number} className="relative">
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-primary">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-semibold tracking-wide text-muted-foreground">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-base text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
