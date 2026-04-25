"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { KanbanSquare, SearchCode } from "lucide-react";

const LINKS = [
  {
    href: "/jobs/hunt",
    label: "Midnight Hunt",
    icon: SearchCode,
  },
  {
    href: "/jobs/kanban",
    label: "Kanban",
    icon: KanbanSquare,
  },
];

export default function JobsNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {LINKS.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href;
        return (
          <Link key={link.href} href={link.href}>
            <Button variant={isActive ? "default" : "outline"} className="gap-2">
              <Icon className="h-4 w-4" />
              {link.label}
            </Button>
          </Link>
        );
      })}
    </div>
  );
}
