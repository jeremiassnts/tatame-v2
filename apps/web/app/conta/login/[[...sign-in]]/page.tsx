"use client";

import { useSignIn, useClerk } from "@clerk/nextjs";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { signIn } = useSignIn();
  const { setActive } = useClerk();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --- OAuth handler ---
  async function handleOAuth(strategy: "oauth_google" | "oauth_apple") {
    if (!signIn) return;
    setError("");
    try {
      const { error } = await signIn.sso({
        strategy,
        redirectCallbackUrl: "/sso-callback",
        redirectUrl: "/conta",
      });
      if (error) {
        setError(error.message ?? "Erro ao autenticar");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar");
    }
  }

  // --- Email/password login ---
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn || !setActive) return;
    setError("");
    setLoading(true);

    try {
      await signIn.create({
        identifier: email,
        password,
      });

      if (signIn.status === "complete") {
        await setActive({ session: signIn.createdSessionId });
        router.push("/conta");
      } else {
        setError("Autenticação incompleta. Tente novamente.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "E-mail ou senha incorretos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-[20px] border border-border bg-surface p-8 md:p-10">
        {/* Logo + heading */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/icon.png" alt="Tatame" width={45} height={45} />
          <h1 className="font-[family-name:var(--font-sora)] text-[22px] font-extrabold tracking-[2px] text-white">
            TATAME
          </h1>
          <p className="text-sm text-text-secondary">Área do Gestor</p>
        </div>

        {/* Email/password form */}
        <form onSubmit={handleLogin} className="flex w-full flex-col gap-4">
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
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
            disabled={loading || !email || !password}
            className="mt-2 h-[52px] w-full rounded-xl bg-gradient-to-b from-primary to-primary-dark text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[13px] text-text-muted">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* OAuth buttons */}
        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={() => handleOAuth("oauth_google")}
            className="cursor-pointer flex h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-border bg-background text-sm font-semibold text-white transition-colors hover:border-border-light hover:bg-surface"
          >
            <GoogleIcon />
            Entrar com Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("oauth_apple")}
            className="cursor-pointer flex h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-border bg-background text-sm font-semibold text-white transition-colors hover:border-border-light hover:bg-surface"
          >
            <AppleIcon />
            Entrar com Apple
          </button>
        </div>

        <p className="text-center text-[13px] text-text-muted">
          Não tem uma conta?{" "}
          <a href="/cadastro" className="text-text-secondary underline hover:text-white">
            Criar conta
          </a>
        </p>
      </div>
    </div>
  );
}

// --- SVG icons ---
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2045c0-.638-.057-1.252-.164-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.6150z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1818l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.3441 0-4.3282-1.5832-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71C3.7841 10.17 3.6818 9.5932 3.6818 9c0-.5932.1023-1.17.2822-1.71V4.9582H.9574C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9574 4.0418L3.964 10.71z" fill="#FBBC05"/>
      <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5814-2.5814C13.4627.8918 11.4255 0 9 0 5.4818 0 2.4382 2.0168.9574 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.0456 9.5537c-.0215-2.2489 1.8375-3.3291 1.9215-3.3809-1.0468-1.5299-2.6742-1.7392-3.2553-1.7625-1.3858-.1411-2.7091.8177-3.4113.8177-.7022 0-1.7816-.7989-2.9319-.7773-1.5048.0215-2.8956.8713-3.673 2.2117C1.1604 9.302 2.2555 13.5082 3.8182 15.9008c.7666 1.1718 1.6808 2.4907 2.8819 2.4452 1.1579-.0455 1.5947-.7451 2.9968-.7451 1.4021 0 1.7944.7451 3.0183.7219 1.2454-.0216 2.031-1.1936 2.7892-2.3718.8882-1.3546 1.2501-2.678 1.267-2.7452-.0271-.0108-2.4198-.9275-2.6458-3.6521zM11.8282 2.9199C12.4478 2.1677 12.8724 1.1246 12.752.0815c-.8938.0365-1.9889.5975-2.632 1.3497-.5762.668-1.0849 1.7392-.9482 2.7608.9956.076 2.0103-.5044 2.6564-1.2721z" fill="white"/>
    </svg>
  );
}
