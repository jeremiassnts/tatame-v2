"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DollarSign, CreditCard, LogOut, Menu, X } from "lucide-react";
import { SignOutButton, useAuth } from "@clerk/nextjs";
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
    "loading" | "ok" | "no-account" | "pending-academy" | "not-manager"
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

        if (me.activeRole && me.activeRole !== "manager") {
          setUserStatus("not-manager");
        } else if (me.activeAcademy) {
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

  if (userStatus === "not-manager") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <Image src="/icon.png" alt="Tatame" width={48} height={48} />
        <h1 className="font-[family-name:var(--font-sora)] text-xl font-bold text-text-primary">
          Área exclusiva para gestores
        </h1>
        <p className="max-w-sm text-sm text-text-secondary">
          Este portal é destinado aos gestores de academia. Para acessar o
          Tatame como aluno ou instrutor, utilize o aplicativo.
        </p>
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
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="https://ios.apptatame.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[52px] items-center gap-3 rounded-xl border border-border bg-surface px-5 transition-colors hover:border-border-light hover:bg-white/5"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M14.05 2.9199C14.6696 2.1677 15.0942 1.1246 14.9738.0815c-.8938.0365-1.9889.5975-2.632 1.3497-.5762.668-1.0849 1.7392-.9482 2.7608.9956.076 2.0103-.5044 2.6564-1.2721zM16.267 11.5537c-.0215-2.2489 1.8375-3.3291 1.9215-3.3809-1.0468-1.5299-2.6742-1.7392-3.2553-1.7625-1.3858-.1411-2.7091.8177-3.4113.8177-.7022 0-1.7816-.7989-2.9319-.7773-1.5048.0215-2.8956.8713-3.673 2.2117C3.3824 11.302 4.4775 15.5082 6.0402 17.9008c.7666 1.1718 1.6808 2.4907 2.8819 2.4452 1.1579-.0455 1.5947-.7451 2.9968-.7451 1.4021 0 1.7944.7451 3.0183.7219 1.2454-.0216 2.031-1.1936 2.7892-2.3718.8882-1.3546 1.2501-2.678 1.267-2.7452-.0271-.0108-2.4198-.9275-2.6458-3.6521z" fill="white" />
            </svg>
            <div className="flex flex-col">
              <span className="text-[10px] text-text-secondary">Baixar na</span>
              <span className="text-sm font-semibold text-white">App Store</span>
            </div>
          </a>
          <a
            href="https://android.apptatame.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[52px] items-center gap-3 rounded-xl border border-border bg-surface px-5 transition-colors hover:border-border-light hover:bg-white/5"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2.114 1.114a1 1 0 011.372-.006l10.5 9.5a1 1 0 010 1.484l-10.5 9.5A1 1 0 012 20.5V1.5a1 1 0 01.114-.386z" fill="#EA4335" />
              <path d="M13.986 10.608L3.486 20.108 16.5 13.5l-2.514-2.892z" fill="#FBBC05" />
              <path d="M16.5 6.5L3.486.892l10.5 9.5L16.5 7.5v-1z" fill="#4285F4" />
              <path d="M16.5 6.5v7l-2.514-2.892-1.5-1.3 1.5-1.308L16.5 6.5z" fill="#34A853" />
            </svg>
            <div className="flex flex-col">
              <span className="text-[10px] text-text-secondary">Disponível no</span>
              <span className="text-sm font-semibold text-white">Google Play</span>
            </div>
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

      {/* Logout */}
      <div className="px-3 pt-4">
        <SignOutButton redirectUrl="/">
          <button className="flex h-[42px] w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary">
            <LogOut className="h-5 w-5 shrink-0" />
            Sair
          </button>
        </SignOutButton>
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
