"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DeleteConfirm from "@/app/dashboard/_components/delete-confirm";
import { toast } from "sonner";
import { Trophy, CheckCircle2, Plus, Layers, X } from "lucide-react";

export interface DiscoverLeague {
  id: string;
  name: string;
  /** Whether teams in this (reference) league can be forked into a workspace. */
  forkable: boolean;
  /** Top-tier grouping (WSM-000133), where the league has one. */
  conferences: { id: string; name: string }[];
  divisions: { id: string; name: string; conferenceId: string | null }[];
  teams: { id: string; name: string; divisionId: string; added: boolean }[];
}

interface DivisionGroup {
  id: string;
  name: string;
  teams: DiscoverLeague["teams"];
}

interface ConferenceGroup {
  id: string;
  name: string;
  divisions: DivisionGroup[];
}

/** Aggregate added/total over a list of teams → "all" | "partial" | "none". */
type AddState = "all" | "partial" | "none";
function addState(teams: { id: string }[], added: Set<string>): AddState {
  if (teams.length === 0) return "none";
  const have = teams.filter((t) => added.has(t.id)).length;
  if (have === 0) return "none";
  if (have === teams.length) return "all";
  return "partial";
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
  const { conferences, divisions, teams } = league;
  // Local "added" overlay so the UI updates without a full refetch.
  const [added, setAdded] = useState<Set<string>>(
    () => new Set(teams.filter((t) => t.added).map((t) => t.id)),
  );
  // What's currently being added — a team id, "div:<id>", "conf:<id>", or "all".
  const [busy, setBusy] = useState<string | null>(null);
  // The team pending removal confirmation (un-add deletes the private fork).
  const [confirmRemove, setConfirmRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Build the conference → division → team hierarchy. Divisions without a
  // conference (or leagues with no conferences at all) fall under a synthetic
  // "Divisions" group so the tree stays uniform.
  const { conferenceGroups, looseDivisions } = useMemo(() => {
    const teamsByDivision = new Map<string, DiscoverLeague["teams"]>();
    for (const team of teams) {
      const list = teamsByDivision.get(team.divisionId) ?? [];
      list.push(team);
      teamsByDivision.set(team.divisionId, list);
    }

    const knownDivisionIds = new Set(divisions.map((d) => d.id));
    const toDivisionGroup = (d: {
      id: string;
      name: string;
    }): DivisionGroup => ({
      id: d.id,
      name: d.name,
      teams: teamsByDivision.get(d.id) ?? [],
    });

    const divisionsByConference = new Map<string, DivisionGroup[]>();
    const loose: DivisionGroup[] = [];
    for (const d of divisions) {
      const group = toDivisionGroup(d);
      if (group.teams.length === 0) continue;
      if (d.conferenceId) {
        const list = divisionsByConference.get(d.conferenceId) ?? [];
        list.push(group);
        divisionsByConference.set(d.conferenceId, list);
      } else {
        loose.push(group);
      }
    }

    // Teams whose division isn't in the divisions list → "Other".
    const orphanTeams = teams.filter((t) => !knownDivisionIds.has(t.divisionId));
    if (orphanTeams.length) {
      loose.push({ id: "__other", name: "Other", teams: orphanTeams });
    }

    const confGroups: ConferenceGroup[] = conferences
      .map((c) => ({
        id: c.id,
        name: c.name,
        divisions: divisionsByConference.get(c.id) ?? [],
      }))
      .filter((c) => c.divisions.length > 0);

    return { conferenceGroups: confGroups, looseDivisions: loose };
  }, [conferences, divisions, teams]);

  async function postFork(
    url: string,
    teamIds: string[],
    label: string,
  ): Promise<boolean> {
    const res = await fetch(url, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setAdded((prev) => {
        const next = new Set(prev);
        for (const id of teamIds) next.add(id);
        return next;
      });
      return true;
    }
    toast.error(body.error ?? `Could not add ${label}.`);
    return false;
  }

  async function onAddTeam(teamId: string, teamName: string) {
    setBusy(teamId);
    try {
      if (await postFork(`/api/teams/${teamId}/claim`, [teamId], teamName)) {
        toast.success(`Added ${teamName} to your teams.`);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  // Un-add: open the confirm dialog (removal deletes the private fork + roster).
  function onRemoveTeam(teamId: string, teamName: string) {
    setConfirmRemove({ id: teamId, name: teamName });
  }

  async function doRemoveTeam() {
    if (!confirmRemove) return;
    const { id, name } = confirmRemove;
    setBusy(id);
    try {
      const res = await fetch(`/api/teams/${id}/unclaim`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setAdded((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.success(`Removed ${name} from your teams.`);
        router.refresh();
      } else {
        toast.error(body.error ?? `Could not remove ${name}.`);
      }
    } finally {
      setBusy(null);
      setConfirmRemove(null);
    }
  }

  async function onAddDivision(group: DivisionGroup) {
    const remaining = group.teams.filter((t) => !added.has(t.id));
    if (remaining.length === 0) return;
    // The "Other" bucket isn't a real division — fall back to per-team forks.
    setBusy(`div:${group.id}`);
    try {
      let ok: boolean;
      if (group.id === "__other") {
        ok = true;
        for (const t of remaining) {
          ok =
            (await postFork(`/api/teams/${t.id}/claim`, [t.id], t.name)) && ok;
        }
      } else {
        ok = await postFork(
          `/api/divisions/${group.id}/fork`,
          remaining.map((t) => t.id),
          group.name,
        );
      }
      if (ok) {
        toast.success(
          `Added ${remaining.length} team${
            remaining.length === 1 ? "" : "s"
          } from ${group.name}.`,
        );
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function onAddConference(conf: ConferenceGroup) {
    const teamIds = conf.divisions.flatMap((d) => d.teams.map((t) => t.id));
    const remaining = teamIds.filter((id) => !added.has(id));
    if (remaining.length === 0) return;
    setBusy(`conf:${conf.id}`);
    try {
      if (
        await postFork(
          `/api/conferences/${conf.id}/fork`,
          remaining,
          conf.name,
        )
      ) {
        toast.success(
          `Added ${remaining.length} team${
            remaining.length === 1 ? "" : "s"
          } from ${conf.name}.`,
        );
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function onAddAll() {
    const remaining = league.teams.filter((t) => !added.has(t.id));
    if (remaining.length === 0) return;
    setBusy("all");
    try {
      let n = 0;
      for (const t of remaining) {
        if (await postFork(`/api/teams/${t.id}/claim`, [t.id], t.name)) n += 1;
      }
      if (n) toast.success(`Added ${n} team${n === 1 ? "" : "s"} to your teams.`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const remainingAll = league.teams.filter((t) => !added.has(t.id)).length;
  const anyBusy = busy !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">{league.name}</CardTitle>
            <Badge variant="outline">Public</Badge>
          </div>
          {league.forkable && remainingAll > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={anyBusy}
              onClick={onAddAll}
            >
              {busy === "all" ? "Adding…" : `Add all (${remainingAll})`}
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
          <div className="space-y-2">
            {conferenceGroups.map((conf) => (
              <ConferenceSection
                key={conf.id}
                conference={conf}
                added={added}
                busy={busy}
                anyBusy={anyBusy}
                onAddConference={onAddConference}
                onAddDivision={onAddDivision}
                onAddTeam={onAddTeam}
                onRemoveTeam={onRemoveTeam}
              />
            ))}
            {looseDivisions.length > 0 && (
              <Accordion type="multiple" className="w-full">
                {looseDivisions.map((group) => (
                  <DivisionSection
                    key={group.id}
                    group={group}
                    added={added}
                    busy={busy}
                    anyBusy={anyBusy}
                    onAddDivision={onAddDivision}
                    onAddTeam={onAddTeam}
                    onRemoveTeam={onRemoveTeam}
                  />
                ))}
              </Accordion>
            )}
          </div>
        )}
      </CardContent>
      <DeleteConfirm
        isOpen={confirmRemove !== null}
        isDeleting={confirmRemove !== null && busy === confirmRemove.id}
        title={`Remove ${confirmRemove?.name ?? "team"}?`}
        message="This deletes your private copy of this team and its roster. The original league is unaffected, and you can add it again later."
        onConfirm={doRemoveTeam}
        onCancel={() => setConfirmRemove(null)}
      />
    </Card>
  );
}

function StateBadge({ state }: { state: AddState }) {
  if (state === "all") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-green-500">
        <CheckCircle2 className="h-3.5 w-3.5" />
        All added
      </span>
    );
  }
  if (state === "partial") {
    return (
      <Badge variant="secondary" className="shrink-0 text-xs">
        Partial
      </Badge>
    );
  }
  return null;
}

function ConferenceSection({
  conference,
  added,
  busy,
  anyBusy,
  onAddConference,
  onAddDivision,
  onAddTeam,
  onRemoveTeam,
}: {
  conference: ConferenceGroup;
  added: Set<string>;
  busy: string | null;
  anyBusy: boolean;
  onAddConference: (conf: ConferenceGroup) => void;
  onAddDivision: (group: DivisionGroup) => void;
  onAddTeam: (teamId: string, teamName: string) => void;
  onRemoveTeam: (teamId: string, teamName: string) => void;
}) {
  const allTeams = conference.divisions.flatMap((d) => d.teams);
  const state = addState(allTeams, added);
  const remaining = allTeams.filter((t) => !added.has(t.id)).length;
  return (
    <Accordion type="multiple" className="w-full">
      <AccordionItem value={conference.id}>
        <AccordionTrigger>
          <span className="flex flex-1 items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="font-semibold">{conference.name}</span>
            <StateBadge state={state} />
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="mb-3 flex justify-end">
            {state === "all" ? null : (
              <Button
                size="sm"
                variant="outline"
                disabled={anyBusy}
                onClick={() => onAddConference(conference)}
              >
                {busy === `conf:${conference.id}`
                  ? "Adding…"
                  : `Add conference (${remaining})`}
              </Button>
            )}
          </div>
          <Accordion type="multiple" className="w-full pl-2">
            {conference.divisions.map((group) => (
              <DivisionSection
                key={group.id}
                group={group}
                added={added}
                busy={busy}
                anyBusy={anyBusy}
                onAddDivision={onAddDivision}
                onAddTeam={onAddTeam}
                onRemoveTeam={onRemoveTeam}
              />
            ))}
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function DivisionSection({
  group,
  added,
  busy,
  anyBusy,
  onAddDivision,
  onAddTeam,
  onRemoveTeam,
}: {
  group: DivisionGroup;
  added: Set<string>;
  busy: string | null;
  anyBusy: boolean;
  onAddDivision: (group: DivisionGroup) => void;
  onAddTeam: (teamId: string, teamName: string) => void;
  onRemoveTeam: (teamId: string, teamName: string) => void;
}) {
  const state = addState(group.teams, added);
  const remaining = group.teams.filter((t) => !added.has(t.id)).length;
  return (
    <AccordionItem value={group.id}>
      <AccordionTrigger>
        <span className="flex flex-1 items-center gap-2">
          <span className="font-medium">{group.name}</span>
          <span className="text-xs text-muted-foreground">
            ({group.teams.length})
          </span>
          <StateBadge state={state} />
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="mb-3 flex justify-end">
          {state === "all" ? null : (
            <Button
              size="sm"
              variant="outline"
              disabled={anyBusy}
              onClick={() => onAddDivision(group)}
            >
              {busy === `div:${group.id}`
                ? "Adding…"
                : `Add division (${remaining})`}
            </Button>
          )}
        </div>
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
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Added
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      disabled={anyBusy}
                      onClick={() => onRemoveTeam(team.id, team.name)}
                      aria-label={`Remove ${team.name}`}
                    >
                      {busy === team.id ? (
                        "…"
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0 px-2"
                    disabled={anyBusy}
                    onClick={() => onAddTeam(team.id, team.name)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {busy === team.id ? "…" : "Add"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
