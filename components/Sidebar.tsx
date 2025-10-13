"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/policies", label: "Policies" },
  { href: "/customers", label: "Customers" },
  { href: "/devices", label: "Devices" },
  { href: "/settings", label: "Settings" }
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 border-r border-white/10 bg-black/30 backdrop-blur sticky top-0 h-screen">
      <div className="px-5 py-4 border-b border-white/10">
        <div className="text-lg font-semibold tracking-tight">Yggdrasil</div>
        <div className="text-xs text-white/60">Linux Policy Platform</div>
      </div>
      <nav className="p-3 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg transition ${
                active ? "bg-white/15 ring-1 ring-white/20" : "hover:bg-white/5"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
