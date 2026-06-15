"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type {
  DivisionDto,
  LeagueDto,
  TeamDto,
} from "@sports-management/shared-types";
import { useLocalProvider } from "@/lib/local/use-local-provider";
import { AccountOnly } from "./_components/account-only";
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
import { Users, ChevronRight, CalendarDays, Trash2, Upload } from "lucide-react";

export default function LocalHomePage() {
  const provider = useLocalProvider();
  const [league, setLeague] = useState<LeagueDto | null>(null);
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [divisions, setDivisions] = useState<DivisionDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [stadium, setStadium] = useState("");
  const [saving, setSaving] = useState(false);

  const [divName, setDivName] = useState("");
  const [savingDiv, setSavingDiv] = useState(false);

  const reload = useCallback(async (p: LocalWorkspaceProvider) => {
    const lg = await ensureLocalWorkspace(p);
    setLeague(lg);
    const [t, d] = await Promise.all([p.listTeams(lg.id), p.listDivisions(lg.id)]);
    setTeams(t);
    setDivisions(d);
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

  async function onCreateDivision(e: React.FormEvent) {
    e.preventDefault();
    if (!provider || !league || !divName.trim()) return;
    setSavingDiv(true);
    try {
      await provider.createDivision({ name: divName.trim(), leagueId: league.id });
      setDivName("");
      await reload(provider);
    } finally {
      setSavingDiv(false);
    }
  }

  async function onDeleteDivision(id: string) {
    if (!provider) return;
    await provider.deleteDivision(id);
    setDivisions((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Your local workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage teams right here in your browser — no account
            required. Everything persists across reloads.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/local/import">
              <Upload className="mr-1.5 h-4 w-4" />
              Import
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/local/schedule">
              <CalendarDays className="mr-1.5 h-4 w-4" />
              Schedule &amp; standings
            </Link>
          </Button>
        </div>
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

      {/* Divisions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Divisions</CardTitle>
          <CardDescription>
            Optional — group teams into divisions for standings. Assign a team to
            a division on its page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {divisions.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {divisions.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-foreground">{d.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => onDeleteDivision(d.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={onCreateDivision} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="div-name">New division</Label>
              <Input
                id="div-name"
                value={divName}
                onChange={(e) => setDivName(e.target.value)}
                placeholder="East"
              />
            </div>
            <Button type="submit" variant="outline" disabled={savingDiv || !provider}>
              {savingDiv ? "Adding…" : "Add"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account-only boundary (AC #2) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Unlock more with a free account
          </CardTitle>
          <CardDescription>
            Local mode keeps everything in this browser. A free account adds the
            things that need a server — and your local workspace comes with you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <AccountOnly
            feature="Back up & sync across devices"
            description="Saved to the cloud, not just this browser."
          />
          <AccountOnly
            feature="Share a public schedule & standings link"
            description="A read-only link for players and parents."
          />
          <AccountOnly
            feature="Invite coaches and assign roles"
            description="Multiple people, with permissions."
          />
          <AccountOnly
            feature="Discover & add reference teams"
            description="Fork curated leagues into your workspace."
          />
          <Button asChild className="mt-2">
            <Link href="/sign-up">Create a free account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
