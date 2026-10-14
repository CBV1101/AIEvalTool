"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const items = [
    { href: `/projects/${projectId}/setup`, label: "Test setup" },
    { href: `/projects/${projectId}/compare`, label: "Version comparison" },
    { href: `/projects/${projectId}/failures`, label: "Failure review" },
  ];

  return (
    <nav className="sidenav" aria-label="Project">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
