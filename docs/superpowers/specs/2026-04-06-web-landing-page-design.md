# Web Landing Page — Design Spec

**Date:** 2026-04-06
**Status:** Approved
**Approach:** Next.js 15 App Router + Tailwind CSS v4 + CSS animations

---

## Overview

Static marketing landing page for Tatame, deployed via Docker on Coolify. No API connection. Three routes: landing (`/`), privacy policy (`/privacidade`), terms of use (`/termos`).

## Architecture

```
apps/web/
├── app/
│   ├── layout.tsx          # Root layout (fonts, metadata, globals)
│   ├── page.tsx            # Landing page (/)
│   ├── privacidade/
│   │   └── page.tsx        # Política de Privacidade
│   ├── termos/
│   │   └── page.tsx        # Termos de Uso
│   └── globals.css         # Tailwind imports + custom CSS animations
├── components/
│   ├── header.tsx          # Sticky nav: logo + links + CTA
│   ├── footer.tsx          # Shared footer (landing + legal pages)
│   ├── hero.tsx            # Hero: badge, headline, CTA, mockups
│   ├── features.tsx        # 6 feature cards in 2 rows + coming soon badge
│   ├── pricing.tsx         # Free + Pro pricing cards
│   ├── faq.tsx             # Accordion (client component)
│   ├── final-cta.tsx       # Store buttons section (scroll target #download)
│   └── animate-on-scroll.tsx  # Client component: Intersection Observer wrapper
├── public/
│   ├── mockup-1.png        # Placeholder images (user replaces later)
│   ├── mockup-2.png
│   └── mockup-3.png
├── next.config.ts
├── tsconfig.json
├── Dockerfile
├── .dockerignore
└── package.json
```

### Key Decisions

- All pages are **Server Components** by default
- Only 2 client components: `faq.tsx` (accordion state) and `animate-on-scroll.tsx` (Intersection Observer)
- Header and Footer in `layout.tsx` — shared across all routes
- `output: "standalone"` in next.config for Docker/Coolify deployment
- No external animation library — CSS transitions only

## Design Tokens

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0C0C0C` | Main background |
| `surface` | `#1A1A1A` | Cards, pricing section, footer |
| `border` | `#2A2A2A` | Dividers, card borders |
| `border-light` | `#3A3A3A` | Secondary borders |
| `primary` | `#A078E8` | CTAs, badges, highlights |
| `primary-dark` | `#7C5CBF` | Gradient end |
| `text-primary` | `#FFFFFF` | Headings, main text |
| `text-secondary` | `#ABABAB` | Subtitles, descriptions |
| `text-muted` | `#525252` | Copyright, tertiary elements |
| `success` | `#32D74B` | Check icons (free plan) |
| `whatsapp` | `#25D366` | WhatsApp button |

### Typography

| Element | Font | Size (desktop/mobile) | Weight | Letter-spacing |
|---------|------|-----------------------|--------|----------------|
| H1 (hero) | Sora | 64px / 40px | 800 | -2px |
| H2 (sections) | Sora | 44px / 30px | 800 | -1.5px |
| H3 (cards) | Sora | 22px / 20px | 700 | — |
| Body | Inter | 18px / 16px | 400 | — |
| Body small | Inter | 15px / 14px | 400 | — |
| Badge text | Inter | 13px / 11px | 500-700 | 2px (uppercase) |
| Nav links | Inter | 15px | 500 | — |

### Gradients

- **Primary CTA:** `linear-gradient(180deg, #A078E8, #7C5CBF)`
- **CTA Card bg:** `linear-gradient(180deg, #1A1030, #2D1B4E)` with border `#A078E830`

### Animations

- `fade-in-up`: translateY(20px) + opacity 0 → translateY(0) + opacity 1
- Duration: 600ms, ease-out
- Triggered per section via Intersection Observer (`animate-on-scroll.tsx`)
- Header: always visible, no animation

## Page Sections

### Header (sticky)

- Left: Logo icon (grid-3x3 in purple gradient square, corner-radius 12) + "TATAME" text
- Center: "Recursos" → scroll `#recursos`, "Preços" → scroll `#precos`
- Right: "Baixar App" button (purple bg) → scroll `#download`
- Background: `#0C0C0C` with backdrop blur
- **Mobile:** Logo + hamburger menu icon, links in dropdown overlay

### Hero

- Badge: sparkles icon + "Plataforma #1 para academias de Jiu-Jitsu" (purple tint bg + border)
- Headline: "Sua academia na palma da mão" (Sora 64px, centered)
- Subtitle: "Gerencie turmas, controle presenças, acompanhe graduações e pagamentos — tudo em um só lugar. Simples para gestores, instrutores e alunos." (Inter 20px, max-width 700px)
- CTA: "Começar gratuitamente →" (purple gradient button) → scroll `#download`
- 3 phone mockup placeholders with purple shadow (`box-shadow: 0 20px 60px #A078E830`), corner-radius 32px, border `#2A2A2A`

### Features (`#recursos`)

- Badge: "RECURSOS" (uppercase, purple)
- Title: "Tudo que sua academia precisa"
- Subtitle: "Simplifique a gestão da sua academia com ferramentas pensadas para o dia a dia do Jiu-Jitsu."
- 6 cards in 3-column grid (1 column mobile), 2 rows:
  1. **Agenda de aulas** (calendar icon) — "Monte sua grade semanal com turmas recorrentes, instrutores e controle de capacidade por aula."
  2. **Check-in inteligente** (user-check icon) — "Presenças com controle de capacidade, limite semanal e janela de horário automáticos."
  3. **Graduações** (award icon) — "Registre faixas e graus de cada aluno com histórico completo de promoções e observações."
  4. **Pagamentos** (credit-card icon) — "Controle de mensalidades, confirmação de pagamentos e histórico financeiro completo."
  5. **Gestão de membros** (users icon) — "Aprovação de novos membros, perfis detalhados e controle de instrutores e alunos."
  6. **Relatórios** (bar-chart-3 icon) — "Acompanhe frequência, receita e crescimento da academia com dashboards visuais."
