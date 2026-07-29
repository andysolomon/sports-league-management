"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  openTransferWindowAction,
  resolveTransferAction,
} from "@/app/dashboard/_actions/transfers";
import type { TransferDto } from "@/lib/data-api";
import {
  TRANSFER_REASON_LABELS,
  type TransferReason,
} from "@/lib/dynasty/transfers";

/*
 * The transfer window (Dynasty Mode B4).
 *
 * Two lists, because there are two decisions. Outbound is "one of yours wants
 * to leave — argue or let him go". Inbound is "someone else's player is
 * available — take him or pass".
 *
 * An inbound offer stays visible but UNACTIONABLE until the losing coach
 * releases him. Hiding it instead would be less honest: a coach should be able
 * to see who he might get and that he is waiting on somebody else, which is
 * the tension the two-sided model exists to create.
 */

const REASON_COPY: Record<string, string> = {
  transfer_not_released:
    "His program has not released him yet.",
  transfer_not_pending: "That decision has already been made.",
  transfer_team_mismatch: "That is not your decision to make.",
  roster_full: "This roster is already at the maximum size.",
  season_locked: "The roster is locked for this season.",
  not_authorized: "You cannot make transfer decisions for this team.",
};

function copyFor(reason: string): string {
  return REASON_COPY[reason] ?? "Could not complete that transfer decision.";
}

function reasonLabel(reason: string): string {
  return (
    TRANSFER_REASON_LABELS[reason as TransferReason] ?? "Considering a move"
  );
}

export interface TransferPanelProps {
  leagueId: string;
  seasonId: string;
  transfers: TransferDto[];
  /** The team this viewer decides for, or null when they manage none. */
  actingTeam: { id: string; name: string } | null;
  isAdmin: boolean;
}

export function TransferPanel({
  leagueId,
  seasonId,
  transfers,
  actingTeam,
  isAdmin,
}: TransferPanelProps) {
  const [rows, setRows] = useState(transfers);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { outbound, inbound } = useMemo(() => {
    const mine = actingTeam?.id ?? null;
    return {
      outbound: rows.filter(
        (row) => row.direction === "out" && row.fromTeamId === mine,
      ),
      inbound: rows.filter(
        (row) => row.direction === "in" && row.toTeamId === mine,
      ),
    };
  }, [rows, actingTeam]);

  function decide(transfer: TransferDto, decision: "accept" | "reject") {
    if (!actingTeam) return;
    setMessage(null);
    startTransition(async () => {
      const result = await resolveTransferAction({
        transferId: transfer.id,
        teamId: actingTeam.id,
        seasonId,
        decision,
      });
      if (!result.ok) {
        setMessage(copyFor(result.error));
        return;
      }
      /*
       * Resolving one row can withdraw others, so the local update touches
       * every row for that player rather than only the one clicked. Patching
       * just the clicked row would leave a withdrawn offer looking live until
       * the next navigation.
       */
      setRows((current) =>
        current.map((row) => {
          if (row.id === transfer.id) {
            return { ...row, status: result.data.status };
          }
          if (row.playerId !== transfer.playerId) return row;
          if (row.status !== "pending") return row;
          if (transfer.direction === "out" && decision === "accept") {
            return { ...row, released: true };
          }
          return row.direction === "in" ? { ...row, status: "withdrawn" } : row;
        }),
      );
      setMessage(
        result.data.moved
          ? `${transfer.playerName} joins ${actingTeam.name}.`
          : null,
      );
    });
  }

  function openWindow() {
    setMessage(null);
    startTransition(async () => {
      const result = await openTransferWindowAction({ leagueId, seasonId });
      if (!result.ok) {
        setMessage(copyFor(result.error));
        return;
      }
      setMessage(
        result.data.outbound === 0
          ? "Nobody is looking to transfer this offseason."
          : `${result.data.outbound} player${result.data.outbound === 1 ? "" : "s"} entered the window. Reload to see them.`,
      );
    });
  }

  if (rows.length === 0) {
    return (
      <section data-testid="transfer-panel" className="space-y-3">
        <h3 className="text-sm font-semibold">Transfer window</h3>
        <p className="text-sm text-muted-foreground">
          The transfer window has not been opened for this season.
        </p>
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={openWindow}
            data-testid="open-transfer-window"
          >
            Open transfer window
          </Button>
        )}
        {message && (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        )}
      </section>
    );
  }

  return (
    <section data-testid="transfer-panel" className="space-y-4">
      <h3 className="text-sm font-semibold">Transfer window</h3>

      {message && (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}

      {!actingTeam && (
        <p className="text-sm text-muted-foreground">
          You do not manage a team in this league, so there is nothing here to
          decide.
        </p>
      )}

      <TransferList
        testId="transfer-outbound"
        title="Leaving"
        empty="Nobody on your roster is looking to move."
        rows={outbound}
        pending={pending}
        renderContext={(row) => `${row.position} · ${reasonLabel(row.reason)}`}
        acceptLabel="Let him go"
        rejectLabel="Keep him"
        canAct={() => true}
        onDecide={decide}
      />

      <TransferList
        testId="transfer-inbound"
        title="Available"
        empty="No programs have offered you a transfer."
        rows={inbound}
        pending={pending}
        renderContext={(row) =>
          `${row.position} · from ${row.fromTeamName}${
            row.released ? "" : " · awaiting release"
          }`
        }
        acceptLabel="Sign him"
        rejectLabel="Pass"
        // An offer is only actionable once his own coach has released him.
        canAct={(row) => row.released}
        onDecide={decide}
      />
    </section>
  );
}

function TransferList({
  testId,
  title,
  empty,
  rows,
  pending,
  renderContext,
  acceptLabel,
  rejectLabel,
  canAct,
  onDecide,
}: {
  testId: string;
  title: string;
  empty: string;
  rows: TransferDto[];
  pending: boolean;
  renderContext: (row: TransferDto) => string;
  acceptLabel: string;
  rejectLabel: string;
  canAct: (row: TransferDto) => boolean;
  onDecide: (row: TransferDto, decision: "accept" | "reject") => void;
}) {
  return (
    <div className="space-y-2" data-testid={testId}>
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">
        {title}
      </h4>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-3 p-3"
              data-testid="transfer-row"
            >
              <div className="min-w-[12rem] flex-1">
                <p className="text-sm font-medium">{row.playerName}</p>
                <p className="text-xs text-muted-foreground">
                  {renderContext(row)}
                </p>
              </div>
              {row.status === "pending" ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onDecide(row, "reject")}
                  >
                    {rejectLabel}
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending || !canAct(row)}
                    onClick={() => onDecide(row, "accept")}
                  >
                    {acceptLabel}
                  </Button>
                </div>
              ) : (
                <span
                  className="text-xs text-muted-foreground"
                  data-testid="transfer-status"
                >
                  {statusCopy(row.status)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * `withdrawn` reads differently from `rejected` on purpose: one is a decision
 * this coach made, the other is a decision taken away from him by somebody
 * else. Collapsing them would make the panel misreport who chose what.
 */
function statusCopy(status: string): string {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Declined";
    case "withdrawn":
      return "No longer available";
    default:
      return status;
  }
}
