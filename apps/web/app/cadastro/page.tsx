"use client";

import { SignUp, useUser, useAuth } from "@clerk/nextjs";
import { managerFetch } from "@/lib/manager-api";
import { CheckCircle, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export default function CadastroPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <AuthenticatedView email={user.primaryEmailAddress?.emailAddress ?? ""} getToken={getToken} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2.5">
          <Image src="/icon.png" alt="Tatame" width={36} height={36} />
          <span className="font-[family-name:var(--font-sora)] text-lg font-bold tracking-[1px] text-text-primary">
            TATAME
          </span>
        </div>
        <p className="text-sm text-text-secondary">Comece seus 30 dias grátis agora</p>
      </div>

      <SignUp
        routing="hash"
        forceRedirectUrl="/cadastro"
        appearance={{
          elements: {
            rootBox: "mx-auto",
            cardBox: "shadow-none bg-transparent",
            card: "bg-surface border border-border rounded-[20px] shadow-none",
            headerTitle: "text-text-primary",
            headerSubtitle: "text-text-secondary",
            socialButtonsBlockButton: "border-border bg-background text-white hover:bg-surface",
            formFieldLabel: "text-text-secondary",
            formFieldInput: "bg-background border-border text-white",
            formButtonPrimary: "bg-gradient-to-b from-primary to-primary-dark hover:opacity-90",
            footerActionLink: "text-primary hover:text-primary",
            dividerLine: "bg-border",
            dividerText: "text-text-muted",
            identityPreview: "bg-background border-border",
            identityPreviewText: "text-text-primary",
            identityPreviewEditButton: "text-primary",
            otpCodeFieldInput: "bg-background border-border text-white",
          },
        }}
      />
    </div>
  );
}

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
    setLoading(true);
    setError("");
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
      setError(err instanceof Error ? err.message : "Erro ao redirecionar para pagamento");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-[20px] border border-border bg-surface p-8 md:p-10">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Image src="/icon.png" alt="Tatame" width={36} height={36} />
          <span className="font-[family-name:var(--font-sora)] text-lg font-bold tracking-[1px] text-text-primary">
            TATAME
          </span>
        </div>

        <div className="mb-6 flex items-center gap-2 rounded-xl bg-green-500/10 px-4 py-3">
          <CheckCircle className="h-5 w-5 shrink-0 text-green-400" />
          <span className="text-sm text-green-400">Logado como {email}</span>
        </div>

        <p className="mb-6 text-center text-sm text-text-secondary">
          Clique abaixo para iniciar seu período de teste grátis de 30 dias.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-center text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-primary to-primary-dark text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              Ir para pagamento
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
