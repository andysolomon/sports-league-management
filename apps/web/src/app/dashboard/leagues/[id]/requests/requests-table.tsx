"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/8bit/button";

interface PendingRequest {
  userId: string;
  email: string;
  requestedAt: string;
}

export default function RequestsTable({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/orgs/${orgId}/requests`);
        if (res.ok) {
          const data = await res.json();
          setRequests(data);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgId]);

  async function handleApprove(requestUserId: string) {
    setActionLoading(requestUserId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/requests/${requestUserId}`, {
        method: "POST",
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.userId !== requestUserId));
        router.refresh();
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(requestUserId: string) {
    setActionLoading(requestUserId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/requests/${requestUserId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.userId !== requestUserId));
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading requests...</p>;

  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending requests.</p>;
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => {
        const isLoading = actionLoading === req.userId;
        return (
          <div
            key={req.userId}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{req.email}</p>
              <p className="text-xs text-muted-foreground">
                Requested {new Date(req.requestedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Pending</Badge>
              <Button
                size="sm"
                disabled={isLoading}
                onClick={() => handleApprove(req.userId)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading}
                onClick={() => handleReject(req.userId)}
              >
                Reject
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
