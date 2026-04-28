"use client";

import { managerFetch } from "@/lib/manager-api";
import { useAuth, useClerk, useSignUp, useUser } from "@clerk/nextjs";
import { ArrowRight, CheckCircle, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

type Stage = "form" | "verify" | "authenticated";

export default function CadastroPage() {
  const { signUp } = useSignUp();
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const clerk = useClerk();

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Verification
  const [verificationCode, setVerificationCode] = useState("");

  // UI state
  const [stage, setStage] = useState<Stage>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isLoaded = userLoaded;

  // If already authenticated, show the checkout state
  if (isLoaded && user) {
    return <AuthenticatedView email={user.primaryEmailAddress?.emailAddress ?? ""} getToken={getToken} />;
  }

  // --- OAuth handlers ---
  async function handleOAuth(strategy: "oauth_google" | "oauth_apple") {
    setError("");
    try {
      await clerk.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/cadastro",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar");
    }
  }

  // --- Email/password signup ---
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setError("");
    setLoading(true);

    try {
      await signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
      });

      await signUp.verifications.sendEmailCode();
      setStage("verify");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  // --- Email verification ---
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setError("");
    setLoading(true);

    try {
      await signUp.verifications.verifyEmailCode({ code: verificationCode });

      if (signUp.status === "complete") {
        // Clerk will update the session; page will re-render with user present
        window.location.reload();
      } else {
        setError("Verificação incompleta. Tente novamente.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setLoading(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // --- Verification step ---
  if (stage === "verify") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <form
          onSubmit={handleVerify}
          className="flex w-full max-w-md flex-col items-center gap-8 rounded-[20px] border border-border bg-surface p-8 md:p-10"
        >
          {/* Logo */}
          <LogoHeader subtitle="Verifique seu e-mail" />

          <p className="text-center text-sm text-text-secondary">
            Enviamos um código de verificação para{" "}
            <span className="font-medium text-white">{email}</span>.
          </p>

          {/* Code input */}
          <div className="flex w-full flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              Código de verificação
            </label>
            <input
              type="text"
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              maxLength={6}
              autoComplete="one-time-code"
              className="h-[52px] w-full rounded-xl border border-border bg-background px-4 text-center text-lg tracking-[0.5em] text-text-primary placeholder:text-text-muted outline-none focus:border-primary"
            />
          </div>

          {error && (
            <p className="w-full text-center text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || verificationCode.length < 6}
            className="h-[52px] w-full rounded-xl bg-gradient-to-b from-primary to-primary-dark text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Verificando..." : "Verificar e-mail"}
          </button>
        </form>
      </div>
    );
  }

  // --- Main signup form ---
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-[20px] border border-border bg-surface p-8 md:p-10">
        {/* Logo + heading */}
        <LogoHeader subtitle="Comece seus 30 dias grátis agora" title="Crie sua conta" />

        {/* OAuth buttons */}
        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={() => handleOAuth("oauth_google")}
            className="cursor-pointer flex h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-border bg-background text-sm font-semibold text-white transition-colors hover:border-border-light hover:bg-surface"
          >
            <GoogleIcon />
            Cadastrar com Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("oauth_apple")}
            className="cursor-pointer flex h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-border bg-background text-sm font-semibold text-white transition-colors hover:border-border-light hover:bg-surface"
          >
            <AppleIcon />
            Cadastrar com Apple
          </button>
        </div>

        {/* Divider */}
        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[13px] text-text-muted">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleCreateAccount} className="flex w-full flex-col gap-4">
          {/* Name row */}
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[13px] font-medium text-text-secondary">
                Nome
              </label>
              <input
                type="text"
                placeholder="João"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                className="h-[52px] w-full rounded-xl border border-border bg-background px-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[13px] font-medium text-text-secondary">
                Sobrenome
              </label>
              <input
                type="text"
                placeholder="Silva"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                className="h-[52px] w-full rounded-xl border border-border bg-background px-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              E-mail
            </label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-[52px] w-full rounded-xl border border-border bg-background px-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="h-[52px] w-full rounded-xl border border-border bg-background px-4 pr-12 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-center text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !firstName || !email || !password}
            className="mt-2 h-[52px] w-full rounded-xl bg-gradient-to-b from-primary to-primary-dark text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Criando conta..." : "Criar conta e assinar"}
          </button>
        </form>

        <p className="text-center text-[13px] text-text-muted">
          Ao criar sua conta, você concorda com nossos{" "}
          <a href="/termos" className="text-text-secondary underline hover:text-white">
            Termos de Uso
          </a>{" "}
          e{" "}
          <a href="/privacidade" className="text-text-secondary underline hover:text-white">
            Política de Privacidade
          </a>
          .
        </p>
      </div>
    </div>
  );
}

