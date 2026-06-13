"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/8bit/card";
import { Button } from "@/components/ui/8bit/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

export interface DiscoverLeague {
  id: string;
  name: string;
  subscribed: boolean;
  /** null = imported all (or not subscribed); array = the imported subset. */
  importedTeamIds: string[] | null;
  divisions: { id: string; name: string }[];
  teams: { id: string; name: string; divisionId: string }[];
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {leagues.map((league) => (
        <LeagueImportCard key={league.id} league={league} />
      ))}
    </div>
  );
}

function LeagueImportCard({ league }: { league: DiscoverLeague }) {
  const router = useRouter();
  const { divisions, teams } = league;
  const allTeamIds = useMemo(() => teams.map((t) => t.id), [teams]);

  const [subscribed, setSubscribed] = useState(league.subscribed);
  const [importAll, setImportAll] = useState(league.importedTeamIds === null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(league.importedTeamIds ?? allTeamIds),
  );
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Group teams by division for the tree; ungrouped fall into "Other".
  const groups = useMemo(() => {
    const byDivision = new Map<string, typeof teams>();
    for (const team of teams) {
      const list = byDivision.get(team.divisionId) ?? [];
      list.push(team);
      byDivision.set(team.divisionId, list);
    }
    const named = divisions
      .map((d) => ({
        id: d.id,
        name: d.name,
        teams: byDivision.get(d.id) ?? [],
      }))
      .filter((g) => g.teams.length > 0);
    const knownIds = new Set(divisions.map((d) => d.id));
    const other = teams.filter((t) => !knownIds.has(t.divisionId));
    if (other.length > 0) {
      named.push({ id: "__other", name: "Other", teams: other });
    }
    return named;
  }, [divisions, teams]);

  function toggleTeam(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDivision(teamIds: string[], fullySelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of teamIds) {
        if (fullySelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  const canSubmit = importAll || selected.size > 0;

  async function save() {
    setLoading(true);
    try {
      const teamIds = importAll ? [] : Array.from(selected);
      const res = await fetch("/api/leagues/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: league.id, teamIds }),
      });
      if (res.ok) {
        setSubscribed(true);
        setExpanded(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const res = await fetch("/api/leagues/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: league.id }),
      });
      if (res.ok) {
        setSubscribed(false);
        setExpanded(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  const summary = !subscribed
    ? null
    : importAll
      ? "All teams"
      : `${selected.size} of ${allTeamIds.length} teams`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{league.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Public</Badge>
          {subscribed && (
            <Badge className="gap-1 bg-accent text-accent-foreground">
              <CheckCircle2 className="h-3 w-3" />
              Subscribed · {summary}
            </Badge>
          )}
        </div>

        {league.teams.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {subscribed ? "Edit import" : "Choose what to import"}
          </button>
        )}

        {expanded && league.teams.length > 0 && (
          <div className="rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={importAll}
                onChange={(e) => setImportAll(e.target.checked)}
              />
              Import all teams
            </label>

            {!importAll && (
              <div className="mt-3 space-y-3">
                {groups.map((group) => {
                  const ids = group.teams.map((t) => t.id);
                  const selCount = ids.filter((id) => selected.has(id)).length;
                  const fully = selCount === ids.length;
                  return (
                    <div key={group.id}>
                      <DivisionCheckbox
                        label={group.name}
                        checked={fully}
                        indeterminate={selCount > 0 && !fully}
                        onToggle={() => toggleDivision(ids, fully)}
                      />
                      <div className="ml-6 mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {group.teams.map((team) => (
                          <label
                            key={team.id}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={selected.has(team.id)}
                              onChange={() => toggleTeam(team.id)}
                            />
                            <span className="truncate">{team.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!canSubmit && (
                  <p className="text-xs text-destructive">
                    Pick at least one team, or choose Import all.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" disabled={loading || !canSubmit} onClick={save}>
            {loading ? "..." : subscribed ? "Save changes" : "Subscribe"}
          </Button>
          {subscribed && (
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={unsubscribe}
            >
              Unsubscribe
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Native checkbox with a controllable indeterminate state. */
function DivisionCheckbox({
  label,
  checked,
  indeterminate,
  onToggle,
}: {
  label: string;
  checked: boolean;
  indeterminate: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
      <input
        ref={ref}
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={checked}
        onChange={onToggle}
      />
      {label}
    </label>
  );
}
