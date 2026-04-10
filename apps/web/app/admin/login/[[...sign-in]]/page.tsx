import { SignIn } from "@clerk/nextjs";
import { Grid3x3 } from "lucide-react";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8 rounded-[20px] border border-border bg-surface p-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[14px] border border-border bg-[#242424]">
            <Grid3x3 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-[family-name:var(--font-sora)] text-[22px] font-extrabold tracking-[2px] text-text-primary">
            TATAME
          </h1>
          <p className="text-sm text-text-secondary">Painel Administrativo</p>
        </div>

        {/* Clerk SignIn */}
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "shadow-none bg-transparent",
              card: "bg-transparent shadow-none p-0",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton: "hidden",
              dividerRow: "hidden",
              formButtonPrimary:
                "bg-primary hover:bg-primary-dark rounded-xl h-[52px] text-base font-semibold",
              formFieldInput:
                "bg-background border-border rounded-xl h-[52px] text-text-primary",
              formFieldLabel: "text-text-secondary text-[13px] font-medium",
              footerAction: "hidden",
            },
          }}
          forceRedirectUrl="/admin"
          signUpUrl="/admin/login"
        />
      </div>
    </div>
  );
}
