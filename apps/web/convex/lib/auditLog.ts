import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type RosterAuditAction =
  | "assign"
  | "remove"
  | "status_change"
  | "depth_reorder";

export interface WriteAuditLogInput {
  leagueId: Id<"leagues">;
  teamId: Id<"teams">;
  seasonId: Id<"seasons">;
  actorUserId: string;
  action: RosterAuditAction;
  before: unknown | null;
  after: unknown | null;
}

export async function writeAuditLog(
  ctx: MutationCtx,
  input: WriteAuditLogInput,
): Promise<Id<"rosterAuditLog">> {
  const [league, team, season] = await Promise.all([
    ctx.db.get(input.leagueId),
    ctx.db.get(input.teamId),
    ctx.db.get(input.seasonId),
  ]);
  if (!league) throw new Error("audit_log_invalid_leagueId");
  if (!team) throw new Error("audit_log_invalid_teamId");
  if (!season) throw new Error("audit_log_invalid_seasonId");

  return ctx.db.insert("rosterAuditLog", {
    leagueId: input.leagueId,
    teamId: input.teamId,
    seasonId: input.seasonId,
    actorUserId: input.actorUserId,
    action: input.action,
    beforeJson: input.before === null ? null : JSON.stringify(input.before),
    afterJson: input.after === null ? null : JSON.stringify(input.after),
    createdAt: new Date().toISOString(),
  });
}
