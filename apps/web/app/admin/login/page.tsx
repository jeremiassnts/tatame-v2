"use client";

import { useClerk, useSignIn } from "@clerk/nextjs";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLoginPage() {
  const { signIn } = useSignIn();
  const { signOut, isSignedIn } = useClerk();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/admin");
    }
  }, [isSignedIn, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;

    setError("");
    setLoading(true);

    try {
      const createResult = await signIn.create({ identifier: email });
      if (createResult.error) {
        if (createResult.error.code === "session_exists") {
          await signOut();
          const retryResult = await signIn.create({ identifier: email });
          if (retryResult.error) {
            setError("E-mail ou senha incorretos");
            setLoading(false);
            return;
          }
        } else {
          setError("E-mail ou senha incorretos");
          setLoading(false);
          return;
        }
      }

      const passwordResult = await signIn.password({ password });
      if (passwordResult.error) {
        setError("E-mail ou senha incorretos");
        setLoading(false);
        return;
      }

      if (signIn.status === "complete") {
        const finalizeResult = await signIn.finalize();
        if (finalizeResult.error) {
          setError("Erro ao finalizar autenticação");
          setLoading(false);
          return;
        }
        router.push("/admin");
      } else {
        setError("Erro inesperado ao autenticar");
        setLoading(false);
      }
    } catch (err: any) {
      const clerkError = err?.errors?.[0];
      const code = clerkError?.code;

      if (
        code === "form_identifier_not_found" ||
        code === "form_password_incorrect"
      ) {
        setError("E-mail ou senha incorretos");
      } else {
        setError(clerkError?.longMessage ?? "Erro ao fazer login");
      }
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form
        onSubmit={handleSubmit}
        className="flex w-[420px] flex-col items-center gap-8 rounded-[20px] border border-border bg-surface p-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/icon.png"
            alt="Tatame"
            width={45}
            height={45}
          />
          <h1 className="font-[family-name:var(--font-sora)] text-[22px] font-extrabold tracking-[2px] text-text-primary">
            TATAME
          </h1>
          <p className="text-sm text-text-secondary">Painel Administrativo</p>
        </div>

        {/* Form Fields */}
        <div className="flex w-full flex-col gap-4">
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
                placeholder="••••••••"
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
        </div>

        {/* Error */}
        {error && (
          <p className="w-full text-center text-sm text-red-400">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="h-[52px] w-full rounded-xl bg-primary text-base font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
