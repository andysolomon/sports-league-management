"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export default function JoinForm({
  leagueName,
  orgId,
  token,
}: {
  leagueName: string;
  orgId: string;
  token: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleJoin() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/orgs/${orgId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to submit request");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <h2 className="text-lg font-semibold text-gray-900">Request Submitted</h2>
          <p className="mt-2 text-sm text-gray-500">
            Your request to join {leagueName} has been submitted.
            An admin will review your request.
          </p>
          <Button className="mt-4" onClick={() => router.push("/dashboard")}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <CardTitle>Join {leagueName}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-gray-500">
          You&apos;ve been invited to join this league. Click below to request access.
        </p>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <Button
          className="w-full"
          onClick={handleJoin}
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Request to Join"}
        </Button>
      </CardContent>
    </Card>
  );
}
