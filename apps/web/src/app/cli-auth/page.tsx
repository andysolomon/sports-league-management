import { APIKeys } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CliAuthPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/cli-auth");
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">CLI Authentication</h1>
      <p className="mb-6 text-muted-foreground">
        Generate an API key to use with the sprtsmng TUI. The secret is shown
        exactly once when you create a key &mdash; copy it immediately, it
        cannot be retrieved later. Revoke a key at any time to log out a
        machine.
      </p>
      <APIKeys showDescription />
    </main>
  );
}
