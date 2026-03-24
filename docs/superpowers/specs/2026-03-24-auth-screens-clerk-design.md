# Auth Screens + Clerk Integration — Design Spec

## Overview

Implement 4 authentication screens (Welcome Landing, Sign Up, Sign In, Email Verification) with Clerk custom flow integration for the mobile app.

## Stack Additions

- **@clerk/clerk-expo** — Clerk SDK for Expo
- **expo-web-browser** — required for OAuth flows
- **expo-secure-store** — Clerk token cache

## Screens

### M-AUTH-01: Welcome Landing (frame `sh9aY`)
- Logo (reuse icon.png from onboarding) in gradient container (88x88, rounded-[22px])
- "TATAME" title (Poppins 700, 32px), tagline "Sua academia na palma da mão" (Poppins 400, 15px, muted)
- Content vertically centered between status bar and bottom area
- **Bottom area:**
  - "Entrar" button — purple solid (#A078E8), h-14, rounded-xl → navigates to sign-in
  - "Criar conta" button — dark (#1A1A1A), border #3A3A3A, h-14, rounded-xl → navigates to sign-up
  - Divider "ou continue com"
  - Google + Apple social buttons side by side (h-[52px], dark bg, border, icons)

### M-AUTH-02: Sign Up (frame `6QNkX`)
- Back button (40x40, rounded-xl, dark bg, border, arrow-left icon)
- Title "Criar conta" (Poppins 700, 28px), subtitle "Preencha seus dados para começar" (15px, muted)
- Form fields (gap-4):
  - Nome completo — text input, placeholder "Digite seu nome"
  - E-mail — email input, placeholder "seu@email.com"
  - Senha — password input, placeholder "Mínimo 8 caracteres", eye-off toggle icon
- All inputs: h-[52px], rounded-xl, bg #1A1A1A, border #2A2A2A, padding-x 16, label above (13px, muted, medium)
- **Bottom area:**
  - "Criar conta" CTA — purple solid, h-14
  - Divider "ou"
  - Google + Apple social buttons
  - "Já tem uma conta? **Entrar**" link (accent color)

### M-AUTH-03: Sign In (frame `PW7C6`)
- Same layout as Sign Up but:
  - Title "Bem-vindo de volta", subtitle "Entre com sua conta para continuar"
  - Fields: E-mail + Senha only
  - "Esqueceu a senha?" link right-aligned below password (accent, 13px) — no-op in MVP
  - CTA "Entrar"
  - "Não tem uma conta? **Criar conta**" link

### M-AUTH-04: Email Verification (frame `YHqfF`)
- Back button
- Title "Verificar e-mail" (Poppins 700, 28px)
- Subtitle: "Enviamos um código de 6 dígitos para" + email in bold white
- 6 digit boxes: 48x56 each, gap-3, rounded-xl, dark bg, border. Active box: border accent 2px
- Timer row: timer icon + "Código expira em MM:SS" (muted, 13px)
- "Não recebeu o código? **Reenviar**" link
- CTA "Verificar" at bottom

## Shared Components

### `components/SocialButtons.tsx`
- Row with Google + Apple buttons, equal width
- Each: h-[52px], rounded-xl, dark bg (#1A1A1A), border #2A2A2A
- Globe icon + "Google", Apple icon + "Apple" (Poppins 500, 14px)
- Props: `onGooglePress`, `onApplePress`

### `components/Divider.tsx`
- Horizontal line + text + horizontal line
- Props: `text` (default "ou")
- Line: #2A2A2A, text: #525252, 12px

### `components/BackButton.tsx`
- 40x40, rounded-xl, bg #1A1A1A, border #2A2A2A
- Arrow-left icon, white
- Props: `onPress` (defaults to `router.back()`)

### `components/FormInput.tsx`
- Label (13px, muted, medium weight) above input
- Input container: h-[52px], rounded-xl, bg #1A1A1A, border #2A2A2A, px-4
- Placeholder: #525252, 15px
- Value: white, 15px
- Optional right icon (eye-off for password toggle)
- Props: `label`, `placeholder`, `value`, `onChangeText`, `secureTextEntry`, `keyboardType`, `autoCapitalize`

## Clerk Integration

### Provider Setup (`app/_layout.tsx`)
- `ClerkProvider` wrapping app with `publishableKey` from env
- `ClerkLoaded` to prevent flash
- Token cache using `expo-secure-store`

### Root Redirect (`app/index.tsx`)
- Check `useAuth().isSignedIn`
- Check AsyncStorage `userType`
- No userType → `(onboarding)`
- Not signed in → `(auth)`
- Signed in → `(app)`

### Sign Up Flow (`useSignUp()`)
1. `signUp.create({ emailAddress, password, firstName: name })`
2. `signUp.prepareEmailAddressVerification({ strategy: "email_code" })`
3. Navigate to verify-email, pass email as param

### Email Verification Flow
1. User enters 6-digit code
2. `signUp.attemptEmailAddressVerification({ code })`
3. If `status === "complete"`: `setActive({ session: signUp.createdSessionId })`
4. Save userType via API (`POST /v1/users/me/role`) then navigate to `(app)`

### Sign In Flow (`useSignIn()`)
1. `signIn.create({ identifier: email, password })`
2. If `status === "complete"`: `setActive({ session: signIn.createdSessionId })`
3. Navigate to `(app)`

### OAuth Flow (`useOAuth()`)
1. `startOAuthFlow({ redirectUrl })` with `expo-web-browser`
2. If `createdSessionId`: `setActive({ session: createdSessionId })`
3. Navigate to `(app)`
4. Used for both Google (`oauth_google`) and Apple (`oauth_apple`)

### Error Handling
- Invalid credentials → show inline error below form
- Email already exists → show inline error
- Invalid verification code → show inline error
- Network error → show generic toast/alert
- Rate limit → show "tente novamente em X segundos"

## Environment
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env` (user already has this)

## Out of Scope
- "Esqueceu a senha?" flow (button exists but no-op)
- Email change / profile edit
- Account deletion from mobile
- Sign out (will be in app screens later)
