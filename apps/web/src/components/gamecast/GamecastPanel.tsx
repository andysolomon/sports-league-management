import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function GamecastPanel({
  title,
  children,
  className,
  contentClassName,
  hideHeader = false,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  hideHeader?: boolean;
}) {
  return (
    <Card
      className={cn(
        "gap-0 rounded-card border-border bg-surface py-0 shadow-none",
        className,
      )}
    >
      {!hideHeader ? (
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="font-mono text-[11px] font-bold uppercase tracking-wide text-text-muted">
            {title}
          </CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={cn("px-4 py-4", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

export function GamecastPlayByPlayCard({ children }: { children: ReactNode }) {
  return (
    <Card className="gap-0 rounded-card border-border bg-surface py-0 shadow-none">
      <CardHeader className="border-b border-border px-4 py-3">
        <CardTitle className="font-mono text-[11px] font-bold uppercase tracking-wide text-text-muted">
          Play-by-play
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}
