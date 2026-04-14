"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

interface League {
  id: string;
  name: string;
  orgId: string | null;
}

export default function DiscoverLeagues({
  leagues,
  subscribedIds,
}: {
  leagues: League[];
  subscribedIds: string[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [currentSubscribed, setCurrentSubscribed] =
    useState<string[]>(subscribedIds);

  async function handleToggle(leagueId: string, isSubscribed: boolean) {
    setLoadingId(leagueId);
    try {
      const res = await fetch("/api/leagues/subscribe", {
        method: isSubscribed ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId }),
      });

      if (res.ok) {
        setCurrentSubscribed((prev) =>
          isSubscribed
            ? prev.filter((id) => id !== leagueId)
            : [...prev, leagueId],
        );
        router.refresh();
      }
    } finally {
      setLoadingId(null);
    }
  }

  if (leagues.length === 0) {
    return (
      <p className="text-sm text-gray-500">No public leagues available.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {leagues.map((league) => {
        const isSubscribed = currentSubscribed.includes(league.id);
        const isLoading = loadingId === league.id;

        return (
          <Card key={league.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{league.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant="outline">Public</Badge>
                <Button
                  size="sm"
                  variant={isSubscribed ? "outline" : "default"}
                  disabled={isLoading}
                  onClick={() => handleToggle(league.id, isSubscribed)}
                >
                  {isLoading
                    ? "..."
                    : isSubscribed
                      ? "Unsubscribe"
                      : "Subscribe"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
