# Landing Page V2 — Design Spec

## Overview

New sales page for Tatame, accessible at `/v2`. The current landing page at `/` remains untouched. If V2 proves better, it becomes the default.

**Goal:** A more premium, visually rich landing page focused on showing the app in action through mockups and screenshots, with clear information and direct conversion flow.

## Technical Context

- **Framework:** Next.js 15, React 19, Tailwind CSS v4
- **Route:** `apps/web/app/(site)/v2/page.tsx` (new route group)
- **Fonts:** Sora (headlines, brand) + Inter (body)
- **Design system:** Existing CSS custom properties from `globals.css`

## Design Tokens

All colors and tokens follow the existing theme:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-background` | `#0C0C0C` | Page background |
| `--color-surface` | `#1A1A1A` | Cards, elevated surfaces |
| `--color-border` | `#2A2A2A` | Borders |
| `--color-border-light` | `#3A3A3A` | Light borders |
| `--color-primary` | `#A078E8` | Primary accent, CTAs |
| `--color-primary-dark` | `#7C5CBF` | Gradient end for buttons |
| `--color-text-primary` | `#FFFFFF` | Headings, primary text |
| `--color-text-secondary` | `#ABABAB` | Body text, descriptions |
| `--color-text-muted` | `#525252` | Muted/placeholder text |

## Sections

### 1. Header

- **Layout:** Logo left, nav links centered, CTA right
- **Logo:** Tatame logo (`icon.png`) + "Tatame" text in Sora bold
- **Nav links:** Recursos, Precos, Como funciona, Duvidas (anchor links to sections)
- **CTA:** "Comecar gratis" button with gradient `from-primary to-primary-dark`, rounded corners, links to pricing section
- **Behavior:** Sticky on scroll, dark background with border-bottom on scroll
- **Mobile:** Hamburger menu

### 2. Hero

- **Layout:** Split — text content left, hand-with-phone mockup image right
- **Badge:** Pill above headline: "Gestao de academias de Jiu-Jitsu" with sparkle icon, purple background/border subtle
- **Headline:** New copy (to be proposed via copywriting skill), 6-12 words, outcome-focused, Sora bold ~48px
- **Subheadline:** New copy, 15-25 words expanding on value, Inter regular ~17px, text-secondary color
- **CTA button:** "Comecar meu teste gratis" with arrow, gradient purple, links to `#precos`
- **Image:** User's hand-holding-phone mockup image (already created: `Gemini_Generated_Image_8hzkgn8hzkgn8hzk.png`), positioned right side
- **Background:** Subtle radial gradient (purple glow) behind the phone area, no particles or decorative elements
- **Spacing:** ~80px top padding, ~60px bottom

### 3. Social Proof Bar

- **Layout:** Centered horizontal bar below hero
- **Content:** "Academias que ja usam o Tatame" text + logos/names of 2 academies currently using the platform
- **Style:** Subtle, trust-building. Text-secondary color for label, white for academy names/logos
- **Separator:** Subtle border or background change from hero

### 4. Features — "O que o app oferece"

- **Layout:** Two alternating blocks
  - **Block 1:** Image/mockup placeholder LEFT + 4 features grid (2x2) RIGHT
  - **Block 2:** 4 features grid (2x2) LEFT + image/mockup placeholder RIGHT
- **Reference:** CoinChange "Why Choose" section style
- **Image placeholders:** Empty spaces with border/placeholder for user to add screenshots later
- **Features (8 total):**
  1. Agenda
  2. Check-in
  3. Graduacoes
  4. Pagamentos
  5. Gestao de membros
  6. Dependentes
  7. App multi-plataforma
  8. Relatorios
- **Each feature:** Icon + title (Sora semibold) + short description (Inter, text-secondary)

### 5. Vantagens