// --- Authenticated view (post-signup) ---
function AuthenticatedView({
  email,
  getToken,
}: {
  email: string;
  getToken: () => Promise<string | null>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCheckout() {
    setError("");
    setLoading(true);

    try {
      const token = await getToken();
      const { url } = await managerFetch<{ url: string }>(
        "/manager-subscriptions/checkout",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            successUrl: `${window.location.origin}/assinatura-confirmada`,
            cancelUrl: `${window.location.origin}/cadastro`,
          }),
        },
      );
      window.location.href = url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar pagamento");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-[20px] border border-border bg-surface p-8 md:p-10">
        <LogoHeader subtitle="Conta criada com sucesso" />

        {/* Logged-in indicator */}
        <div className="flex w-full items-center gap-3 rounded-xl border border-success/25 bg-success/10 px-4 py-3">
          <CheckCircle className="h-5 w-5 shrink-0 text-success" />
          <p className="text-sm text-white">
            Logado como{" "}
            <span className="font-medium">{email}</span>
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <p className="text-center text-sm text-text-secondary">
            Sua conta está pronta. Clique abaixo para escolher seu plano e
            ativar o acesso completo à plataforma.
          </p>

          {error && (
            <p className="text-center text-sm text-red-400">{error}</p>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-primary to-primary-dark text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Redirecionando..." : "Ir para pagamento"}
            {!loading && <ArrowRight className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Shared logo header ---
function LogoHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Image src="/icon.png" alt="Tatame" width={45} height={45} />
      <h1 className="font-[family-name:var(--font-sora)] text-[22px] font-extrabold tracking-[2px] text-white">
        TATAME
      </h1>
      {title && (
        <p className="font-[family-name:var(--font-sora)] text-xl font-bold text-white">
          {title}
        </p>
      )}
      {subtitle && (
        <p className="text-sm text-text-secondary">{subtitle}</p>
      )}
    </div>
  );
}

// --- SVG icons ---
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2045c0-.638-.057-1.252-.164-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.6150z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1818l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.3441 0-4.3282-1.5832-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853" />
      <path d="M3.964 10.71C3.7841 10.17 3.6818 9.5932 3.6818 9c0-.5932.1023-1.17.2822-1.71V4.9582H.9574C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9574 4.0418L3.964 10.71z" fill="#FBBC05" />
      <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5814-2.5814C13.4627.8918 11.4255 0 9 0 5.4818 0 2.4382 2.0168.9574 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.0456 9.5537c-.0215-2.2489 1.8375-3.3291 1.9215-3.3809-1.0468-1.5299-2.6742-1.7392-3.2553-1.7625-1.3858-.1411-2.7091.8177-3.4113.8177-.7022 0-1.7816-.7989-2.9319-.7773-1.5048.0215-2.8956.8713-3.673 2.2117C1.1604 9.302 2.2555 13.5082 3.8182 15.9008c.7666 1.1718 1.6808 2.4907 2.8819 2.4452 1.1579-.0455 1.5947-.7451 2.9968-.7451 1.4021 0 1.7944.7451 3.0183.7219 1.2454-.0216 2.031-1.1936 2.7892-2.3718.8882-1.3546 1.2501-2.678 1.267-2.7452-.0271-.0108-2.4198-.9275-2.6458-3.6521zM11.8282 2.9199C12.4478 2.1677 12.8724 1.1246 12.752.0815c-.8938.0365-1.9889.5975-2.632 1.3497-.5762.668-1.0849 1.7392-.9482 2.7608.9956.076 2.0103-.5044 2.6564-1.2721z" fill="white" />
    </svg>
  );
}
