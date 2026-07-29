import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvaluatedGoalDto } from "@/lib/data-api";

function statusLabel(status: EvaluatedGoalDto["status"]): string {
  switch (status) {
    case "met":
      return "Met";
    case "partial":
      return "Partial";
    case "missed":
      return "Missed";
    default:
      return status;
  }
}

function statusClass(status: EvaluatedGoalDto["status"]): string {
  switch (status) {
    case "met":
      return "text-emerald-600 dark:text-emerald-400";
    case "partial":
      return "text-amber-600 dark:text-amber-400";
    case "missed":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

export function SeasonGoalsCard({
  teamName,
  goals,
}: {
  teamName: string;
  goals: EvaluatedGoalDto[];
}) {
  if (goals.length === 0) return null;

  const met = goals.filter((g) => g.status === "met").length;

  return (
    <Card data-testid="season-goals-card">
      <CardHeader>
        <CardTitle>Season goals</CardTitle>
        <p className="text-sm text-muted-foreground">{teamName}</p>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          {met} of {goals.length} goals on track
        </p>
        <ul className="space-y-2 text-sm">
          {goals.map((goal) => (
            <li
              key={goal.id}
              className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0"
            >
              <span className="text-foreground">{goal.label}</span>
              <span
                className={`shrink-0 font-mono text-xs tabular-nums ${statusClass(goal.status)}`}
              >
                {statusLabel(goal.status)} ({goal.actual}/{goal.target})
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
