"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Users } from "lucide-react";
import { toast } from "sonner";
import { signFreeAgentAction } from "@/app/dashboard/_actions/offseason";
import {
  ALL_CLASSES,
  ALL_POSITIONS,
  filterAndSortFreeAgents,
  uniquePositions,
  type FreeAgentRow,
  type FreeAgentSortKey,
} from "@/lib/offseason-free-agency";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FreeAgencyTableView } from "./FreeAgencyTableView";

const CLASS_OPTIONS = ["FR", "SO", "JR", "SR"] as const;

export interface FreeAgencyPanelProps {
  seasonId: string;
  agents: FreeAgentRow[];
  teams: { id: string; name: string }[];
  canSign: boolean;
  isAdmin: boolean;
  coachTeam: { id: string; name: string } | null;
}

export function FreeAgencyPanel({
  seasonId,
  agents,
  teams,
  canSign,
  isAdmin,
  coachTeam,
}: FreeAgencyPanelProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [position, setPosition] = useState(ALL_POSITIONS);
  const [classYear, setClassYear] = useState(ALL_CLASSES);
  const [sortKey, setSortKey] = useState<FreeAgentSortKey>("overall");
  const [selectedAgent, setSelectedAgent] = useState<FreeAgentRow | null>(null);
  const [targetTeamId, setTargetTeamId] = useState(teams[0]?.id ?? "");

  const positions = useMemo(() => uniquePositions(agents), [agents]);
  const filteredAgents = useMemo(
    () =>
      filterAndSortFreeAgents(
        agents,
        { position, classYear },
        sortKey,
      ),
    [agents, position, classYear, sortKey],
  );

  const showTeamPicker = isAdmin || teams.length > 1;
  const defaultTeamId = coachTeam?.id ?? teams[0]?.id ?? "";

  function signLabel(_agent: FreeAgentRow) {
    if (!showTeamPicker && coachTeam) {
      return `Sign to ${coachTeam.name}`;
    }
    return "Sign";
  }

  function openSignDialog(agent: FreeAgentRow) {
    setSelectedAgent(agent);
    setTargetTeamId(defaultTeamId);
  }

  function closeSignDialog() {
    if (pending) return;
    setSelectedAgent(null);
  }

  function confirmSign() {
    if (!selectedAgent) return;
    const teamId = showTeamPicker ? targetTeamId : defaultTeamId;
    if (!teamId) {
      toast.error("Select a team to sign this player.");
      return;
    }

    start(async () => {
      const res = await signFreeAgentAction({
        playerId: selectedAgent.id,
        teamId,
        seasonId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.overCap) {
        toast.warning("Player signed, but the team is over the target roster size.");
      } else {
        toast.success(`${selectedAgent.name} signed.`);
      }
      setSelectedAgent(null);
      router.refresh();
    });
  }

  return (
    <section
      className="space-y-4"
      aria-labelledby="free-agency-heading"
      data-testid="free-agency-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="free-agency-heading"
            className="inline-flex items-center gap-1.5 text-lg font-semibold text-foreground"
          >
            <Users className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Free agents
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {agents.length} player{agents.length === 1 ? "" : "s"} available to
            sign.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setSortKey((current) => (current === "overall" ? "name" : "overall"))
          }
        >
          <ArrowUpDown className="mr-1 h-3.5 w-3.5" aria-hidden />
          Sort by {sortKey === "overall" ? "name" : "overall"}
        </Button>
      </div>

      <div className="flex flex-col gap-3 min-[900px]:flex-row">
        <Select value={position} onValueChange={setPosition}>
          <SelectTrigger className="w-full min-[900px]:w-40" aria-label="Filter by position">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_POSITIONS}>All positions</SelectItem>
            {positions.map((pos) => (
              <SelectItem key={pos} value={pos}>
                {pos}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={classYear} onValueChange={setClassYear}>
          <SelectTrigger className="w-full min-[900px]:w-36" aria-label="Filter by class">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CLASSES}>All classes</SelectItem>
            {CLASS_OPTIONS.map((label) => (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FreeAgencyTableView
        agents={filteredAgents}
        canSign={canSign}
        signLabel={signLabel}
        onSignClick={canSign ? openSignDialog : undefined}
      />

      <Dialog open={selectedAgent != null} onOpenChange={(open) => !open && closeSignDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign free agent</DialogTitle>
            <DialogDescription>
              {selectedAgent
                ? `Add ${selectedAgent.name} (${selectedAgent.position}) to a roster for the upcoming season.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {showTeamPicker ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="sign-team">
                Target team
              </label>
              <Select value={targetTeamId} onValueChange={setTargetTeamId}>
                <SelectTrigger id="sign-team" className="w-full">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : coachTeam ? (
            <p className="text-sm text-muted-foreground">
              Signing to <span className="font-medium text-foreground">{coachTeam.name}</span>.
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={closeSignDialog}
            >
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={confirmSign}>
              {pending ? "Signing…" : "Confirm sign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
