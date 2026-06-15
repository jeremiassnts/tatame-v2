"use client";

import React, { useRef, useState } from "react";
import { motion } from "motion/react";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { TrackedLink } from "../tracked-link";

const navLinks = [
  { label: "Recursos", href: "#recursos" },
  { label: "Preços", href: "#precos" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Dúvidas", href: "#duvidas" },
];

function NavPill() {
  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  return (
    <ul
      className="relative mx-auto hidden w-fit rounded-full border border-border-light/50 bg-white/10 p-1 md:flex"
      onMouseLeave={() => setPosition((pv) => ({ ...pv, opacity: 0 }))}
    >
      {navLinks.map((link) => (
        <Tab key={link.href} setPosition={setPosition} href={link.href}>
          {link.label}
        </Tab>
      ))}
      <Cursor position={position} />
    </ul>
  );
}

function Tab({
  children,
  setPosition,
  href,
}: {
  children: React.ReactNode;
  setPosition: React.Dispatch<
    React.SetStateAction<{ left: number; width: number; opacity: number }>
  >;
  href: string;
}) {
  const ref = useRef<HTMLLIElement>(null);
  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({
          width,
          opacity: 1,
          left: ref.current.offsetLeft,
        });
      }}
      className="relative z-10 block cursor-pointer"
    >
      <a
        href={href}
        className="block px-4 py-2 text-[14px] font-medium text-white mix-blend-difference"
      >
        {children}
      </a>
    </li>
  );
}

function Cursor({
  position,
}: {
  position: { left: number; width: number; opacity: number };
}) {
  return (
    <motion.li
      animate={position}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className="absolute z-0 h-[36px] rounded-full bg-primary"
    />
  );
}

export function HeaderV2() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-surface/60 backdrop-blur-lg border-b border-border-light/30">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 md:px-20">
        {/* Logo */}
        <a href="/v2" className="flex items-center gap-3">
          <Image src="/icon.png" alt="Tatame" width={25} height={25} />
          <span className="font-[family-name:var(--font-sora)] text-[22px] font-bold tracking-tight text-white">
            TATAME
          </span>
        </a>

        {/* Desktop nav — pill with sliding cursor */}
        <NavPill />

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
