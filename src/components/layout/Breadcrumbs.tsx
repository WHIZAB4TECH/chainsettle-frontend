"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Breadcrumb {
  label: string;
  href?: string;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "dashboard" || segments.length < 2) return null;

  const breadcrumbs: Breadcrumb[] = [
    { label: "Dashboard", href: "/dashboard/shipments" },
  ];

  if (segments[1] === "shipments") {
    breadcrumbs.push({ label: "Shipments", href: "/dashboard/shipments" });

    if (segments[2] === "create") {
      breadcrumbs.push({ label: "New shipment" });
    } else if (segments[2] && segments[2] !== "print") {
      breadcrumbs.push({
        label: segments[2],
        href:
          segments[3] === "print"
            ? `/dashboard/shipments/${segments[2]}`
            : undefined,
      });

      if (segments[3] === "print") breadcrumbs.push({ label: "Print view" });
    }
  } else if (segments[1] === "notifications") {
    breadcrumbs.push({ label: "Notifications" });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="no-print mb-5 min-w-0 overflow-hidden"
    >
      <ol className="flex min-w-0 items-center gap-1 text-xs text-gray-400">
        {breadcrumbs.map((breadcrumb, index) => (
          <li
            key={`${breadcrumb.label}-${index}`}
            className="flex min-w-0 items-center gap-1"
          >
            {index > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 flex-shrink-0 text-gray-300"
                aria-hidden="true"
              />
            )}
            {breadcrumb.href ? (
              <Link
                href={breadcrumb.href}
                className="max-w-[8rem] truncate hover:text-gray-700 sm:max-w-none"
              >
                {breadcrumb.label}
              </Link>
            ) : (
              <span
                className="max-w-[10rem] truncate font-medium text-gray-700 sm:max-w-none"
                aria-current="page"
              >
                {breadcrumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
