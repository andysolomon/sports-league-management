import Image from "next/image";

const screenshots = [
  {
    src: "/screenshots/dashboard-leagues.png",
    width: 1079,
    height: 689,
    label: "Leagues view",
    caption: "See every league at a glance",
    alt: "Leagues list view in the sprtsmng dashboard showing two leagues",
  },
  {
    src: "/screenshots/dashboard-team-detail.png",
    width: 1514,
    height: 695,
    label: "Team detail",
    caption: "Drill into a team to find a player in two clicks",
    alt: "Team detail page showing the Dallas Cowboys roster with players, positions, and statuses",
  },
  {
    src: "/screenshots/dashboard-players.png",
    width: 1677,
    height: 763,
    label: "Players grid",
    caption: "Manage your full roster from one screen",
    alt: "Players grid view showing the full roster with names, positions, jersey numbers, and statuses",
  },
];

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
            <figure key={shot.src} className="flex flex-col">
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 shadow-sm">
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  width={shot.width}
                  height={shot.height}
                  className="h-auto w-full"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
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
