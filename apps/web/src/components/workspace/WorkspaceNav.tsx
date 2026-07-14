import Link from "next/link";

export type WorkspaceNavLink = {
  label: string;
  href: string;
};

/**
 * Secondary inline navigation row for workspace pages (WSM-000236).
 * Accent text links with a trailing arrow — not tabs or segmented controls.
 */
export function WorkspaceNav({ links }: { links: WorkspaceNavLink[] }) {
  if (links.length === 0) return null;

  return (
    <nav aria-label="Workspace" className="mt-3 flex flex-wrap gap-4">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-sm text-accent hover:underline"
        >
          {link.label} <span aria-hidden>&rarr;</span>
        </Link>
      ))}
    </nav>
  );
}
