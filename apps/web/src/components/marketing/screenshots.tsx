/**
 * Screenshots section for the marketing landing page.
 *
 * NOTE: This currently renders placeholder boxes labeled with the dashboard
 * view name. Real screenshots should be added at:
 *   - apps/web/public/screenshots/dashboard-leagues.png
 *   - apps/web/public/screenshots/dashboard-team-detail.png
 *   - apps/web/public/screenshots/dashboard-players.png
 *
 * Once those files exist, replace the <Placeholder /> JSX with <Image />
 * components from next/image (already imported below for forward-compat).
 */

const screenshots = [
  {
    label: "Leagues view",
    caption: "See every league at a glance",
    file: "dashboard-leagues.png",
  },
  {
    label: "Team detail",
    caption: "Drill into a team to find a player in two clicks",
    file: "dashboard-team-detail.png",
  },
  {
    label: "Players grid",
    caption: "Manage your full roster from one screen",
    file: "dashboard-players.png",
  },
];

function Placeholder({ label }: { label: string }) {
  return (
    <div
      className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm font-medium text-zinc-400"
      aria-label={`${label} screenshot placeholder`}
    >
      [{label}]
    </div>
  );
}

export function Screenshots() {
  return (
    <section className="border-t border-zinc-100 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            See it in action
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Built for the way you actually coach
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Three clicks from sign-in to the player you&apos;re looking for.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3">
          {screenshots.map((shot) => (
            <figure key={shot.file} className="flex flex-col">
              <Placeholder label={shot.label} />
              <figcaption className="mt-3 text-center text-sm text-zinc-600">
                {shot.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
