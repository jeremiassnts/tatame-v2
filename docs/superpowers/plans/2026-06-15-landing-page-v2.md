# Landing Page V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium V2 landing page at `/v2` with 11 sections, new copy, and mockup placeholders — without touching the existing V1 at `/`.

**Architecture:** All V2 components live in `apps/web/components/v2/` to fully isolate from V1. The page is composed at `apps/web/app/(site)/v2/page.tsx`. Existing shared utilities (`TrackedLink`, `json-ld`, `gtag`) are reused. Copy is proposed inline using the copywriting skill knowledge.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4 (custom properties from `globals.css`), Lucide icons, existing GA4 tracking.

**Spec:** `docs/superpowers/specs/2026-06-15-landing-page-v2-design.md`

---

## File Structure

```
apps/web/app/(site)/v2/
  page.tsx                — V2 page composing all sections + SEO metadata

apps/web/components/v2/
  header-v2.tsx           — Sticky header: logo left, nav center, CTA right
  hero-v2.tsx             — Split hero: text left, phone mockup right
  social-proof.tsx        — Academy logos/names bar
  features-v2.tsx         — Two alternating blocks (image + 4 features each)
  advantages.tsx          — 2x2 card grid with image placeholders
  how-to-start.tsx        — 3-step horizontal flow
  banner-cta.tsx          — Full-width impact CTA banner
  pricing-v2.tsx          — Single plan card, future-ready for annual toggle
  faq-v2.tsx              — Accordion FAQ with WhatsApp CTA
  final-cta-v2.tsx        — Gradient purple CTA section
  footer-v2.tsx           — Footer matching V2 design line
```

---

### Task 1: Header V2

**Files:**
- Create: `apps/web/components/v2/header-v2.tsx`

- [ ] **Step 1: Create the header component**

```tsx
"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { TrackedLink } from "../tracked-link";

const navLinks = [
  { label: "Recursos", href: "#recursos" },
  { label: "Precos", href: "#precos" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Duvidas", href: "#duvidas" },
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
          Comecar gratis
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
              Comecar gratis
            </TrackedLink>
          </nav>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo typecheck --filter=@tatame/web`
