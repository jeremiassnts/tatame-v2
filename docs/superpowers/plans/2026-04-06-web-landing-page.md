# Web Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static marketing landing page for Tatame at `apps/web/` with privacy/terms pages and a Dockerfile for Coolify deployment.

**Architecture:** Next.js 15 App Router with Tailwind CSS v4, all Server Components except FAQ accordion and scroll animation wrapper. Three routes: `/`, `/privacidade`, `/termos`. Standalone output for Docker.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, lucide-react, TypeScript 5.9

**Spec:** `docs/superpowers/specs/2026-04-06-web-landing-page-design.md`

---

### Task 1: Scaffold Next.js project and configure Tailwind

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/turbo.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`

- [x] **Step 1: Update `apps/web/package.json` with dependencies**

```json
{
  "name": "@tatame/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "lucide-react": "^0.460"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "tailwindcss": "^4",
    "typescript": "5.9.3",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19"
  }
}
```

- [x] **Step 2: Update `apps/web/turbo.json`**

```json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "outputs": [".next/**", "!.next/cache/**"]
    }
  }
}
```

- [x] **Step 3: Create `apps/web/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [x] **Step 4: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [x] **Step 5: Create `apps/web/postcss.config.mjs`**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [x] **Step 6: Create `apps/web/app/globals.css` with Tailwind + design tokens + animation**

```css
@import "tailwindcss";

@theme {
  --color-background: #0C0C0C;
  --color-surface: #1A1A1A;
  --color-border: #2A2A2A;
  --color-border-light: #3A3A3A;
  --color-primary: #A078E8;
  --color-primary-dark: #7C5CBF;
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #ABABAB;
  --color-text-muted: #525252;
  --color-success: #32D74B;
  --color-whatsapp: #25D366;

  --font-family-sora: "Sora", sans-serif;
  --font-family-inter: "Inter", sans-serif;
}

html {
  scroll-behavior: smooth;
}

body {
  background-color: var(--color-background);
  color: var(--color-text-primary);
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.6s ease-out forwards;
}

.animate-hidden {
  opacity: 0;
}
```

- [x] **Step 7: Create `apps/web/app/layout.tsx` — root layout with fonts and metadata**

```tsx
import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tatame — Sua academia na palma da mão",
  description:
    "Gerencie turmas, controle presenças, acompanhe graduações e pagamentos — tudo em um só lugar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${inter.variable}`}>
      <body className="font-[family-name:var(--font-inter)] antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [x] **Step 8: Create minimal `apps/web/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main>
      <h1 className="font-[family-name:var(--font-sora)] text-4xl text-text-primary p-20">
        Tatame Landing Page
      </h1>
    </main>
  );
}
```

- [x] **Step 9: Install dependencies and verify dev server starts**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm install
pnpm --filter @tatame/web dev
```

Open `http://localhost:3000` — verify "Tatame Landing Page" renders with correct font and white text on dark background. Stop the dev server.

- [x] **Step 10: Commit**

```bash
git add apps/web/
git commit -m "feat(web): scaffold Next.js 15 with Tailwind v4 and design tokens"
```

---

### Task 2: AnimateOnScroll client component

**Files:**
- Create: `apps/web/components/animate-on-scroll.tsx`

- [x] **Step 1: Create `apps/web/components/animate-on-scroll.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";

export function AnimateOnScroll({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.remove("animate-hidden");
          el.classList.add("animate-fade-in-up");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`animate-hidden ${className}`}>
      {children}
    </div>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/web/components/animate-on-scroll.tsx
git commit -m "feat(web): add AnimateOnScroll Intersection Observer wrapper"
```

---

### Task 3: Header component

**Files:**
- Create: `apps/web/components/header.tsx`

- [x] **Step 1: Create `apps/web/components/header.tsx`**

```tsx
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
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
```

- [x] **Step 2: Commit**

