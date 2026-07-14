"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Relatórios", icon: "🔔" },
  { href: "/templates", label: "Templates", icon: "💬", adminOnly: true },
  { href: "/settings", label: "Configurações", icon: "⚙️", adminOnly: true },
  { href: "/usuarios", label: "Usuários", icon: "👥", adminOnly: true },
];

export default function AppShell({
  isAdmin,
  userName,
  children,
}: {
  isAdmin: boolean;
  userName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  const items = NAV.filter((i) => !i.adminOnly || isAdmin);

  return (
    <div className="flex min-h-screen">
      <aside
        className={`flex flex-col border-r border-slate-800 bg-slate-900 transition-all duration-200 ${
          open ? "w-56" : "w-14"
        }`}
      >
        <div className="flex items-center justify-between px-3 py-4">
          {open && <span className="text-sm font-semibold text-slate-100">Meta Payments</span>}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            title={open ? "Recolher menu" : "Expandir menu"}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            {open ? "«" : "»"}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2">
          {items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-3 rounded px-2 py-2 text-sm ${
                  active
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {open && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-2">
          {open && <p className="px-2 pb-1 text-xs text-slate-500">{userName}</p>}
          <form action={logout}>
            <button
              type="submit"
              title="Sair"
              className="flex w-full items-center gap-3 rounded px-2 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <span className="text-base">🚪</span>
              {open && <span>Sair</span>}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 overflow-x-auto">{children}</div>
    </div>
  );
}
