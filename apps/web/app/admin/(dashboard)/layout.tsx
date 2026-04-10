"use client";

import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, LogOut } from "lucide-react";
import { clearAdminToken } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  function handleLogout() {
    clearAdminToken();
    router.replace("/admin/login");
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-[260px] flex-col border-r border-border bg-surface py-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-border px-6 pb-5">
          <Image src="/icon.png" alt="Tatame" width={36} height={36} />
          <span className="font-[family-name:var(--font-sora)] text-base font-bold tracking-[1px] text-text-primary">
            TATAME
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-0.5 px-3 pt-4">
          <Link
            href="/admin"
            className="flex h-[42px] items-center gap-2.5 rounded-[10px] bg-primary/[0.125] px-3 text-sm font-medium text-primary"
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </Link>
        </nav>

        {/* Logout */}
        <div className="px-3">
          <button
            onClick={handleLogout}
            className="flex h-[42px] w-full items-center gap-2.5 rounded-[10px] px-3 text-sm text-text-secondary hover:bg-white/5"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