```bash
git add apps/web/components/header.tsx
git commit -m "feat(web): add Header with sticky nav and mobile hamburger menu"
```

---

### Task 4: Footer component

**Files:**
- Create: `apps/web/components/footer.tsx`

- [x] **Step 1: Create `apps/web/components/footer.tsx`**

```tsx
import { Grid3X3, Instagram, Twitter, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-surface px-6 py-10 md:px-20 md:py-[60px]">
      <div className="mx-auto max-w-[1440px]">
        {/* Top */}
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          {/* Brand */}
          <div className="flex max-w-[320px] flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-primary to-primary-dark">
                <Grid3X3 className="h-4 w-4 text-white" />
              </div>
              <span className="font-[family-name:var(--font-sora)] text-lg font-bold text-white">
                TATAME
              </span>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">
              A plataforma completa para gestão de academias de Jiu-Jitsu
              brasileiro.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-20">
            <div className="flex flex-col gap-4">
              <span className="text-[13px] font-bold text-white">Produto</span>
              <a href="/" className="text-[13px] text-text-secondary hover:text-white">
                Início
              </a>
              <a href="#recursos" className="text-[13px] text-text-secondary hover:text-white">
                Recursos
              </a>
              <a href="#precos" className="text-[13px] text-text-secondary hover:text-white">
                Preços
              </a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-[13px] font-bold text-white">Legal</span>
              <a href="/privacidade" className="text-[13px] text-text-secondary hover:text-white">
                Privacidade
              </a>
              <a href="/termos" className="text-[13px] text-text-secondary hover:text-white">
                Termos de uso
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-12 h-px w-full bg-border" />

        {/* Bottom */}
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-xs text-text-muted">
            © 2026 Tatame. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" aria-label="Instagram">
              <Instagram className="h-[18px] w-[18px] text-text-muted hover:text-white" />
            </a>
            <a href="#" aria-label="Twitter">
              <Twitter className="h-[18px] w-[18px] text-text-muted hover:text-white" />
            </a>
            <a href="#" aria-label="YouTube">
              <Youtube className="h-[18px] w-[18px] text-text-muted hover:text-white" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/web/components/footer.tsx
git commit -m "feat(web): add Footer with links and social icons"
```

---

### Task 5: Hero section

**Files:**
- Create: `apps/web/components/hero.tsx`
- Create: `apps/web/public/mockup-1.png`
- Create: `apps/web/public/mockup-2.png`
- Create: `apps/web/public/mockup-3.png`

- [x] **Step 1: Create placeholder images**

Generate three 280x560 placeholder PNG files. Use simple gray rectangles:

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/web
mkdir -p public
# Create minimal 1x1 placeholder PNGs (user will replace with real mockups)
convert -size 280x560 xc:'#1A1A1A' public/mockup-1.png
convert -size 280x560 xc:'#1A1A1A' public/mockup-2.png
convert -size 280x560 xc:'#1A1A1A' public/mockup-3.png
```

If `convert` (ImageMagick) is not available, create a simple SVG placeholder approach — or skip and use a CSS div as placeholder instead. The component below handles both cases.

- [x] **Step 2: Create `apps/web/components/hero.tsx`**

```tsx
import { Sparkles, ArrowRight } from "lucide-react";
import Image from "next/image";
import { AnimateOnScroll } from "./animate-on-scroll";

