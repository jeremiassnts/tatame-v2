"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DollarSign, CreditCard, Menu, X } from "lucide-react";
import { SignOutButton, UserButton, useAuth } from "@clerk/nextjs";
import { managerFetch } from "@/lib/manager-api";

const navItems = [
  { label: "Financeiro", href: "/conta", icon: DollarSign },
  { label: "Assinatura", href: "/conta/assinatura", icon: CreditCard },
];

export default function ManagerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { getToken } = useAuth();
  const [userStatus, setUserStatus] = useState<
    "loading" | "ok" | "no-account" | "pending-academy"
  >("loading");

  useEffect(() => {
    async function checkUser() {
      try {
        const token = await getToken();
        const me = await managerFetch<{
          activeRole: string | null;
          activeAcademy: { id: string } | null;
          hasPendingSubscription?: boolean;
        }>("/users/me", token);

        if (me.activeAcademy) {
          setUserStatus("ok");
        } else if (me.hasPendingSubscription) {
          setUserStatus("pending-academy");
        } else {
          setUserStatus("no-account");
        }
      } catch {
        setUserStatus("no-account");
      }
    }
    checkUser();
  }, [getToken]);

  if (userStatus === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (userStatus === "no-account") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <Image src="/icon.png" alt="Tatame" width={48} height={48} />
        <h1 className="font-[family-name:var(--font-sora)] text-xl font-bold text-text-primary">
          Cadastro incompleto
        </h1>
        <p className="max-w-sm text-sm text-text-secondary">
          Para acessar o painel de gestão, você precisa completar seu cadastro
          primeiro.
        </p>
        <a
          href="/cadastro"
          className="rounded-xl bg-gradient-to-b from-primary to-primary-dark px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Completar cadastro
        </a>
        <SignOutButton redirectUrl="/">
          <button className="cursor-pointer text-sm text-text-muted hover:text-text-secondary transition-colors">
            Sair
          </button>
        </SignOutButton>
      </div>
    );
  }

  if (userStatus === "pending-academy") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <Image src="/icon.png" alt="Tatame" width={48} height={48} />
        <div className="flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-1.5">
          <div className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-sm font-medium text-green-400">Assinatura ativa</span>
        </div>
        <h1 className="font-[family-name:var(--font-sora)] text-xl font-bold text-text-primary">
          Falta pouco!
        </h1>
        <p className="max-w-sm text-sm text-text-secondary">
          Sua assinatura está confirmada. Agora baixe o app, faça login com a
          mesma conta e cadastre sua academia para começar a usar.
        </p>
        <div className="flex flex-col gap-2 text-left text-sm text-text-secondary">
          <p><span className="font-semibold text-text-primary">1.</span> Baixe o app na App Store ou Google Play</p>
          <p><span className="font-semibold text-text-primary">2.</span> Faça login com a conta que você criou</p>
          <p><span className="font-semibold text-text-primary">3.</span> Cadastre sua academia e comece a usar</p>
        </div>
        <div className="flex gap-3">
          <a
            href="https://ios.apptatame.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-white/5 transition-colors"
          >
            App Store
          </a>
          <a
            href="https://android.apptatame.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-white/5 transition-colors"
          >
            Google Play
          </a>
        </div>
        <SignOutButton redirectUrl="/">
          <button className="cursor-pointer text-sm text-text-muted hover:text-text-secondary transition-colors">
            Sair
          </button>
        </SignOutButton>
      </div>
    );
  }

  function isActive(href: string) {
    if (href === "/conta") {
      return pathname === "/conta";
    }
    return pathname.startsWith(href);
  }

  const Sidebar = () => (
    <aside className="flex h-full w-[260px] flex-col border-r border-border bg-surface py-6">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-border px-6 pb-5">
        <Image src="/icon.png" alt="Tatame" width={36} height={36} />
        <span className="font-[family-name:var(--font-sora)] text-base font-bold tracking-[1px] text-text-primary">
          TATAME
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 pt-4">
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setSidebarOpen(false)}
            className={`flex h-[42px] items-center gap-2.5 rounded-[10px] px-3 text-sm font-medium transition-colors ${
              isActive(href)
                ? "bg-primary/[0.125] text-primary"
                : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="flex items-center gap-3 px-6 pt-4">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
        <span className="text-sm text-text-secondary">Minha conta</span>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:h-full md:flex-col">
        <Sidebar />
      </div>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar (slide-in) */}
      <div
        className={`fixed inset-y-0 left-0 z-30 transition-transform duration-200 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-4 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="text-text-secondary hover:text-text-primary"
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Image src="/icon.png" alt="Tatame" width={28} height={28} />
          <span className="font-[family-name:var(--font-sora)] text-sm font-bold tracking-[1px] text-text-primary">
            TATAME
          </span>
          {sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="ml-auto text-text-secondary hover:text-text-primary"
              aria-label="Fechar menu"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
