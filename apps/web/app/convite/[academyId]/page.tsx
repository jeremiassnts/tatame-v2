import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { StoreButtons } from "@/components/store-buttons";
import { ROLE_LABELS, resolveInviteView, type InviteView } from "@/lib/invite";
import { detectPlatform } from "@/lib/store-links";

export const metadata: Metadata = {
  title: "Convite",
  description: "Você foi convidado para entrar em uma academia no Tatame.",
};

const FALLBACK_LOGO = "/icon.png";

function Heading({ view }: { view: InviteView }) {
  if (view.kind === "unavailable") {
    const label = view.role ? ROLE_LABELS[view.role] : null;
    return (
      <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-white">
        {label ? (
          <>
            Você foi convidado para ser{" "}
            <span className="text-primary">{label}</span> no Tatame
          </>
        ) : (
          "Você foi convidado para entrar no Tatame"
        )}
      </h1>
    );
  }

  const academyName = view.kind === "ok" ? view.academy.name : "";
  const label = view.kind === "ok" && view.role ? ROLE_LABELS[view.role] : null;

  return (
    <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-white">
      {label ? (
        <>
          Você foi convidado para ser{" "}
          <span className="text-primary">{label}</span> na{" "}
          <span className="text-primary">{academyName}</span>
        </>
      ) : (
        <>
          Você foi convidado para a{" "}
          <span className="text-primary">{academyName}</span>
        </>
      )}
    </h1>
  );
}

/**
 * The landing side of an invite link, for a visitor who does not have the app
 * yet. TAT-177 makes the same URL open the app when it is installed; this page
 * is what the browser gets when it is not.
 *
 * The link is not per-person. The same URL is pasted once into a group of
 * thirty students, so nothing here may read as belonging to one of them.
 */
export default async function ConvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ academyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { academyId } = await params;
  const { papel } = await searchParams;

  const view = await resolveInviteView(academyId, papel);
  if (view.kind === "not-found") notFound();

  const requestHeaders = await headers();
  const highlight = detectPlatform(requestHeaders.get("user-agent"));

  const logoUrl =
    view.kind === "ok" ? (view.academy.logoUrl ?? FALLBACK_LOGO) : FALLBACK_LOGO;
  const logoAlt = view.kind === "ok" ? view.academy.name : "Tatame";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- the academy
            logo comes from R2 at runtime, and `next/image` would need that
            host declared in `remotePatterns`. */}
        <img
          src={logoUrl}
          alt={logoAlt}
          width={72}
          height={72}
          loading="lazy"
          className="h-18 w-18 rounded-2xl border border-border object-cover"
        />

        <div className="flex flex-col gap-3">
          <Heading view={view} />
          <p className="text-sm text-text-secondary">
            Baixe o app do Tatame para pedir entrada e acompanhar suas aulas,
            presenças e graduações.
          </p>
        </div>

        <StoreButtons highlight={highlight} />

        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
          Já instalou? Toque neste link de novo para entrar direto na academia.
        </p>
      </div>
    </main>
  );
}
