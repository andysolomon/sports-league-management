"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/8bit/button";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

/**
 * Forks a reference team into the user's private workspace (WSM-000110/115). On
 * success the server returns the new workspace team (an editable private copy);
 * we redirect there. Creates the user's org automatically if they have none.
 */
export function ClaimTeamButton({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function claim() {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          body.createdOrg
            ? `Added ${teamName} — we set up your organization. Here's your editable copy.`
            : `Added ${teamName} to your teams — here's your editable copy.`,
        );
        // Go to the new private workspace team (the editable copy), not the
        // read-only reference we forked from.
        if (body.teamId) {
          router.push(`/dashboard/teams/${body.teamId}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(body.error ?? "Could not add this team.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={claim} disabled={loading} size="sm">
      <ShieldCheck className="mr-1 h-4 w-4" />
      {loading ? "Adding…" : "Add to my teams"}
    </Button>
  );
}
