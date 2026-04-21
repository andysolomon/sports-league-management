"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
}

export default function PositionColumn({
  teamId,
  seasonId,
  leagueId,
  positionSlot,
  players,
  disabled,
}: PositionColumnProps) {
  const [items, setItems] = useState<PlayerDto[]>(players);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
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
      className="rounded-md border bg-white"
      aria-label={`${positionSlot} depth chart`}
    >
      <header className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="font-mono text-sm font-semibold text-gray-700">
          {positionSlot}
        </h3>
        <span className="text-xs text-gray-500">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-gray-500">
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
}: {
  player: PlayerDto;
  rank: number;
  disabled: boolean;
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
        className={`text-gray-400 ${disabled ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing hover:text-gray-600"}`}
        aria-label={`Drag ${player.name}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 font-mono text-xs text-gray-500">{rank}</span>
      <span className="flex-1 text-sm text-gray-900">{player.name}</span>
      {player.jerseyNumber !== null && (
        <span className="font-mono text-xs text-gray-500">
          #{player.jerseyNumber}
        </span>
      )}
    </li>
  );
}
