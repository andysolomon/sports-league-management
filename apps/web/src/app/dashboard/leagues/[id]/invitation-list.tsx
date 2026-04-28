"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface Invitation {
  id: string;
  emailAddress: string;
  status: string;
  createdAt: string;
}

export default function InvitationList({ orgId }: { orgId: string }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/orgs/${orgId}/invitations`);
        if (res.ok) {
          const data = await res.json();
          setInvitations(data);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading invitations...</p>;
  if (invitations.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-foreground">Pending Invitations</h3>
      <ul className="space-y-2">
        {invitations.map((inv) => (
          <li
            key={inv.id}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
          >
            <span className="text-foreground">{inv.emailAddress}</span>
            <div className="flex items-center gap-2">
              <Badge variant={inv.status === "pending" ? "secondary" : "outline"}>
                {inv.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(inv.createdAt).toLocaleDateString()}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
