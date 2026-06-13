"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/8bit/button";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

/**
 * Converts a followed team into an owned, editable one (WSM-000110). On success
 * the team belongs to the user's active org and the roster becomes editable.
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
            ? `${teamName} is yours — we set up your coaching organization. You can now manage the roster.`
            : `${teamName} is yours — you can now manage the roster.`,
        );
        router.refresh();
      } else {
        toast.error(body.error ?? "Could not claim this team.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={claim} disabled={loading} size="sm">
      <ShieldCheck className="mr-1 h-4 w-4" />
      {loading ? "Claiming…" : "Claim this team"}
    </Button>
  );
}
