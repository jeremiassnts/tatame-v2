# Mobile Base + Onboarding — Design Spec

## Overview

Scaffold the React Native mobile app (`apps/mobile`) with Expo and implement the two onboarding screens: Welcome (M-ONBOARD-01) and User Type Selection (M-ONBOARD-02).

## Stack

- **Expo SDK 52** — managed workflow
- **Expo Router** — file-based routing
- **NativeWind v4** — Tailwind CSS for React Native (replaces Gluestack)
- **Poppins** — single font family via `@expo-google-fonts/poppins` (weights: 400, 500, 600, 700)
- **lucide-react-native** — icons (matches design file)
- **expo-linear-gradient** — CTA button gradient
- **@react-native-async-storage/async-storage** — persist `userType` selection

Future (not implemented now): Clerk Expo SDK, React Query, API client.

## Navigation Structure

```
apps/mobile/
├── app/
│   ├── _layout.tsx            # Root: font loading, NativeWind provider
│   ├── (onboarding)/
│   │   ├── _layout.tsx        # Stack navigator, no header
│   │   ├── index.tsx          # M-ONBOARD-01: Welcome
│   │   └── user-type.tsx      # M-ONBOARD-02: User Type Selection
│   ├── (auth)/
│   │   └── _layout.tsx        # Placeholder
│   └── (app)/
│       └── _layout.tsx        # Placeholder
├── assets/
│   └── images/                # User-provided logo
├── components/                # Shared components
├── tailwind.config.js
├── global.css
├── app.json
├── babel.config.js
├── metro.config.js
├── tsconfig.json
└── package.json
```

## Design Tokens

Configured in `tailwind.config.js` as custom theme extensions:

| Token | Value | Tailwind class |
|-------|-------|----------------|
| Background | `#0C0C0C` | `bg-background` |
| Surface | `#1A1A1A` | `bg-surface` |
| Surface border | `#2A2A2A` | `border-surface-border` |
| Accent | `#A078E8` | `bg-accent`, `border-accent` |
| Accent dark | `#7C5CBF` | `bg-accent-dark` |
| Accent translucent | `#A078E820` | `bg-accent-translucent` |
| Text primary | `#FFFFFF` | `text-primary` |
| Text muted | `#ABABAB` | `text-muted` |

## Screen: M-ONBOARD-01 — Welcome

- Full-screen dark background (`#0C0C0C`)
- Content vertically centered, horizontally centered
- **Logo area**: placeholder `View` (120x120, rounded-3xl, `#242424` background) — user will replace with actual logo image
- **Title**: "TATAME" — Poppins 700, ~38px, white, letter-spacing tight
- **Tagline**: "Gerencie sua academia de Jiu-Jitsu com simplicidade e eficiência" — Poppins 400, 16px, muted, centered
- **CTA**: "Continuar →" — full-width button, 56px height, rounded-xl, purple gradient (#A078E8 → #7C5CBF), Poppins 600 white text + arrow-right icon
- CTA navigates to `/(onboarding)/user-type`

## Screen: M-ONBOARD-02 — User Type Selection

- **Header**: "Qual é o seu perfil?" — Poppins 700, 28px, white. Subtitle in Poppins 400, 15px, muted.
- **Role cards** (3 items, vertical stack, 12px gap):
  - Each: 20px padding, rounded-2xl, row layout with 48x48 icon container + title + description
  - **Unselected**: `#1A1A1A` bg, `#2A2A2A` border, gray icon bg
  - **Selected**: `#A078E820` bg, `#A078E8` border (1.5px), gradient icon bg
  - Cards:
    - Gestor — `building-2` icon, "Crie e gerencie sua academia, alunos e instrutores"
    - Instrutor — `graduation-cap` icon, "Ensine aulas e acompanhe o progresso dos alunos"
    - Aluno — `user` icon, "Treine, registre presença e acompanhe sua graduação"
- **CTA**: same style as Welcome screen
- On "Continuar": save selected role to AsyncStorage as `userType` (`manager` | `instructor` | `student`)
- For now, navigates nowhere (auth flow not implemented yet)

## Role mapping

| Card label | AsyncStorage value | API role |
|------------|-------------------|----------|
| Gestor | `manager` | `manager` |
| Instrutor | `instructor` | `instructor` |
| Aluno | `student` | `student` |

## Out of scope

- Clerk authentication
- React Query setup
- API client
- Auth and app route groups (placeholder layouts only)
- Onboarding persistence check (redirect if `userType` already set) — deferred to auth integration
