import { STORE_LINKS, type Platform } from "@/lib/store-links";

type Surface = "background" | "surface";

const SURFACE_CLASSES: Record<Surface, string> = {
  // `assinatura-confirmada` sits on a `surface` card, so its buttons are darker
  // than the card; the `conta` dashboard sits on `background`, so its buttons
  // are lighter. Same component, one token.
  background: "bg-background hover:bg-surface",
  surface: "bg-surface hover:bg-white/5",
};

function AppleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14.05 2.9199C14.6696 2.1677 15.0942 1.1246 14.9738.0815c-.8938.0365-1.9889.5975-2.632 1.3497-.5762.668-1.0849 1.7392-.9482 2.7608.9956.076 2.0103-.5044 2.6564-1.2721zM16.267 11.5537c-.0215-2.2489 1.8375-3.3291 1.9215-3.3809-1.0468-1.5299-2.6742-1.7392-3.2553-1.7625-1.3858-.1411-2.7091.8177-3.4113.8177-.7022 0-1.7816-.7989-2.9319-.7773-1.5048.0215-2.8956.8713-3.673 2.2117C3.3824 11.302 4.4775 15.5082 6.0402 17.9008c.7666 1.1718 1.6808 2.4907 2.8819 2.4452 1.1579-.0455 1.5947-.7451 2.9968-.7451 1.4021 0 1.7944.7451 3.0183.7219 1.2454-.0216 2.031-1.1936 2.7892-2.3718.8882-1.3546 1.2501-2.678 1.267-2.7452-.0271-.0108-2.4198-.9275-2.6458-3.6521z"
        fill="white"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.114 1.114a1 1 0 011.372-.006l10.5 9.5a1 1 0 010 1.484l-10.5 9.5A1 1 0 012 20.5V1.5a1 1 0 01.114-.386z"
        fill="#EA4335"
      />
      <path
        d="M13.986 10.608L3.486 20.108 16.5 13.5l-2.514-2.892z"
        fill="#FBBC05"
      />
      <path d="M16.5 6.5L3.486.892l10.5 9.5L16.5 7.5v-1z" fill="#4285F4" />
      <path
        d="M16.5 6.5v7l-2.514-2.892-1.5-1.3 1.5-1.308L16.5 6.5z"
        fill="#34A853"
      />
    </svg>
  );
}

function StoreButton({
  href,
  icon,
  caption,
  store,
  highlighted,
  surface,
}: {
  href: string;
  icon: React.ReactNode;
  caption: string;
  store: string;
  highlighted: boolean;
  surface: Surface;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-highlighted={highlighted ? "true" : "false"}
      className={`flex h-[52px] items-center gap-3 rounded-xl border px-5 transition-colors ${
        SURFACE_CLASSES[surface]
      } ${
        highlighted
          ? "border-primary ring-2 ring-primary/40"
          : "border-border hover:border-border-light"
      }`}
    >
      {icon}
      <div className="flex flex-col">
        <span className="text-[10px] text-text-secondary">{caption}</span>
        <span className="text-sm font-semibold text-white">{store}</span>
      </div>
    </a>
  );
}

/**
 * Both stores, always. `highlight` moves the emphasis to the visitor's own
 * platform; it never removes the other button, because a wrong user-agent read
 * and a desktop visitor both have to be able to get the app anyway.
 */
export function StoreButtons({
  highlight = null,
  surface = "surface",
}: {
  highlight?: Platform | null;
  surface?: Surface;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <StoreButton
        href={STORE_LINKS.ios}
        icon={<AppleIcon />}
        caption="Baixar na"
        store="App Store"
        highlighted={highlight === "ios"}
        surface={surface}
      />
      <StoreButton
        href={STORE_LINKS.android}
        icon={<PlayIcon />}
        caption="Disponível no"
        store="Google Play"
        highlighted={highlight === "android"}
        surface={surface}
      />
    </div>
  );
}
