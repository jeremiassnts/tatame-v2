"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { TrackedLink } from "../tracked-link";

const navLinks = [
  { label: "Recursos", href: "#recursos" },
  { label: "Preços", href: "#precos" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Dúvidas", href: "#duvidas" },
];

export function HeaderV2() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 md:px-20">
        {/* Logo */}
        <a href="/v2" className="flex items-center gap-3">
          <Image src="/icon.png" alt="Tatame" width={25} height={25} />
          <span className="font-[family-name:var(--font-sora)] text-[22px] font-bold tracking-tight text-white">
            TATAME
          </span>
        </a>

        {/* Desktop nav — centered */}
        <nav className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[15px] font-medium text-text-secondary transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <TrackedLink
          href="#precos"
          eventName="cta_header_click"
          className="hidden rounded-xl bg-gradient-to-b from-primary to-primary-dark px-6 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 md:block"
        >
          Começar grátis
        </TrackedLink>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-white md:hidden"
          aria-label="Menu"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-border bg-background px-6 pb-6 pt-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-[15px] font-medium text-text-secondary"
              >
                {link.label}
              </a>
            ))}
            <TrackedLink
              href="#precos"
              eventName="cta_header_click"
              onClick={() => setMenuOpen(false)}
              className="mt-2 flex items-center justify-center rounded-xl bg-gradient-to-b from-primary to-primary-dark px-6 py-3 text-[15px] font-semibold text-white"
            >
              Começar grátis
            </TrackedLink>
          </nav>
        </div>
      )}
    </header>
  );
}