- Cards: bg `#1A1A1A`, border `#2A2A2A`, corner-radius 20px, padding 32px
- Icon container: 52x52, bg `#A078E820`, corner-radius 14px
- Coming soon badge: rocket icon + "E tem muito mais a caminho — fique ligado!" (bg `#1A1A1A`, border `#3A3A3A`)

### Pricing (`#precos`)

- Background: `#1A1A1A` (full width)
- Badge: "PREÇOS" (uppercase, purple)
- Title: "Simples e transparente"
- Subtitle: "Comece gratuitamente. Evolua quando sua academia crescer."
- 2 cards side by side (stacked on mobile), max-width 900px:

**Free Plan:**
- Name: "Gratuito", desc: "Para academias começando no digital"
- Price: "R$ 0" + "/mês"
- Features (green check icons): Até 30 alunos, Agenda de aulas, Check-in de alunos, Controle de graduações
- CTA: "Começar grátis" (bg `#242424`, border `#3A3A3A`) → scroll `#download`
- Card: bg `#0C0C0C`, border `#2A2A2A`

**Pro Plan:**
- Badge: "MAIS POPULAR" (purple gradient pill)
- Name: "Pro", desc: "Para academias que querem crescer"
- Price: "R$ 49" + "/mês"
- Features (purple check icons): Alunos ilimitados, Tudo do plano Gratuito, Dashboard web completo, Relatórios avançados, Suporte prioritário
- CTA: "Assinar agora" (purple gradient) → scroll `#download`
- Card: bg `#0C0C0C`, border `#A078E8` (2px)

### Final CTA (`#download`)

- Card with gradient bg (`#1A1030` → `#2D1B4E`), border `#A078E830`, corner-radius 24px
- Title: "Pronto para transformar sua academia?" (Sora 40px)
- Subtitle: "Comece gratuitamente e veja a diferença em poucos dias. Sem cartão de crédito."
- 2 buttons: "App Store" + "Google Play" (white bg, dark text) — `href="#"` placeholder

### FAQ

- Title: "Perguntas frequentes"
- Subtitle: "Tire suas dúvidas sobre o Tatame e como ele pode ajudar sua academia."
- 6 questions in accordion (click to toggle, chevron rotates):
  1. "Como funciona o período gratuito?" — "Você pode usar todas as funcionalidades do Tatame por 14 dias sem compromisso. Não pedimos cartão de crédito — basta criar sua conta, cadastrar sua academia e começar a usar. Ao final do período, escolha o plano que melhor se encaixa."
  2. "Quantos alunos posso cadastrar?" — Lorem ipsum
  3. "O app funciona no celular?" — Lorem ipsum
  4. "Posso migrar dados de outro sistema?" — Lorem ipsum
  5. "Como funciona o suporte?" — Lorem ipsum
  6. "Preciso de conhecimento técnico para usar?" — Lorem ipsum
- Dividers between items (`#2A2A2A`)
- WhatsApp CTA: "Ainda tem dúvidas?" + green button "Fale conosco pelo WhatsApp" (message-circle icon)
- Link: `https://wa.me/5579988566945?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20app%20Tatame`

### Footer

- Background: `#1A1A1A`
- Top: Logo + tagline left, 2 link columns right
  - Produto: Início (`/`), Recursos (`#recursos`), Preços (`#precos`)
  - Legal: Privacidade (`/privacidade`), Termos de uso (`/termos`)
- Divider `#2A2A2A`
- Bottom: "© 2026 Tatame. Todos os direitos reservados." + social icons (Instagram, Twitter, YouTube) — `href="#"`

## Legal Pages

### Política de Privacidade (`/privacidade`)

Same header/footer. Content centered, max-width ~800px, padding 80px top/320px sides (desktop).

- Title: "Política de Privacidade" (Sora 40px)
- Subtitle: "Última atualização: 01 de abril de 2026"
- Divider
- 7 sections (Sora 22px title + Inter 16px body, line-height 1.8, gap 48px between sections):
  1. Informações que coletamos
  2. Como usamos suas informações
  3. Compartilhamento de dados
  4. Armazenamento e segurança
  5. Seus direitos
  6. Cookies e rastreamento
  7. Contato

Full text content extracted from Pencil design file.

### Termos de Uso (`/termos`)

Same layout as privacy page.

- Title: "Termos de Uso"
- Subtitle: "Última atualização: 01 de abril de 2026"
- 8 sections:
  1. Aceitação dos termos
  2. Descrição do serviço
  3. Cadastro e conta
  4. Planos e pagamentos
  5. Uso aceitável
  6. Propriedade intelectual
  7. Limitação de responsabilidade
  8. Contato

Full text content extracted from Pencil design file.

## Dockerfile

Multi-stage build:

1. **deps stage:** `node:20-alpine`, install pnpm, copy workspace root + `apps/web` package files, `pnpm install --frozen-lockfile`
2. **build stage:** Copy source, `pnpm --filter @tatame/web build`
3. **runner stage:** `node:20-alpine`, copy standalone output + static + public, expose port 3000, `node server.js`

`.dockerignore`: node_modules, .next, .git, other apps/packages not needed.

## Dependencies

```json
{
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

## Responsive Breakpoints

- **Mobile:** < 768px (single column, hamburger menu, stacked cards)
- **Desktop:** ≥ 768px (multi-column grids, horizontal nav, side-by-side pricing)

Design follows mobile-first approach matching the Pencil designs (390px mobile, 1440px desktop).
