"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trophy, CheckCircle2, Plus } from "lucide-react";

export interface DiscoverLeague {
  id: string;
  name: string;
  /** Whether teams in this (reference) league can be forked into a workspace. */
  forkable: boolean;
  divisions: { id: string; name: string }[];
  teams: { id: string; name: string; divisionId: string; added: boolean }[];
}

export default function DiscoverLeagues({
  leagues,
}: {
  leagues: DiscoverLeague[];
}) {
  if (leagues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No public leagues available.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {leagues.map((league) => (
        <LeagueCatalogCard key={league.id} league={league} />
      ))}
    </div>
  );
}

function LeagueCatalogCard({ league }: { league: DiscoverLeague }) {
  const router = useRouter();
  const { divisions, teams } = league;
  // Local "added" overlay so the UI updates without a full refetch.
  const [added, setAdded] = useState<Set<string>>(
    () => new Set(teams.filter((t) => t.added).map((t) => t.id)),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);

  const groups = useMemo(() => {
    const byDivision = new Map<string, typeof teams>();
    for (const team of teams) {
      const list = byDivision.get(team.divisionId) ?? [];
      list.push(team);
      byDivision.set(team.divisionId, list);
    }
    const named = divisions
      .map((d) => ({ id: d.id, name: d.name, teams: byDivision.get(d.id) ?? [] }))
      .filter((g) => g.teams.length > 0);
    const known = new Set(divisions.map((d) => d.id));
    const other = teams.filter((t) => !known.has(t.divisionId));
    if (other.length) named.push({ id: "__other", name: "Other", teams: other });
    return named;
  }, [divisions, teams]);

  async function addTeam(teamId: string, teamName: string): Promise<boolean> {
    const res = await fetch(`/api/teams/${teamId}/claim`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setAdded((prev) => new Set(prev).add(teamId));
      return true;
    }
    toast.error(body.error ?? `Could not add ${teamName}.`);
    return false;
  }

  async function onAddOne(teamId: string, teamName: string) {
    setBusy(teamId);
    try {
      if (await addTeam(teamId, teamName)) {
        toast.success(`Added ${teamName} to your teams.`);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function onAddAll() {
    setBulk(true);
    try {
      let n = 0;
      for (const t of league.teams) {
        if (added.has(t.id)) continue;
        if (await addTeam(t.id, t.name)) n += 1;
      }
      if (n) toast.success(`Added ${n} team${n === 1 ? "" : "s"} to your teams.`);
      router.refresh();
    } finally {
      setBulk(false);
    }
  }

  const remaining = league.teams.filter((t) => !added.has(t.id)).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">{league.name}</CardTitle>
            <Badge variant="outline">Public</Badge>
          </div>
          {league.forkable && remaining > 0 && (
            <Button size="sm" variant="outline" disabled={bulk} onClick={onAddAll}>
              {bulk ? "Adding…" : `Add all (${remaining})`}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!league.forkable ? (
          <p className="text-sm text-muted-foreground">
            This league isn&rsquo;t available to add yet.
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id}>
                <p className="mb-2 text-sm font-medium text-foreground">
                  {group.name}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.teams.map((team) => {
                    const isAdded = added.has(team.id);
                    return (
                      <div
                        key={team.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span className="truncate font-medium text-foreground">
                          {team.name}
                        </span>
                        {isAdded ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-accent">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Added
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 shrink-0 px-2"
                            disabled={busy === team.id || bulk}
                            onClick={() => onAddOne(team.id, team.name)}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            {busy === team.id ? "…" : "Add"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
