"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { LeagueDto, TeamDto } from "@sports-management/shared-types";
import { useLocalProvider } from "@/lib/local/use-local-provider";
import { ensureLocalWorkspace } from "@/lib/local/local-workspace";
import type { LocalWorkspaceProvider } from "@/lib/local/local-workspace-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ChevronRight } from "lucide-react";

export default function LocalHomePage() {
  const provider = useLocalProvider();
  const [league, setLeague] = useState<LeagueDto | null>(null);
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [stadium, setStadium] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async (p: LocalWorkspaceProvider) => {
    const lg = await ensureLocalWorkspace(p);
    setLeague(lg);
    setTeams(await p.listTeams(lg.id));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (provider) void reload(provider);
  }, [provider, reload]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!provider || !league) return;
    if (!name.trim() || !city.trim() || !stadium.trim()) {
      toast.error("Team name, city, and home venue are required.");
      return;
    }
    setSaving(true);
    try {
      await provider.createTeam({
        name: name.trim(),
        leagueId: league.id,
        city: city.trim(),
        stadium: stadium.trim(),
      });
      toast.success(`Added ${name.trim()}.`);
      setName("");
      setCity("");
      setStadium("");
      await reload(provider);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Your local workspace
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and manage teams right here in your browser — no account
          required. Everything persists across reloads.
        </p>
      </div>

      {/* Teams */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Teams</h2>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : teams.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No teams yet. Add your first team below.
          </p>
        ) : (
          <ul className="space-y-2">
            {teams.map((team) => (
              <li key={team.id}>
                <Link
                  href={`/local/teams/${team.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3 transition-colors hover:border-primary hover:bg-card"
                >
                  <span className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-primary" />
                    <span>
                      <span className="block font-medium text-foreground">
                        {team.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {team.city} · {team.stadium}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create team */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a team</CardTitle>
          <CardDescription>
            The basics now — you can fill in the rest on the team page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Riverside Hawks"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-city">City</Label>
              <Input
                id="team-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Austin"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-stadium">Home venue</Label>
              <Input
                id="team-stadium"
                value={stadium}
                onChange={(e) => setStadium(e.target.value)}
                placeholder="Nest Field"
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={saving || !provider}>
                {saving ? "Adding…" : "Add team"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
