"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import type {
  DivisionDto,
  PlayerDto,
  TeamDto,
} from "@sports-management/shared-types";
import { useLocalProvider } from "@/lib/local/use-local-provider";
import type { LocalWorkspaceProvider } from "@/lib/local/local-workspace-provider";
import { DuplicateJerseyError } from "@/lib/local/workspace-provider";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2 } from "lucide-react";

const POSITIONS = [
  "QB", "RB", "FB", "WR", "TE", "OL", "DL", "EDGE", "LB", "DB", "CB", "S",
  "K", "P", "LS", "ATH",
];
const STATUSES = ["Active", "Injured", "Inactive"];

export default function LocalTeamPage() {
  const params = useParams<{ id: string }>();
  const teamId = params.id;
  const provider = useLocalProvider();

  const [team, setTeam] = useState<TeamDto | null>(null);
  const [players, setPlayers] = useState<PlayerDto[]>([]);
  const [divisions, setDivisions] = useState<DivisionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Team edit fields
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [stadium, setStadium] = useState("");
  // "__none" sentinel ⇄ no division (Radix Select forbids empty-string values).
  const [divisionId, setDivisionId] = useState("__none");
  const [savingTeam, setSavingTeam] = useState(false);

  // Add-player fields
  const [pName, setPName] = useState("");
  const [pPosition, setPPosition] = useState("QB");
  const [pJersey, setPJersey] = useState("");
  const [pStatus, setPStatus] = useState("Active");
  const [addingPlayer, setAddingPlayer] = useState(false);

  const load = useCallback(
    async (p: LocalWorkspaceProvider) => {
      const t = await p.getTeam(teamId);
      if (!t) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setTeam(t);
      setName(t.name);
      setCity(t.city);
      setStadium(t.stadium);
      setDivisionId(t.divisionId === "" ? "__none" : t.divisionId);
      const [roster, divs] = await Promise.all([
        p.listPlayersByTeam(teamId),
        p.listDivisions(t.leagueId),
      ]);
      setPlayers(roster);
      setDivisions(divs);
      setLoading(false);
    },
    [teamId],
  );

  useEffect(() => {
    // Justified: async load from the client-only IndexedDB provider once it
    // mounts. The setState calls run after awaits inside load(), not as a
    // synchronous cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (provider) void load(provider);
  }, [provider, load]);

  async function onSaveTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!provider || !team) return;
    if (!name.trim() || !city.trim() || !stadium.trim()) {
      toast.error("Name, city, and venue are required.");
      return;
    }
    setSavingTeam(true);
    try {
      const updated = await provider.updateTeam(team.id, {
        name: name.trim(),
        city: city.trim(),
        stadium: stadium.trim(),
        divisionId: divisionId === "__none" ? "" : divisionId,
      });
      if (updated) setTeam(updated);
      toast.success("Team saved.");
    } finally {
      setSavingTeam(false);
    }
  }

  async function onAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!provider || !team) return;
    if (!pName.trim()) {
      toast.error("Player name is required.");
      return;
    }
    const jerseyNumber = pJersey.trim() === "" ? null : Number(pJersey);
    if (jerseyNumber !== null && !Number.isInteger(jerseyNumber)) {
      toast.error("Jersey number must be a whole number.");
      return;
    }
    setAddingPlayer(true);
    try {
      await provider.createPlayer({
        name: pName.trim(),
        teamId: team.id,
        position: pPosition,
        jerseyNumber,
        dateOfBirth: null,
        status: pStatus,
      });
      toast.success(`Added ${pName.trim()}.`);
      setPName("");
      setPJersey("");
      setPlayers(await provider.listPlayersByTeam(team.id));
    } catch (err) {
      if (err instanceof DuplicateJerseyError) {
        toast.error(`Jersey #${err.jerseyNumber} is already worn on this team.`);
      } else {
        toast.error("Could not add player.");
      }
    } finally {
      setAddingPlayer(false);
    }
  }

  async function onDeletePlayer(id: string, playerName: string) {
    if (!provider) return;
    await provider.deletePlayer(id);
    toast.success(`Removed ${playerName}.`);
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          That team doesn&rsquo;t exist in this browser&rsquo;s workspace.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/local">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to workspace
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/local"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Workspace
        </Link>
        <h1 className="text-xl font-semibold text-foreground">{team?.name}</h1>
      </div>

      {/* Team details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSaveTeam} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Name</Label>
              <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-city">City</Label>
              <Input id="t-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-stadium">Home venue</Label>
              <Input id="t-stadium" value={stadium} onChange={(e) => setStadium(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-division">Division</Label>
              <Select value={divisionId} onValueChange={setDivisionId}>
                <SelectTrigger id="t-division">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No division</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={savingTeam}>
                {savingTeam ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Roster */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          Roster{" "}
          <span className="text-muted-foreground">({players.length})</span>
        </h2>
        {players.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No players yet. Add one below.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="flex items-center gap-3">
                  <span className="w-8 text-right font-mono text-muted-foreground">
                    {p.jerseyNumber ?? "—"}
                  </span>
                  <span className="font-medium text-foreground">{p.name}</span>
                  <Badge variant="outline">{p.position}</Badge>
                  {p.status !== "Active" && (
                    <span className="text-xs text-muted-foreground">{p.status}</span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => onDeletePlayer(p.id, p.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add player */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a player</CardTitle>
          <CardDescription>Jersey number is optional.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onAddPlayer}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="Pat Lee"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-position">Position</Label>
              <Select value={pPosition} onValueChange={setPPosition}>
                <SelectTrigger id="p-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((pos) => (
                    <SelectItem key={pos} value={pos}>
                      {pos}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-jersey">Jersey #</Label>
              <Input
                id="p-jersey"
                inputMode="numeric"
                value={pJersey}
                onChange={(e) => setPJersey(e.target.value)}
                placeholder="12"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-status">Status</Label>
              <Select value={pStatus} onValueChange={setPStatus}>
                <SelectTrigger id="p-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={addingPlayer}>
                {addingPlayer ? "Adding…" : "Add player"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
