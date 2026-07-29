import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { coachHomeHref } from "@/components/workspace/resource-navigation";
import { formatCoachArchetype } from "@/lib/program/coach";
import type { CoachDto } from "@/lib/data-api";

export interface TeamStaffCardProps {
  coaches: CoachDto[];
}

function formatRole(role: string): string {
  if (role === "head_coach") return "Head coach";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function TeamStaffCard({ coaches }: TeamStaffCardProps) {
  if (coaches.length === 0) return null;

  return (
    <Card data-testid="team-staff-card">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
        <CardTitle className="text-base font-semibold">Staff</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {coaches.map((coach) => (
            <li key={coach.id}>
              <Link
                href={coachHomeHref(coach.id)}
                className="text-sm font-medium text-primary hover:underline"
              >
                {coach.displayName}
              </Link>
              <p className="text-xs text-muted-foreground">
                {formatRole(coach.role)} · {formatCoachArchetype(coach.archetype)}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
