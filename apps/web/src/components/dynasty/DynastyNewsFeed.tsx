import { Newspaper } from "lucide-react";
import type { DynastyEventDto } from "@/lib/data-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORY_LABELS: Record<string, string> = {
  game: "Game",
  injury: "Injury",
  roster: "Roster",
  award: "Award",
  program: "Program",
  offseason: "Offseason",
  poll: "Poll",
  record: "Record",
};

export function DynastyNewsFeed({
  events,
}: {
  events: readonly DynastyEventDto[];
}) {
  return (
    <Card data-testid="dynasty-news-feed">
      <CardHeader className="flex flex-row items-center gap-2">
        <Newspaper className="h-5 w-5 text-primary" aria-hidden />
        <CardTitle>Dynasty news</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Headlines will appear as the dynasty unfolds.
          </p>
        ) : (
          <ol className="divide-y">
            {events.map((event) => (
              <li
                key={event.id}
                className="grid gap-1 py-3 first:pt-0 last:pb-0"
                data-testid="dynasty-news-item"
              >
                <p className="text-sm font-medium text-foreground">
                  {event.headline}
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[event.category] ?? event.category}
                  {event.week === null ? "" : ` · Week ${event.week}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
