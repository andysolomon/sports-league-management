"use client";

import { useState } from "react";
import type { PlayerDto } from "@sports-management/shared-types";
import {
  CreatePlayerInputSchema,
  UpdatePlayerInputSchema,
} from "@sports-management/api-contracts";

interface PlayerFormProps {
  mode: "create" | "edit";
  teamId: string;
  player?: PlayerDto;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PlayerForm({
  mode,
  teamId,
  player,
  onSuccess,
  onCancel,
}: PlayerFormProps) {
  const [name, setName] = useState(player?.name ?? "");
  const [position, setPosition] = useState(player?.position ?? "");
  const [jerseyNumber, setJerseyNumber] = useState(
    player?.jerseyNumber?.toString() ?? "",
  );
  const [dateOfBirth, setDateOfBirth] = useState(player?.dateOfBirth ?? "");
  const [status, setStatus] = useState(player?.status ?? "Active");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const data = {
        name,
        teamId,
        position,
        jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
        dateOfBirth: dateOfBirth || null,
        status,
      };

      if (mode === "create") {
        const parsed = CreatePlayerInputSchema.safeParse(data);
        if (!parsed.success) {
          setError(parsed.error.errors[0].message);
          return;
        }
        const res = await fetch("/api/players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to create player");
        }
      } else {
        const parsed = UpdatePlayerInputSchema.safeParse(data);
        if (!parsed.success) {
          setError(parsed.error.errors[0].message);
          return;
        }
        const res = await fetch(`/api/players/${player!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to update player");
        }
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          {mode === "create" ? "Add Player" : "Edit Player"}
        </h3>

        {error && (
          <div className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Position *
            </label>
            <input
              type="text"
              required
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Jersey Number
            </label>
            <input
              type="number"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Date of Birth
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Status *
            </label>
            <select
              required
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="Active">Active</option>
              <option value="Injured">Injured</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : mode === "create"
                  ? "Add Player"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