Expected: Success, no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/v2/header-v2.tsx
git commit -m "feat(web): add header-v2 component for landing page v2"
```

---

### Task 2: Hero V2

**Files:**
- Create: `apps/web/components/v2/hero-v2.tsx`

**Note:** The hand-with-phone mockup image needs to be copied to `apps/web/public/`. The user's image is at `/Users/jeremiassantos/Downloads/Gemini_Generated_Image_8hzkgn8hzkgn8hzk.png`. Copy it as `hero-mockup-v2.png`.

- [ ] **Step 1: Copy the hero mockup image to public/**

```bash
cp "/Users/jeremiassantos/Downloads/Gemini_Generated_Image_8hzkgn8hzkgn8hzk.png" apps/web/public/hero-mockup-v2.png
```

- [ ] **Step 2: Create the hero component**

```tsx
import { ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import { TrackedLink } from "../tracked-link";

export function HeroV2() {
  return (
    <section className="relative overflow-hidden px-6 pb-[60px] pt-12 md:px-20 md:pb-[80px] md:pt-20">
      {/* Subtle radial gradient behind phone */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_70%_50%,_#A078E815_0%,_transparent_60%)]" />

      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-12 md:flex-row md:items-center md:justify-between md:gap-8">
        {/* Left — text content */}
        <div className="flex max-w-[560px] flex-col items-center gap-8 md:items-start">
          {/* Badge */}
          <div className="flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.125] px-5 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-medium text-primary">
              Gestao de academias de Jiu-Jitsu
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-center font-[family-name:var(--font-sora)] text-[36px] font-extrabold leading-[1.1] tracking-[-2px] text-white md:text-left md:text-[52px]">
            Sua academia inteira na palma da sua mao
          </h1>

          {/* Subheadline */}
          <p className="text-center text-base leading-relaxed text-text-secondary md:text-left md:text-[17px] md:leading-relaxed">
            Agenda, check-in, graduacoes e financeiro em um unico app feito para quem vive o Jiu-Jitsu. Simples para voce, seus instrutores e seus alunos.
          </p>

          {/* CTA */}
          <TrackedLink
            href="#precos"
            eventName="cta_hero_click"
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-b from-primary to-primary-dark px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
          >
            Comecar meu teste gratis
            <ArrowRight className="h-5 w-5" />
          </TrackedLink>
        </div>

        {/* Right — phone mockup */}
        <div className="relative flex w-full max-w-[480px] items-center justify-center md:w-auto">
          <Image
            src="/hero-mockup-v2.png"
            alt="App Tatame - Gestao de academia de Jiu-Jitsu"
            width={480}
            height={580}
            className="h-auto w-full max-w-[400px] object-contain md:max-w-[480px]"
            priority
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo typecheck --filter=@tatame/web`
Expected: Success.

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/hero-mockup-v2.png apps/web/components/v2/hero-v2.tsx
git commit -m "feat(web): add hero-v2 component with phone mockup image"
```

---

### Task 3: Social Proof Bar

**Files:**
- Create: `apps/web/components/v2/social-proof.tsx`

- [ ] **Step 1: Create the social proof component**

```tsx
export function SocialProof() {
  const academies = [
    { name: "Fighter's BJJ" },
    { name: "Academia 2" },
  ];

  return (
    <section className="border-t border-border px-6 py-10 md:px-20">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-6">
        <p className="text-sm font-medium text-text-muted">
          Academias que ja usam o Tatame
        </p>
        <div className="flex items-center gap-8">
          {academies.map((academy) => (
            <span
              key={academy.name}
              className="font-[family-name:var(--font-sora)] text-lg font-semibold text-white"
            >
              {academy.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/v2/social-proof.tsx
git commit -m "feat(web): add social proof bar for landing page v2"
```

---

### Task 4: Features V2

**Files:**
- Create: `apps/web/components/v2/features-v2.tsx`

- [ ] **Step 1: Create the features component with alternating blocks**

```tsx
import {
  Calendar,
  UserCheck,
  Award,
  CreditCard,
  Users,
  Baby,
  Smartphone,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const featuresBlock1: Feature[] = [
  {
    icon: Calendar,
    title: "Agenda de aulas",
    description:
      "Crie sua grade uma vez e ela se repete toda semana. Defina instrutores, horarios e capacidade por turma.",
  },
  {
    icon: UserCheck,
    title: "Check-in inteligente",
    description:
      "Saiba exatamente quem treinou, quando e em qual turma. Controle automatico de capacidade e limite semanal.",
  },
  {
    icon: Award,
    title: "Graduacoes",
    description:
      "Acompanhe a evolucao de cada aluno com historico completo de faixas, graus e observacoes de promocao.",
  },
  {
    icon: CreditCard,
    title: "Pagamentos",
    description:
      "Receba mensalidades via Pix ou cartao direto no app. Veja quem pagou, quem esta atrasado e seu historico financeiro.",
  },
];

const featuresBlock2: Feature[] = [
  {
    icon: Users,
    title: "Gestao de membros",
    description:
      "Aprove novos alunos, veja perfis detalhados e mantenha o controle de quem treina na sua academia.",
  },
  {
    icon: Baby,
    title: "Dependentes",
    description:
      "Pais acompanham presencas e graduacoes dos filhos pelo proprio celular, com assinatura e check-in vinculados.",
  },
  {
    icon: Smartphone,
    title: "App multi-plataforma",
    description:
      "Cada perfil ve o que precisa: gestores administram, instrutores ensinam, alunos acompanham. iPhone e Android.",
  },
  {
    icon: BarChart3,
    title: "Relatorios",
    description:
      "Veja a saude da sua academia em numeros: frequencia, receita e crescimento em dashboards visuais.",
  },
];

function FeatureItem({ icon: Icon, title, description }: Feature) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-[48px] w-[48px] items-center justify-center rounded-[14px] bg-primary/[0.125]">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-[family-name:var(--font-sora)] text-lg font-bold text-white">
        {title}
      </h3>
      <p className="text-[15px] leading-relaxed text-text-secondary">
        {description}
      </p>
    </div>
  );
}

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[20px] border-2 border-dashed border-border-light bg-surface">
      <span className="text-sm text-text-muted">{label}</span>
    </div>
  );
}

export function FeaturesV2() {
  return (
    <section id="recursos" className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        {/* Section header */}
        <div className="mb-16 flex flex-col items-center gap-4">
          <span className="rounded-full bg-primary/[0.125] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-primary">
            RECURSOS
          </span>
          <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[44px]">
            O que o app oferece
          </h2>
          <p className="max-w-[600px] text-center text-base leading-relaxed text-text-secondary md:text-lg">
            Cada recurso foi pensado para a rotina real de quem vive o Jiu-Jitsu.
          </p>
        </div>

        {/* Block 1: Image LEFT + 4 features RIGHT */}
        <div className="mb-20 flex flex-col items-center gap-12 md:flex-row md:gap-16">
          <div className="w-full md:w-1/2">
            <ImagePlaceholder label="Screenshot do app — Bloco 1" />
          </div>
          <div className="grid w-full grid-cols-1 gap-10 sm:grid-cols-2 md:w-1/2">
            {featuresBlock1.map((feature) => (
              <FeatureItem key={feature.title} {...feature} />
            ))}
          </div>
        </div>

        {/* Block 2: 4 features LEFT + Image RIGHT */}
        <div className="flex flex-col-reverse items-center gap-12 md:flex-row md:gap-16">
          <div className="grid w-full grid-cols-1 gap-10 sm:grid-cols-2 md:w-1/2">
            {featuresBlock2.map((feature) => (
              <FeatureItem key={feature.title} {...feature} />
            ))}
          </div>
          <div className="w-full md:w-1/2">
            <ImagePlaceholder label="Screenshot do app — Bloco 2" />
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo typecheck --filter=@tatame/web`
Expected: Success.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/v2/features-v2.tsx
git commit -m "feat(web): add features-v2 component with alternating image blocks"
```

---

### Task 5: Advantages

**Files:**
- Create: `apps/web/components/v2/advantages.tsx`

- [ ] **Step 1: Create the advantages component**

```tsx
const advantages = [
  {
    title: "Chega de caderninho",
    description:
      "Substitua papel, planilhas e grupos de WhatsApp por um sistema feito pra sua academia.",
  },
  {
    title: "Tudo em um lugar so",
    description:
      "Agenda, financeiro, graduacoes e membros em um unico app. Sem precisar de 5 ferramentas diferentes.",
  },
  {
    title: "Seus alunos tambem usam",
    description:
      "Alunos fazem check-in, acompanham graduacoes e pagam pelo app. Menos trabalho pra voce.",
  },
  {
    title: "Pronto pra usar em minutos",
    description:
      "Sem treinamento, sem integracao complicada. Crie sua conta e comece a gerenciar hoje.",
  },
];

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-2xl border-2 border-dashed border-border-light bg-background">
      <span className="text-sm text-text-muted">{label}</span>
    </div>
  );
}

export function Advantages() {
  return (
    <section className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        {/* Section header */}
        <div className="mb-16 flex flex-col items-center gap-4">
          <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[44px]">
            Por que escolher o Tatame
          </h2>
          <p className="max-w-[600px] text-center text-base leading-relaxed text-text-secondary md:text-lg">
            Feito por quem entende a rotina de uma academia de Jiu-Jitsu.
          </p>
        </div>

        {/* 2x2 grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {advantages.map((item, index) => (
            <div
              key={item.title}
              className="flex flex-col gap-6 rounded-[20px] border border-border bg-surface p-8"
            >
              <h3 className="font-[family-name:var(--font-sora)] text-xl font-bold text-white">
                {item.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-text-secondary">
                {item.description}
              </p>
              <ImagePlaceholder label={`Imagem vantagem ${index + 1}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/v2/advantages.tsx
git commit -m "feat(web): add advantages section for landing page v2"
```

---

### Task 6: How To Start

**Files:**
- Create: `apps/web/components/v2/how-to-start.tsx`

- [ ] **Step 1: Create the how-to-start component**

```tsx
import { UserPlus, Settings, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const steps: { icon: LucideIcon; number: string; title: string; description: string }[] = [
  {
    icon: UserPlus,
    number: "1",
    title: "Crie sua conta gratis",
    description:
      "Cadastre-se em segundos — sem cartao de credito, sem compromisso.",
  },
  {
    icon: Settings,
    number: "2",
    title: "Configure sua academia",
    description:
      "Adicione suas turmas, horarios e planos. Em poucos minutos esta tudo pronto.",
  },
  {
    icon: Rocket,
    number: "3",
    title: "Comece a gerenciar",
    description:
      "Convide instrutores e alunos. Sua academia ja esta funcionando no Tatame.",
  },
];

export function HowToStart() {
  return (
    <section id="como-funciona" className="bg-surface px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        {/* Section header */}
        <div className="mb-16 flex flex-col items-center gap-4">
          <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[44px]">
            Comece em 3 passos
          </h2>
          <p className="max-w-[500px] text-center text-base leading-relaxed text-text-secondary md:text-lg">
            Do cadastro a primeira aula gerenciada em minutos.
          </p>
        </div>

        {/* Steps */}
        <div className="relative flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-center md:gap-0">
          {steps.map((step, index) => (
            <div key={step.number} className="flex flex-col items-center md:flex-1">
              {/* Connector line (desktop only, between steps) */}
              {index < steps.length - 1 && (
                <div className="absolute top-[36px] hidden h-px bg-border-light md:block" style={{
                  left: `${(100 / steps.length) * (index + 0.5) + 5}%`,
                  width: `${(100 / steps.length) - 10}%`,
                }} />
              )}

              {/* Icon circle */}
              <div className="relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-primary bg-background">
                <step.icon className="h-7 w-7 text-primary" />
              </div>

              {/* Text */}
              <div className="mt-6 flex max-w-[280px] flex-col items-center gap-2 text-center">
                <span className="text-sm font-bold text-primary">Passo {step.number}</span>
                <h3 className="font-[family-name:var(--font-sora)] text-lg font-bold text-white">
                  {step.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-text-secondary">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/v2/how-to-start.tsx
git commit -m "feat(web): add how-to-start 3-step section for landing page v2"
```

---

### Task 7: Banner CTA

**Files:**
- Create: `apps/web/components/v2/banner-cta.tsx`

- [ ] **Step 1: Create the banner CTA component**

```tsx
import { ArrowRight } from "lucide-react";
import { TrackedLink } from "../tracked-link";

export function BannerCta() {
  return (
    <section className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col items-center gap-8 rounded-3xl bg-gradient-to-b from-[#1A1030] to-[#0C0C0C] px-6 py-16 md:px-20 md:py-24">
          <h2 className="max-w-[800px] text-center font-[family-name:var(--font-sora)] text-[32px] font-extrabold leading-[1.15] tracking-[-1.5px] text-white md:text-[48px]">
            Onde a organizacao vira resultado
          </h2>
          <p className="max-w-[560px] text-center text-base leading-relaxed text-text-secondary md:text-lg">
            Pare de perder tempo com planilhas e comece a focar no que importa: seus alunos no tatame.
          </p>
          <TrackedLink
            href="#precos"
            eventName="cta_banner_click"
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-b from-primary to-primary-dark px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
          >
            Comecar meu teste gratis
            <ArrowRight className="h-5 w-5" />
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/v2/banner-cta.tsx
git commit -m "feat(web): add banner CTA section for landing page v2"
```

---

### Task 8: Pricing V2

**Files:**
- Create: `apps/web/components/v2/pricing-v2.tsx`

- [ ] **Step 1: Create the pricing component**

```tsx
import { Check } from "lucide-react";
import { TrackedLink } from "../tracked-link";

const proPlan = {
  name: "Pro",
  description:
    "Tudo que voce precisa para gerenciar sua academia sem dor de cabeca.",
  price: "R$ 49",
  features: [
    "Cadastre quantos alunos quiser",
    "Monte quantas turmas precisar",
    "Saiba quanto entra e quanto sai",
    "Receba pagamentos via Pix e cartao direto no app",
    "Adicione todos os seus instrutores",
    "Gerencie dependentes e responsaveis",
  ],
};

export function PricingV2() {
  return (
    <section id="precos" className="bg-surface px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col items-center gap-16">
          {/* Header */}
          <div className="flex max-w-[700px] flex-col items-center gap-4">
            <span className="rounded-full bg-primary/[0.125] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-primary">
              PRECOS
            </span>
            <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[44px]">
              Um plano. Tudo incluso.
            </h2>
            <p className="text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              Teste gratis por 30 dias. Cancele quando quiser, sem perguntas.
            </p>
          </div>

          {/* Card */}
          <div className="w-full max-w-[480px]">
            <div className="flex flex-col gap-8 rounded-[20px] border-2 border-primary bg-background p-8 md:p-10">
              {/* Trial badge */}
              <span className="w-fit rounded-full bg-gradient-to-b from-primary to-primary-dark px-3 py-1 text-[16px] font-bold uppercase tracking-[1.5px] text-white">
                30 DIAS GRATIS
              </span>

              <div className="flex flex-col gap-2">
                <h3 className="font-[family-name:var(--font-sora)] text-[22px] font-bold text-white">
                  {proPlan.name}
                </h3>
                <p className="text-sm leading-normal text-text-secondary">
                  {proPlan.description}
                </p>
              </div>

              <div className="flex items-end gap-1">
                <span className="font-[family-name:var(--font-sora)] text-5xl font-extrabold tracking-[-2px] text-white">
                  {proPlan.price}
                </span>
                <span className="text-base text-text-muted">/mes</span>
              </div>

              <div className="h-px w-full bg-border" />

              <div className="flex flex-col gap-4">
                {proPlan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <Check className="h-[18px] w-[18px] text-primary" />
                    <span className="text-sm text-white">{feature}</span>
                  </div>
                ))}
              </div>

              <TrackedLink
                href="/cadastro"
                eventName="cta_pricing_click"
                className="flex items-center justify-center rounded-xl bg-gradient-to-b from-primary to-primary-dark py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Comecar meu teste gratis
              </TrackedLink>

              <p className="text-center text-sm text-text-secondary">
                Cancele quando quiser, sem burocracia
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/v2/pricing-v2.tsx
git commit -m "feat(web): add pricing-v2 component for landing page v2"
```

---

### Task 9: FAQ V2

**Files:**
- Create: `apps/web/components/v2/faq-v2.tsx`

- [ ] **Step 1: Create the FAQ component**

```tsx
"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { FaqJsonLd } from "../json-ld";
import { event as trackEvent } from "@/lib/gtag";

const faqItems = [
  {
    question: "Como funciona o periodo de teste?",
    answer:
      "Voce usa o plano Pro completo por 30 dias, sem pagar nada. Se nao gostar, e so cancelar — sem multa, sem burocracia.",
  },
  {
    question: "O app funciona no celular?",
    answer:
      "Sim. O Tatame e um app nativo, feito para funcionar direto no celular. Disponivel no Google Play e na App Store.",
  },
  {
    question: "Posso migrar dados de outro sistema?",
    answer:
      "Ainda nao temos migracao automatica, mas nosso time pode ajudar caso a caso. Fale conosco pelo WhatsApp e a gente resolve junto.",
  },
  {
    question: "Preciso de conhecimento tecnico para usar?",
    answer:
      "Nao. Se voce sabe usar WhatsApp, sabe usar o Tatame. A interface foi feita para ser simples desde o primeiro acesso.",
  },
  {
    question: "Meus alunos podem pagar diretamente no app?",
    answer:
      "Sim. O aluno paga pelo app via Pix ou cartao, e o valor cai direto na sua conta atraves da chave Pix cadastrada.",
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
            isOpen
              ? "mt-4 grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
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

export function FaqV2() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="duvidas" className="px-6 py-16 md:px-20 md:py-[100px]">
      <FaqJsonLd items={faqItems} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col items-center gap-16">
          {/* Header */}
          <div className="flex max-w-[700px] flex-col items-center gap-4">
            <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[40px]">
              Perguntas frequentes
            </h2>
            <p className="text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              O que donos de academia perguntam antes de comecar.
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
            <p className="text-base text-text-secondary">Ainda tem duvidas?</p>
            <a
              href="https://wa.me/5579988566945?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20app%20Tatame"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("cta_whatsapp_click")}
              className="flex items-center gap-2.5 rounded-[14px] bg-whatsapp px-7 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Image src="/whatsapp.svg" alt="WhatsApp" width={20} height={20} />
              Fale conosco pelo WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/v2/faq-v2.tsx
git commit -m "feat(web): add faq-v2 component for landing page v2"
```

---

### Task 10: Final CTA V2

**Files:**
- Create: `apps/web/components/v2/final-cta-v2.tsx`

- [ ] **Step 1: Create the final CTA component**

```tsx
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { TrackedLink } from "../tracked-link";

export function FinalCtaV2() {
  return (
    <section className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col items-center gap-8 rounded-3xl border border-primary/20 bg-gradient-to-b from-[#1A1030] to-[#2D1B4E] px-6 py-12 md:p-20">
          <h2 className="max-w-[700px] text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold leading-[1.2] tracking-[-1.5px] text-white md:text-[40px]">
            Sua academia merece mais do que uma planilha
          </h2>
          <p className="max-w-[600px] text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
            Teste o Tatame por 30 dias, sem pagar nada e sem cartao de credito. Cancele quando quiser.
          </p>
          {/* Store icons */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <Image src="/apple.svg" alt="iOS" width={20} height={20} className="brightness-0 invert" />
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <Image src="/google.svg" alt="Android" width={20} height={20} className="brightness-0 invert" />
            </div>
          </div>
          <TrackedLink
            href="#precos"
            eventName="cta_final_click"
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-b from-primary to-primary-dark px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
          >
            Criar minha academia gratis
            <ArrowRight className="h-5 w-5" />
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/v2/final-cta-v2.tsx
git commit -m "feat(web): add final-cta-v2 component for landing page v2"
```

---

### Task 11: Footer V2

**Files:**
- Create: `apps/web/components/v2/footer-v2.tsx`

- [ ] **Step 1: Create the footer component**

```tsx
import Image from "next/image";

export function FooterV2() {
  return (
    <footer className="bg-surface px-6 py-10 md:px-20 md:py-[60px]">
      <div className="mx-auto max-w-[1440px]">
        {/* Top */}
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          {/* Brand */}
          <div className="flex max-w-[320px] flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <Image src="/icon.png" alt="Tatame" width={20} height={20} />
              <span className="font-[family-name:var(--font-sora)] text-lg font-bold text-white">
                TATAME
              </span>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">
              Gestao simples para academias de Jiu-Jitsu.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-20">
            <div className="flex flex-col gap-4">
              <span className="text-[13px] font-bold text-white">Produto</span>
              <a href="/v2" className="text-[13px] text-text-secondary hover:text-white">
                Inicio
              </a>
              <a href="#recursos" className="text-[13px] text-text-secondary hover:text-white">
                Recursos
              </a>
              <a href="#precos" className="text-[13px] text-text-secondary hover:text-white">
                Precos
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
            &copy; 2026 Tatame. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/v2/footer-v2.tsx
git commit -m "feat(web): add footer-v2 component for landing page v2"
```

---

### Task 12: V2 Page — Compose All Sections

**Files:**
- Create: `apps/web/app/(site)/v2/page.tsx`

- [ ] **Step 1: Create the V2 page composing all sections**

```tsx
import type { Metadata } from "next";
import { HeaderV2 } from "@/components/v2/header-v2";
import { HeroV2 } from "@/components/v2/hero-v2";
import { SocialProof } from "@/components/v2/social-proof";
import { FeaturesV2 } from "@/components/v2/features-v2";
import { Advantages } from "@/components/v2/advantages";
import { HowToStart } from "@/components/v2/how-to-start";
import { BannerCta } from "@/components/v2/banner-cta";
import { PricingV2 } from "@/components/v2/pricing-v2";
import { FaqV2 } from "@/components/v2/faq-v2";
import { FinalCtaV2 } from "@/components/v2/final-cta-v2";
import { FooterV2 } from "@/components/v2/footer-v2";
import {
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
} from "@/components/json-ld";

export const metadata: Metadata = {
  title: "Tatame — Gestao completa para sua academia de Jiu-Jitsu",
  description:
    "Agenda, check-in, graduacoes e financeiro em um unico app. Teste gratis por 30 dias.",
  alternates: {
    canonical: "https://apptatame.com.br/v2",
  },
};

export default function LandingPageV2() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <OrganizationJsonLd />
      <SoftwareApplicationJsonLd />
      <HeaderV2 />
      <HeroV2 />
      <SocialProof />
      <FeaturesV2 />
      <Advantages />
      <HowToStart />
      <BannerCta />
      <PricingV2 />
      <FaqV2 />
      <FinalCtaV2 />
      <FooterV2 />
    </main>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo typecheck --filter=@tatame/web`
Expected: Success, no type errors.

- [ ] **Step 3: Run the dev server and verify the page loads**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/web && npx next dev --turbopack`
Then open: `http://localhost:3000/v2`
Expected: All 11 sections render correctly. Image placeholders visible. V1 at `/` is unchanged.

- [ ] **Step 4: Verify V1 is untouched**

Open: `http://localhost:3000/`
Expected: V1 landing page renders exactly as before, no changes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(site\)/v2/page.tsx
git commit -m "feat(web): compose landing page v2 at /v2 route"
```

---

### Task 13: Visual QA and Copy Polish

This is a manual review task. After all components are assembled:

- [ ] **Step 1: Review each section visually at `localhost:3000/v2`**

Check for:
- Correct spacing between sections
- Responsive layout on mobile (use browser dev tools, toggle to 375px width)
- All anchor links work (#recursos, #precos, #como-funciona, #duvidas)
- Sticky header works on scroll
- CTA buttons have correct hrefs
- Image placeholders are clearly visible
- No broken imports or missing assets

- [ ] **Step 2: Fix any spacing, alignment, or responsive issues found**

Address issues directly in the component files.

- [ ] **Step 3: Run typecheck one final time**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo typecheck --filter=@tatame/web`
Expected: Success.

- [ ] **Step 4: Final commit**

```bash
git add -A apps/web/components/v2/ apps/web/app/\(site\)/v2/
git commit -m "fix(web): visual QA fixes for landing page v2"
```
