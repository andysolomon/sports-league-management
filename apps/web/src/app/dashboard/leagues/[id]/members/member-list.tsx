"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORG_ROLES, roleLabel, type OrgRole } from "@/lib/permissions";

interface Member {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  role: OrgRole;
  createdAt: number;
}

const ROLE_HINT: Record<OrgRole, string> = {
  admin: "Full control",
  coach: "Manage rosters & players",
  viewer: "Read-only",
};

export default function MemberList({ orgId }: { orgId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/orgs/${orgId}/members`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgId]);

  async function handleRoleChange(memberUserId: string, newRole: OrgRole) {
    setActionLoading(memberUserId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId, role: newRole }),
      });
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.userId === memberUserId ? { ...m, role: newRole } : m,
          ),
        );
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to update role");
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemove(memberUserId: string) {
    if (!confirm("Are you sure you want to remove this member?")) return;

    setActionLoading(memberUserId);
    try {
      const res = await fetch(`/api/orgs/${orgId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId }),
      });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== memberUserId));
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to remove member");
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (loading)
    return <p className="text-sm text-muted-foreground">Loading members...</p>;
  if (members.length === 0)
    return <p className="text-sm text-muted-foreground">No members found.</p>;

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const isLoading = actionLoading === member.userId;
        const displayName =
          [member.firstName, member.lastName].filter(Boolean).join(" ") ||
          member.email;

        return (
          <div
            key={member.userId}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
          >
            <div className="flex items-center gap-3">
              {member.imageUrl && (
                <img
                  src={member.imageUrl}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {displayName}
                </p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                {roleLabel(member.role)}
              </Badge>
              <Select
                value={member.role}
                onValueChange={(value) =>
                  handleRoleChange(member.userId, value as OrgRole)
                }
                disabled={isLoading}
              >
                <SelectTrigger className="w-[120px]" aria-label="Member role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabel(r)} — {ROLE_HINT[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading}
                onClick={() => handleRemove(member.userId)}
                className="text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