- **Layout:** Grid 2x2 of cards
- **Reference:** "Next-Level Customer Support" section style
- **Each card:** Title + short description + image placeholder below
- **Card style:** Surface background (#1A1A1A), rounded corners, subtle border
- **Image placeholders:** User will add images later
- **Content:** Advantages of using Tatame vs spreadsheet/notebook (copy to be proposed via copywriting skill)

### 6. Como comecar — "How to start in 3 Steps"

- **Layout:** Horizontal 3-step flow with visual connectors between steps
- **Reference:** Assistia "How to start in 3 Steps" section style
- **Steps:**
  1. **Crie sua conta gratis** — Sign up illustration/icon placeholder
  2. **Configure sua academia** — Setup illustration/icon placeholder (classes, plans)
  3. **Comece a gerenciar** — Dashboard/success illustration/icon placeholder
- **Each step:** Number/icon + title + short description
- **Connectors:** Subtle lines/arrows between steps
- **Style:** Clean, centered, with step cards on surface background

### 7. Banner Destaque (CTA intermediario)

- **Layout:** Full-width, centered content
- **Reference:** Ryzo "Where clarity becomes progress" section style
- **Content:** Large impact headline (Sora bold, ~40-48px) + subtitle (Inter, text-secondary) + CTA button
- **CTA:** Links to pricing section
- **Background:** Subtle gradient (darker purple tones), clean — no particles, no decorative elements
- **Copy:** To be proposed via copywriting skill

### 8. Precos

- **Layout:** Single plan card, centered
- **Plan:** Pro — R$49/mes
- **Trial badge:** "30 DIAS GRATIS"
- **Description:** Short value proposition
- **Features list:** 6 bullet points (same as V1)
- **CTA:** "Comecar meu teste gratis" linking to `/cadastro`
- **Future-ready:** Structure allows adding an annual plan toggle later (yearly discount)
- **Style:** Card on surface background, gradient border or accent, prominent trial badge

### 9. FAQ

- **Layout:** Accordion, centered
- **Title:** "Perguntas frequentes"
- **Subtitle:** "O que donos de academia perguntam antes de comecar."
- **Questions (same as V1):**
  1. Trial period details
  2. Mobile app availability
  3. Data migration
  4. Technical knowledge required
  5. Payment methods
- **WhatsApp CTA:** Below FAQ, link to `wa.me/5579988566945`

### 10. CTA Final

- **Layout:** Full-width section with gradient purple background
- **Content:** Impact headline + CTA button + store badges (Apple, Google)
- **Style:** Same line as V1 — gradient from-primary to-primary-dark background
- **Copy:** To be proposed via copywriting skill

### 11. Footer

- **Layout:** Same structure as V1
- **Content:** Brand info, product links, legal links (Termos, Privacidade), copyright
- **Style:** Follows V2 design line

## Copy Strategy

All copy (headlines, subheadlines, CTAs, section titles, feature descriptions, banner text) will be proposed using the copywriting skill. Key sections needing new copy:

- Hero headline + subheadline
- Feature descriptions (8 items)
- Vantagens card content
- Como comecar step descriptions
- Banner destaque headline + subtitle
- CTA Final headline

## Assets

| Asset | Status | Notes |
|-------|--------|-------|
| Hand-with-phone mockup | Ready | User's generated image |
| Logo (icon.png) | Exists | Current project logo |
| Features mockup images (x2) | Placeholder | User will create |
| Vantagens card images (x4) | Placeholder | User will create |
| Como comecar step icons (x3) | Placeholder | User will create or use icons |
| Store badges (Apple, Google SVGs) | Exist | Current project assets |
| WhatsApp icon | Exists | Current project asset |

## Animations

No animations in initial implementation. User will add animations in a later phase.

## Analytics

Maintain GA4 event tracking on all CTA buttons:
- `cta_hero_click` — Hero CTA
- `cta_banner_click` — Banner destaque CTA
- `cta_pricing_click` — Pricing CTA
- `cta_final_click` — Final CTA
- `cta_whatsapp_click` — FAQ WhatsApp link
- `cta_header_click` — Header CTA

## Mobile

- Responsive, mobile-first approach
- Header collapses to hamburger menu
- Hero stacks vertically (text above, phone image below)
- Features blocks stack vertically
- Vantagens grid becomes 1 column
- Como comecar steps stack vertically
- CTA buttons full width on mobile
- Minimum font size 16px
- Tap targets minimum 48x48px

## SEO

- Reuse existing JSON-LD structured data components (OrganizationJsonLd, SoftwareApplicationJsonLd)
- Proper heading hierarchy (single h1 in hero)
- Meta tags specific to V2 page
- Share the same OG image or create a V2-specific one later

## File Structure

```
apps/web/app/(site)/v2/
  page.tsx              — V2 landing page (composes sections)
  layout.tsx            — Optional if V2 needs different metadata

apps/web/components/v2/
  header-v2.tsx
  hero-v2.tsx
  social-proof.tsx
  features-v2.tsx
  advantages.tsx
  how-to-start.tsx
  banner-cta.tsx
  pricing-v2.tsx
  faq-v2.tsx
  final-cta-v2.tsx
  footer-v2.tsx
```

V2 components are separate from V1 to avoid any risk of breaking the current page.
