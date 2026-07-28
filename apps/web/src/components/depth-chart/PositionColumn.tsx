"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import type { PlayerDto } from "@sports-management/shared-types";
import { reorderDepthChartAction } from "@/app/dashboard/teams/[id]/depth-chart/actions";

interface PositionColumnProps {
  teamId: string;
  seasonId: string;
  leagueId: string;
  positionSlot: string;
  players: PlayerDto[];
  disabled: boolean;
  /** Player ids serving an injury (A4), with games remaining. */
  outPlayers?: ReadonlyMap<string, number>;
}

export default function PositionColumn({
  teamId,
  seasonId,
  leagueId,
  positionSlot,
  players,
  disabled,
  outPlayers,
}: PositionColumnProps) {
  const [items, setItems] = useState<PlayerDto[]>(players);
  const [pending, startTransition] = useTransition();

  // A single PointerSensor can't tell a drag from a scroll on a touchscreen,
  // so on a phone the board either refused to pick up players or hijacked the
  // page scroll (WSM-000085). Split the sensors: mouse drags start instantly
  // after a tiny move, while touch requires a 200ms press-and-hold — that hold
  // distinguishes "pick up this player" from "scroll the list", and dnd-kit
  // manages touch-action during the delay so the page still scrolls normally.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = items;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);

    startTransition(async () => {
      try {
        await reorderDepthChartAction({
          teamId,
          seasonId,
          leagueId,
          positionSlot,
          playerIds: next.map((p) => p.id),
        });
      } catch (err) {
        setItems(previous);
        const message =
          err instanceof Error ? err.message : "Failed to reorder";
        toast.error(message);
      }
    });
  }

  return (
    <section
      className="rounded-md border bg-card"
      aria-label={`${positionSlot} depth chart`}
    >
      <header className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="font-mono text-sm font-semibold text-foreground">
          {positionSlot}
        </h3>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
          No players at this position.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="divide-y">
              {items.map((player, index) => (
                <SortableRow
                  key={player.id}
                  player={player}
                  rank={index + 1}
                  disabled={disabled || pending}
                  gamesOut={outPlayers?.get(player.id)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function SortableRow({
  player,
  rank,
  disabled,
  gamesOut,
}: {
  player: PlayerDto;
  rank: number;
  disabled: boolean;
  /** Games still to miss (A4). Undefined means available. */
  gamesOut?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-2"
    >
      <button
        type="button"
        // 44px touch target (WSM-000085): the grip icon stays small, but the
        // hit area is a full 44px square pulled back with -my-2 so the row
        // height is unchanged. touch-none + select-none keep the press-and-hold
        // from triggering page scroll, text selection, or the long-press menu.
        className={`-my-2 flex h-11 w-11 shrink-0 touch-none select-none items-center justify-center text-muted-foreground ${disabled ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing hover:text-foreground"}`}
        aria-label={`Drag ${player.name}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 font-mono text-xs text-muted-foreground">{rank}</span>
      <span className="flex-1 text-sm text-foreground">{player.name}</span>
      {gamesOut !== undefined && (
        /*
         * The depth chart is where a coach decides who plays, so an injured
         * starter has to be visible AT the decision rather than on a separate
         * report they might not open.
         */
        <span
          className="shrink-0 rounded-control border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-destructive"
          data-testid="depth-chart-out-badge"
          title={`Out ${gamesOut} more game${gamesOut === 1 ? "" : "s"}`}
        >
          Out
        </span>
      )}
      {player.jerseyNumber !== null && (
        <span className="font-mono text-xs text-muted-foreground">
          #{player.jerseyNumber}
        </span>
      )}
    </li>
  );
}
