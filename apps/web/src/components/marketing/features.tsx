import { ClipboardList, Calendar, Heart, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/8bit/card";

const features = [
  {
    icon: ClipboardList,
    title: "Roster in minutes",
    description:
      "Add players, jersey numbers, positions. Edit in place. No spreadsheets, no copy-paste.",
  },
  {
    icon: Calendar,
    title: "Season-long schedule",
    description:
      "Build your season once. Share with players and parents. Update everything from one place.",
  },
  {
    icon: Heart,
    title: "Free forever for solo coaches",
    description:
      "Manage one team, unlimited players, $0 forever. No trial, no credit card. Upgrade only when you need more.",
  },
  {
    icon: TrendingUp,
    title: "Built to scale when you do",
    description:
      "From a single team to a full league — move up a tier whenever. No migration, no re-entry.",
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="border-t border-zinc-100 bg-zinc-50/50 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Features
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Built specifically for volunteer and rec-league coaches.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="border-zinc-200/80">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <CardTitle className="mt-4 text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base leading-7 text-zinc-600">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
