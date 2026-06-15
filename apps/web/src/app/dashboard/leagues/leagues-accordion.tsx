"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { CreateDivisionButton, DivisionRowActions } from "./division-controls";

export interface AccordionDivision {
  id: string;
  name: string;
  teams: Array<{ id: string; name: string; city: string | null }>;
}

export function LeaguesAccordion({
  leagueId,
  isAdmin,
  divisions,
}: {
  leagueId: string;
  isAdmin: boolean;
  divisions: AccordionDivision[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Divisions
        </h3>
        {isAdmin ? <CreateDivisionButton leagueId={leagueId} /> : null}
      </div>

      {divisions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No divisions yet.
          {isAdmin ? " Add one to start organizing teams." : ""}
        </p>
      ) : (
        <Accordion type="multiple" className="rounded-md border border-border">
          {divisions.map((division) => (
            <AccordionItem
              key={division.id}
              value={division.id}
              className="px-3 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <AccordionTrigger className="flex-1">
                  <span className="flex items-center gap-2">
                    {division.name}
                    <Badge variant="outline" className="text-xs">
                      {division.teams.length} team
                      {division.teams.length !== 1 ? "s" : ""}
                    </Badge>
                  </span>
                </AccordionTrigger>
                {isAdmin ? (
                  <DivisionRowActions
                    divisionId={division.id}
                    currentName={division.name}
                  />
                ) : null}
              </div>
              <AccordionContent>
                {division.teams.length === 0 ? (
                  <div className="flex items-center justify-between gap-2 px-1 py-1">
                    <span className="text-sm text-muted-foreground">
                      No teams in this division.
                    </span>
                    <Link
                      href="/dashboard/discover"
                      className="text-sm text-primary hover:underline"
                    >
                      Add teams &rarr;
                    </Link>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {division.teams.map((team) => (
                      <li key={team.id}>
                        <Link
                          href={`/dashboard/teams/${team.id}?from=leagues`}
                          className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted"
                        >
                          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium text-foreground">
                            {team.name}
                          </span>
                          {team.city ? (
                            <span className="truncate text-muted-foreground">
                              &mdash; {team.city}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
