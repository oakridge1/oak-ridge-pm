"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, ClipboardList } from "lucide-react";

const TABS = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/saved-tasks", label: "Saved Tasks", icon: ClipboardList },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto -mx-4 px-4">
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              isActive
                ? "border-[#1e3a8a] text-[#1e3a8a]"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
