import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  accountBillingHref,
  accountImportHref,
} from "@/components/workspace/resource-navigation";

/**
 * Account Settings hub (issue #576, ASR-8): user-scoped destinations that
 * survive league churn — Import (cross-league; the payload owns league
 * identity) and Billing (Stripe tier/customer). Always available, including
 * for operators with zero leagues (ASR-22).
 */
export default async function AccountSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="space-y-4" data-testid="account-settings">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Account Settings
        </h1>
        <p className="text-sm text-text-muted">
          Data import and billing for your account.
        </p>
      </div>

      <Card>
        <CardContent className="divide-y divide-border pt-2">
          <Link
            href={accountImportHref()}
            className="flex items-center justify-between gap-3 py-4"
            data-testid="account-import-link"
          >
            <span className="min-w-0">
              <span className="block text-label-14 text-foreground">
                Import
              </span>
              <span className="block text-caption-12 text-text-muted">
                Import league data from JSON or CSV into any of your leagues.
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-text-muted"
              aria-hidden
            />
          </Link>
          <Link
            href={accountBillingHref()}
            className="flex items-center justify-between gap-3 py-4"
            data-testid="account-billing-link"
          >
            <span className="min-w-0">
              <span className="block text-label-14 text-foreground">
                Billing
              </span>
              <span className="block text-caption-12 text-text-muted">
                Subscription plan, usage, and payment management.
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-text-muted"
              aria-hidden
            />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
