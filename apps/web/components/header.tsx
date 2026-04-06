"use client";

import { useState } from "react";
import { Grid3X3, Download, Menu, X } from "lucide-react";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 md:px-20">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-b from-primary to-primary-dark">
            <Grid3X3 className="h-[22px] w-[22px] text-white" />
          </div>
          <span className="font-[family-name:var(--font-sora)] text-[22px] font-bold tracking-tight text-white">
            TATAME
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-10 md:flex">
          <a
            href="#recursos"
            className="text-[15px] font-medium text-text-secondary transition-colors hover:text-white"
          >
            Recursos
          </a>
          <a
            href="#precos"
            className="text-[15px] font-medium text-text-secondary transition-colors hover:text-white"
          >
            Preços
          </a>
        </nav>

        {/* Desktop CTA */}
        <a
          href="#download"
          className="hidden items-center gap-2 rounded-[10px] bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 md:flex"
        >
          Baixar App
          <Download className="h-4 w-4" />
        </a>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-white md:hidden"
          aria-label="Menu"
        >
          {menuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-border bg-background px-6 pb-6 pt-4 md:hidden">
          <nav className="flex flex-col gap-4">
            <a
              href="#recursos"
              onClick={() => setMenuOpen(false)}
              className="text-[15px] font-medium text-text-secondary"
            >
              Recursos
            </a>
            <a
              href="#precos"
              onClick={() => setMenuOpen(false)}
              className="text-[15px] font-medium text-text-secondary"
            >
              Preços
            </a>
            <a
              href="#download"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center gap-2 rounded-[10px] bg-primary px-6 py-3 text-sm font-semibold text-white"
            >
              Baixar App
              <Download className="h-4 w-4" />
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
