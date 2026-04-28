"use client";

import { SignIn } from "@clerk/nextjs";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2.5">
          <Image src="/icon.png" alt="Tatame" width={36} height={36} />
          <span className="font-[family-name:var(--font-sora)] text-lg font-bold tracking-[1px] text-text-primary">
            TATAME
          </span>
        </div>
        <p className="text-sm text-text-secondary">Área do Gestor</p>
      </div>

      <SignIn
        routing="hash"
        forceRedirectUrl="/conta"
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
          },
        }}
      />
    </div>
  );
}
