import dynamic from "next/dynamic";
import { HeaderV2 } from "@/components/v2/header-v2";
import { HeroV2 } from "@/components/v2/hero-v2";
import {
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
} from "@/components/json-ld";

const BeamsBackground = dynamic(() =>
  import("@/components/ui/beams-background").then((m) => m.BeamsBackground)
);
const FeaturesV2 = dynamic(() =>
  import("@/components/v2/features-v2").then((m) => m.FeaturesV2)
);
const HowToStart = dynamic(() =>
  import("@/components/v2/how-to-start").then((m) => m.HowToStart)
);
const PricingV2 = dynamic(() =>
  import("@/components/v2/pricing-v2").then((m) => m.PricingV2)
);
const FaqV2 = dynamic(() =>
  import("@/components/v2/faq-v2").then((m) => m.FaqV2)
);
const FinalCtaV2 = dynamic(() =>
  import("@/components/v2/final-cta-v2").then((m) => m.FinalCtaV2)
);
const FooterV2 = dynamic(() =>
  import("@/components/v2/footer-v2").then((m) => m.FooterV2)
);

export default function Home() {
  return (
    <>
      <BeamsBackground intensity="subtle" />
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo principal
      </a>
      <main
        id="conteudo-principal"
        className="relative z-10 flex min-h-screen flex-col"
      >
        <OrganizationJsonLd />
        <SoftwareApplicationJsonLd />
        <HeaderV2 />
        <HeroV2 />
        <FeaturesV2 />
        <HowToStart />
        <PricingV2 />
        <FaqV2 />
        <FinalCtaV2 />
        <FooterV2 />
      </main>
    </>
  );
}