function MockupPlaceholder({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-[400px] w-[200px] overflow-hidden rounded-[32px] border border-border bg-surface shadow-[0_20px_60px_#A078E830] md:h-[560px] md:w-[280px]">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes="280px"
      />
    </div>
  );
}

export function Hero() {
  return (
    <section className="px-6 pb-[60px] pt-12 md:px-20 md:pb-[60px] md:pt-20">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-12">
        <AnimateOnScroll className="flex flex-col items-center gap-12 md:gap-12">
          {/* Badge */}
          <div className="flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.125] px-5 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-medium text-primary">
              Plataforma #1 para academias de Jiu-Jitsu
            </span>
          </div>

          {/* Headline */}
          <div className="flex max-w-[900px] flex-col items-center gap-6">
            <h1 className="max-w-[900px] text-center font-[family-name:var(--font-sora)] text-[40px] font-extrabold leading-[1.1] tracking-[-2px] text-white md:text-[64px]">
              Sua academia na palma da mão
            </h1>
            <p className="max-w-[700px] text-center text-base leading-relaxed text-text-secondary md:text-xl md:leading-relaxed">
              Gerencie turmas, controle presenças, acompanhe graduações e
              pagamentos — tudo em um só lugar. Simples para gestores,
              instrutores e alunos.
            </p>
          </div>

          {/* CTA */}
          <a
            href="#download"
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-b from-primary to-primary-dark px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
          >
            Começar gratuitamente
            <ArrowRight className="h-5 w-5" />
          </a>
        </AnimateOnScroll>

        {/* Mockups */}
        <AnimateOnScroll className="flex w-full items-center justify-center gap-6 md:gap-10">
          <MockupPlaceholder src="/mockup-1.png" alt="Tatame app - Home" />
          <div className="hidden md:block">
            <MockupPlaceholder src="/mockup-2.png" alt="Tatame app - Agenda" />
          </div>
          <MockupPlaceholder src="/mockup-3.png" alt="Tatame app - Financeiro" />
        </AnimateOnScroll>
      </div>
    </section>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add apps/web/components/hero.tsx apps/web/public/
git commit -m "feat(web): add Hero section with mockup placeholders"
```

---

### Task 6: Features section

**Files:**
- Create: `apps/web/components/features.tsx`

- [x] **Step 1: Create `apps/web/components/features.tsx`**

```tsx
import {
  Calendar,
  UserCheck,
  Award,
  CreditCard,
  Users,
  BarChart3,
  Rocket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

const features: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Calendar,
    title: "Agenda de aulas",
    description:
      "Monte sua grade semanal com turmas recorrentes, instrutores e controle de capacidade por aula.",
  },
  {
    icon: UserCheck,
    title: "Check-in inteligente",
    description:
      "Presenças com controle de capacidade, limite semanal e janela de horário automáticos.",
  },
  {
    icon: Award,
    title: "Graduações",
    description:
      "Registre faixas e graus de cada aluno com histórico completo de promoções e observações.",
  },
  {
    icon: CreditCard,
    title: "Pagamentos",
    description:
      "Controle de mensalidades, confirmação de pagamentos e histórico financeiro completo.",
  },
  {
    icon: Users,
    title: "Gestão de membros",
    description:
      "Aprovação de novos membros, perfis detalhados e controle de instrutores e alunos.",
  },
  {
    icon: BarChart3,
    title: "Relatórios",
    description:
      "Acompanhe frequência, receita e crescimento da academia com dashboards visuais.",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  description,
}: (typeof features)[number]) {
  return (
    <div className="flex flex-col gap-5 rounded-[20px] border border-border bg-surface p-8">
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-primary/[0.125]">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-[family-name:var(--font-sora)] text-xl font-bold text-white md:text-[22px]">
        {title}
      </h3>
      <p className="text-[15px] leading-relaxed text-text-secondary">
        {description}
      </p>
    </div>
  );
}

export function Features() {
  return (
    <section id="recursos" className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <AnimateOnScroll className="flex flex-col items-center gap-16">
          {/* Header */}
          <div className="flex max-w-[700px] flex-col items-center gap-4">
            <span className="rounded-full bg-primary/[0.125] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-primary">
              RECURSOS
            </span>
            <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[44px]">
              Tudo que sua academia precisa
            </h2>
            <p className="text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              Simplifique a gestão da sua academia com ferramentas pensadas para
              o dia a dia do Jiu-Jitsu.
            </p>
          </div>

          {/* Grid */}
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>

          {/* Coming soon badge */}
          <div className="flex items-center gap-2.5 rounded-full border border-border-light bg-surface px-6 py-3">
            <Rocket className="h-4 w-4 text-primary" />
            <span className="text-[13px] font-medium text-text-secondary">
              E tem muito mais a caminho — fique ligado!
            </span>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/web/components/features.tsx
git commit -m "feat(web): add Features section with 6 cards and coming soon badge"
```

---

### Task 7: Pricing section

**Files:**
- Create: `apps/web/components/pricing.tsx`

- [x] **Step 1: Create `apps/web/components/pricing.tsx`**

```tsx
import { Check } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

const freePlan = {
  name: "Gratuito",
  description: "Para academias começando no digital",
  price: "R$ 0",
  features: [
    "Até 30 alunos",
    "Agenda de aulas",
    "Check-in de alunos",
    "Controle de graduações",
  ],
  ctaLabel: "Começar grátis",
  highlighted: false,
};

const proPlan = {
  name: "Pro",
  description: "Para academias que querem crescer",
  price: "R$ 49",
  features: [
    "Alunos ilimitados",
    "Tudo do plano Gratuito",
    "Dashboard web completo",
    "Relatórios avançados",
    "Suporte prioritário",
  ],
  ctaLabel: "Assinar agora",
  highlighted: true,
};

function PricingCard({
  plan,
}: {
  plan: typeof freePlan;
}) {
  return (
    <div
      className={`flex flex-col gap-8 rounded-[20px] bg-background p-8 md:p-10 ${
        plan.highlighted
          ? "border-2 border-primary"
          : "border border-border"
      }`}
    >
      {plan.highlighted && (
        <span className="w-fit rounded-full bg-gradient-to-b from-primary to-primary-dark px-3 py-1 text-[10px] font-bold uppercase tracking-[1.5px] text-white">
          MAIS POPULAR
        </span>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="font-[family-name:var(--font-sora)] text-[22px] font-bold text-white">
          {plan.name}
        </h3>
        <p className="text-sm leading-normal text-text-secondary">
          {plan.description}
        </p>
      </div>

      <div className="flex items-end gap-1">
        <span className="font-[family-name:var(--font-sora)] text-5xl font-extrabold tracking-[-2px] text-white">
          {plan.price}
        </span>
        <span className="text-base text-text-muted">/mês</span>
      </div>

      <div className="h-px w-full bg-border" />

      <div className="flex flex-col gap-4">
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-center gap-3">
            <Check
              className={`h-[18px] w-[18px] ${
                plan.highlighted ? "text-primary" : "text-success"
              }`}
            />
            <span className="text-sm text-white">{feature}</span>
          </div>
        ))}
      </div>

      <a
        href="#download"
        className={`flex items-center justify-center rounded-xl py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 ${
          plan.highlighted
            ? "bg-gradient-to-b from-primary to-primary-dark"
            : "border border-border-light bg-[#242424]"
        }`}
      >
        {plan.ctaLabel}
      </a>
    </div>
  );
}

export function Pricing() {
  return (
    <section id="precos" className="bg-surface px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <AnimateOnScroll className="flex flex-col items-center gap-16">
          {/* Header */}
          <div className="flex max-w-[700px] flex-col items-center gap-4">
            <span className="rounded-full bg-primary/[0.125] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-primary">
              PREÇOS
            </span>
            <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[44px]">
              Simples e transparente
            </h2>
            <p className="text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              Comece gratuitamente. Evolua quando sua academia crescer.
            </p>
          </div>

          {/* Cards */}
          <div className="grid w-full max-w-[900px] grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <PricingCard plan={freePlan} />
            <PricingCard plan={proPlan} />
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/web/components/pricing.tsx
git commit -m "feat(web): add Pricing section with Free and Pro cards"
```

---

### Task 8: Final CTA section

**Files:**
- Create: `apps/web/components/final-cta.tsx`

- [x] **Step 1: Create `apps/web/components/final-cta.tsx`**

```tsx
import { Apple } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 0 1 0 1.38l-2.302 2.302L15.396 13l2.302-2.492zM5.864 3.458L16.8 9.79l-2.302 2.303-8.635-8.635z" />
    </svg>
  );
}

export function FinalCta() {
  return (
    <section id="download" className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <AnimateOnScroll>
          <div className="flex flex-col items-center gap-8 rounded-3xl border border-primary/20 bg-gradient-to-b from-[#1A1030] to-[#2D1B4E] px-6 py-12 md:gap-8 md:p-20">
            <h2 className="max-w-[700px] text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold leading-[1.2] tracking-[-1.5px] text-white md:text-[40px]">
              Pronto para transformar sua academia?
            </h2>
            <p className="max-w-[600px] text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              Comece gratuitamente e veja a diferença em poucos dias. Sem cartão
              de crédito.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href="#"
                className="flex items-center gap-3 rounded-xl bg-white px-7 py-3.5 text-background transition-opacity hover:opacity-90"
              >
                <Apple className="h-6 w-6" />
                <div className="flex flex-col">
                  <span className="text-[10px] leading-none">Baixar na</span>
                  <span className="text-sm font-semibold leading-tight">
                    App Store
                  </span>
                </div>
              </a>
              <a
                href="#"
                className="flex items-center gap-3 rounded-xl bg-white px-7 py-3.5 text-background transition-opacity hover:opacity-90"
              >
                <PlayStoreIcon className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="text-[10px] leading-none">Disponível no</span>
                  <span className="text-sm font-semibold leading-tight">
                    Google Play
                  </span>
                </div>
              </a>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/web/components/final-cta.tsx
git commit -m "feat(web): add Final CTA section with store buttons"
```

---

### Task 9: FAQ section

**Files:**
- Create: `apps/web/components/faq.tsx`

- [x] **Step 1: Create `apps/web/components/faq.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

const faqItems = [
  {
    question: "Como funciona o período gratuito?",
    answer:
      "Você pode usar todas as funcionalidades do Tatame por 14 dias sem compromisso. Não pedimos cartão de crédito — basta criar sua conta, cadastrar sua academia e começar a usar. Ao final do período, escolha o plano que melhor se encaixa.",
  },
  {
    question: "Quantos alunos posso cadastrar?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  },
  {
    question: "O app funciona no celular?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  },
  {
    question: "Posso migrar dados de outro sistema?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  },
  {
    question: "Como funciona o suporte?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  },
  {
    question: "Preciso de conhecimento técnico para usar?",
    answer:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  },
];

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <div className="h-px w-full bg-border" />
      <div className="py-6">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-base font-semibold text-white md:text-lg">
            {question}
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
              isOpen ? "rotate-180 text-primary" : "text-text-muted"
            }`}
          />
        </button>
        <div
          className={`grid transition-all duration-300 ease-out ${
            isOpen ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <p className="text-base leading-[1.7] text-text-secondary">
              {answer}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <AnimateOnScroll className="flex flex-col items-center gap-16">
          {/* Header */}
          <div className="flex max-w-[700px] flex-col items-center gap-4">
            <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[40px]">
              Perguntas frequentes
            </h2>
            <p className="text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              Tire suas dúvidas sobre o Tatame e como ele pode ajudar sua
              academia.
            </p>
          </div>

          {/* FAQ List */}
          <div className="w-full max-w-[800px]">
            {faqItems.map((item, index) => (
              <FaqItem
                key={item.question}
                question={item.question}
                answer={item.answer}
                isOpen={openIndex === index}
                onToggle={() =>
                  setOpenIndex(openIndex === index ? -1 : index)
                }
              />
            ))}
            <div className="h-px w-full bg-border" />
          </div>

          {/* WhatsApp CTA */}
          <div className="flex flex-col items-center gap-5">
            <p className="text-base text-text-secondary">
              Ainda tem dúvidas?
            </p>
            <a
              href="https://wa.me/5579988566945?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20app%20Tatame"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-[14px] bg-whatsapp px-7 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              <MessageCircle className="h-5 w-5" />
              Fale conosco pelo WhatsApp
            </a>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/web/components/faq.tsx
git commit -m "feat(web): add FAQ accordion with WhatsApp CTA"
```

---

### Task 10: Assemble landing page and add Header/Footer to layout

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/page.tsx`

- [x] **Step 1: Update `apps/web/app/layout.tsx` to include Header and Footer**

```tsx
import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tatame — Sua academia na palma da mão",
  description:
    "Gerencie turmas, controle presenças, acompanhe graduações e pagamentos — tudo em um só lugar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${inter.variable}`}>
      <body className="font-[family-name:var(--font-inter)] antialiased">
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
```

- [x] **Step 2: Update `apps/web/app/page.tsx` to assemble all sections**

```tsx
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { Pricing } from "@/components/pricing";
import { FinalCta } from "@/components/final-cta";
import { Faq } from "@/components/faq";

export default function Home() {
  return (
    <main>
      <Hero />
      <Features />
      <Pricing />
      <FinalCta />
      <Faq />
    </main>
  );
}
```

- [x] **Step 3: Run dev server and verify all sections render**

```bash
pnpm --filter @tatame/web dev
```

Open `http://localhost:3000` — verify: sticky header, hero with badge/headline/CTA/mockup placeholders, features grid (6 cards), pricing (2 cards), final CTA with store buttons, FAQ accordion (first item open), WhatsApp button, footer with links. Scroll animations trigger on each section. Mobile view shows hamburger menu, single-column layouts, stacked pricing cards.

- [x] **Step 4: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/app/page.tsx
git commit -m "feat(web): assemble landing page with all sections"
```

---

### Task 11: Privacy policy page

**Files:**
- Create: `apps/web/app/privacidade/page.tsx`

- [x] **Step 1: Create `apps/web/app/privacidade/page.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — Tatame",
  description: "Política de Privacidade da plataforma Tatame.",
};

const sections = [
  {
    title: "1. Informações que coletamos",
    content:
      "Coletamos informações que você fornece diretamente ao criar sua conta e utilizar o Tatame, incluindo: nome, e-mail, telefone, dados da academia, informações de alunos (nome, faixa, dados de contato) e dados de pagamento. Também coletamos automaticamente informações de uso, como páginas acessadas, horários de acesso e tipo de dispositivo.",
  },
  {
    title: "2. Como usamos suas informações",
    content:
      "Utilizamos suas informações para: operar e manter a plataforma, processar pagamentos e assinaturas, enviar notificações relacionadas ao serviço, melhorar a experiência do usuário com base em padrões de uso, fornecer suporte ao cliente e garantir a segurança da plataforma.",
  },
  {
    title: "3. Compartilhamento de dados",
    content:
      "Não vendemos ou alugamos suas informações pessoais a terceiros. Podemos compartilhar dados com provedores de serviço que auxiliam na operação da plataforma, quando exigido por lei ou ordem judicial, e em caso de fusão, aquisição ou venda de ativos, com aviso prévio.",
  },
  {
    title: "4. Armazenamento e segurança",
    content:
      "Seus dados são armazenados em servidores seguros com criptografia em trânsito e em repouso. Implementamos medidas técnicas e organizacionais para proteger suas informações contra acesso não autorizado, alteração, divulgação ou destruição. Realizamos backups regulares e monitoramento contínuo da infraestrutura.",
  },
  {
    title: "5. Seus direitos",
    content:
      "De acordo com a LGPD, você tem direito a: acessar seus dados pessoais, corrigir dados incompletos ou desatualizados, solicitar a exclusão dos seus dados, revogar o consentimento a qualquer momento e solicitar a portabilidade dos dados. Para exercer esses direitos, entre em contato pelo e-mail privacidade@tatame.app.",
  },
  {
    title: "6. Cookies e rastreamento",
    content:
      "Utilizamos cookies essenciais para o funcionamento da plataforma e cookies analíticos para entender como você utiliza o serviço. Você pode gerenciar suas preferências de cookies a qualquer momento nas configurações do navegador. Não utilizamos cookies para publicidade direcionada.",
  },
  {
    title: "7. Contato",
    content:
      "Para dúvidas sobre esta política ou sobre o tratamento dos seus dados, entre em contato conosco pelo e-mail privacidade@tatame.app ou pelo nosso canal de suporte dentro da plataforma.",
  },
];

export default function Privacidade() {
  return (
    <main className="px-6 py-16 md:px-20 md:py-20">
      <div className="mx-auto max-w-[800px]">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[40px]">
            Política de Privacidade
          </h1>
          <p className="text-sm text-text-muted">
            Última atualização: 01 de abril de 2026
          </p>
        </div>

        {/* Divider */}
        <div className="my-12 h-px w-full bg-border" />

        {/* Sections */}
        <div className="flex flex-col gap-12">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-3">
              <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold text-white md:text-[22px]">
                {section.title}
              </h2>
              <p className="text-base leading-[1.8] text-text-secondary">
                {section.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [x] **Step 2: Verify page renders at `http://localhost:3000/privacidade`**

- [x] **Step 3: Commit**

```bash
git add apps/web/app/privacidade/
git commit -m "feat(web): add Privacy Policy page"
```

---

### Task 12: Terms of use page

**Files:**
- Create: `apps/web/app/termos/page.tsx`

- [x] **Step 1: Create `apps/web/app/termos/page.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso — Tatame",
  description: "Termos de Uso da plataforma Tatame.",
};

const sections = [
  {
    title: "1. Aceitação dos termos",
    content:
      "Ao acessar e utilizar a plataforma Tatame, você concorda com estes Termos de Uso e com nossa Política de Privacidade. Se você não concordar com qualquer parte destes termos, não utilize o serviço. O uso continuado da plataforma constitui aceitação de quaisquer alterações feitas a estes termos.",
  },
  {
    title: "2. Descrição do serviço",
    content:
      "O Tatame é uma plataforma de gestão para academias de artes marciais que oferece ferramentas de controle de alunos, agenda de aulas, check-in de presença, gestão financeira e graduações. O serviço é oferecido através de aplicativo móvel e painel web, mediante assinatura mensal ou anual.",
  },
  {
    title: "3. Cadastro e conta",
    content:
      "Para utilizar o Tatame, você deve criar uma conta fornecendo informações verdadeiras e completas. Você é responsável por manter a confidencialidade das suas credenciais de acesso e por todas as atividades realizadas sob sua conta. Notifique-nos imediatamente caso suspeite de uso não autorizado.",
  },
  {
    title: "4. Planos e pagamentos",
    content:
      "Os preços dos planos estão disponíveis em nosso site e podem ser alterados com aviso prévio de 30 dias. A cobrança é recorrente conforme o ciclo escolhido (mensal ou anual). O cancelamento pode ser feito a qualquer momento, mantendo o acesso até o final do período já pago. Não realizamos reembolsos proporcionais.",
  },
  {
    title: "5. Uso aceitável",
    content:
      "Você concorda em utilizar o Tatame apenas para fins legítimos relacionados à gestão da sua academia. É proibido: utilizar o serviço para atividades ilegais, tentar acessar dados de outros usuários, realizar engenharia reversa da plataforma, transmitir vírus ou código malicioso, e revender ou sublicenciar o acesso ao serviço.",
  },
  {
    title: "6. Propriedade intelectual",
    content:
      "Todo o conteúdo da plataforma Tatame, incluindo design, código, marcas e textos, é de propriedade exclusiva do Tatame ou de seus licenciadores. Os dados inseridos por você na plataforma permanecem de sua propriedade. Concedemos a você uma licença limitada, não exclusiva e revogável para uso da plataforma conforme estes termos.",
  },
  {
    title: "7. Limitação de responsabilidade",
    content:
      "O Tatame é fornecido \"como está\". Não garantimos que o serviço será ininterrupto ou livre de erros. Em nenhuma hipótese seremos responsáveis por danos indiretos, incidentais ou consequenciais decorrentes do uso da plataforma. Nossa responsabilidade total está limitada ao valor pago por você nos últimos 12 meses.",
  },
  {
    title: "8. Contato",
    content:
      "Para dúvidas sobre estes termos, entre em contato pelo e-mail contato@tatame.app ou pelo nosso canal de suporte dentro da plataforma.",
  },
];

export default function Termos() {
  return (
    <main className="px-6 py-16 md:px-20 md:py-20">
      <div className="mx-auto max-w-[800px]">
        {/* Header */}
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[40px]">
            Termos de Uso
          </h1>
          <p className="text-sm text-text-muted">
            Última atualização: 01 de abril de 2026
          </p>
        </div>

        {/* Divider */}
        <div className="my-12 h-px w-full bg-border" />

        {/* Sections */}
        <div className="flex flex-col gap-12">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-3">
              <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold text-white md:text-[22px]">
                {section.title}
              </h2>
              <p className="text-base leading-[1.8] text-text-secondary">
                {section.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [x] **Step 2: Verify page renders at `http://localhost:3000/termos`**

- [x] **Step 3: Commit**

```bash
git add apps/web/app/termos/
git commit -m "feat(web): add Terms of Use page"
```

---

### Task 13: Dockerfile and .dockerignore

**Files:**
- Create: `Dockerfile.web`
- Create: `apps/web/.dockerignore`

- [x] **Step 1: Create `Dockerfile.web` at the monorepo root (same pattern as `Dockerfile.api`)**

```dockerfile
# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy dependency manifests only (for layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ patches/
COPY apps/web/package.json apps/web/

# PaaS (e.g. Coolify) often sets NODE_ENV=production for prod deploys.
# That makes pnpm skip devDependencies — but they are required to build.
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ──
FROM deps AS build

# Copy source code
COPY apps/web/ apps/web/
COPY turbo.json ./

# Build the web app
RUN pnpm turbo build --filter=@tatame/web

# ── Stage 3: Production ──
FROM node:20-alpine AS production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy standalone output
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

USER appuser

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
```

- [x] **Step 2: Create `apps/web/.dockerignore`**

```
node_modules
.next
.git
*.md
```

- [x] **Step 3: Run a production build to verify standalone output works**

```bash
pnpm --filter @tatame/web build
ls apps/web/.next/standalone/
```

Expected: `apps/` directory, `node_modules/`, `package.json` in standalone output.

- [x] **Step 4: Commit**

```bash
git add Dockerfile.web apps/web/.dockerignore
git commit -m "feat(web): add Dockerfile for Coolify deployment"
```

---

### Task 14: Final verification

- [x] **Step 1: Run full build from monorepo root**

```bash
pnpm build
```

Expected: all packages and apps build successfully.

- [x] **Step 2: Start production server and verify all routes**

```bash
cd apps/web
node .next/standalone/apps/web/server.js
```

Open `http://localhost:3000` — verify landing page.
Open `http://localhost:3000/privacidade` — verify privacy policy.
Open `http://localhost:3000/termos` — verify terms of use.

- [x] **Step 3: Test Docker build (optional, if Docker is available)**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
docker build -f Dockerfile.web -t tatame-web .
docker run -p 3000:3000 tatame-web
```

- [x] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(web): final adjustments from verification"
```
